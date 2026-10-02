"""Bounded parallel workflow for company and job-market interview prep."""
import asyncio
import json
import logging
from typing import Annotated, Any, Literal

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.types import interrupt
from pydantic import BaseModel, Field, ValidationError
from typing_extensions import TypedDict

from agents.company_research_node import CompanyResearchNode
from agents import interview_prep_fields as workflow_fields
from agents.job_intelligence_agent import JobIntelligenceAgent, JobIntelligenceInput
from agents.skill_gap_agent import SkillGapAgent
from agents.research_agent import ContentResearchAgent
from core.config import get_llm, settings
from graph.events import INTERNAL_LLM_CONFIG, dispatch_event, make_event
from graph.router import route_after_agent
from guardrails.validators import run_guardrails
from prompts.system_prompts import COMPANY_RESEARCH_PROMPT
from tools.company_research_tools import COMPANY_RESEARCH_TOOLS

logger = logging.getLogger(__name__)

MAX_CLARIFICATION_ROUNDS = 3
BRANCH_TIMEOUT_SECONDS = 45


class ReActDecision(BaseModel):
    action: Literal["complete", "partial", "failed", "clarify"]
    summary: str = Field(max_length=500)
    question: str | None = None


class AgentBranchResult(BaseModel):
    status: Literal["success", "partial", "failed", "invalid_input", "timeout"]
    data: Any = None
    error: str | None = None


class CompanyBranchState(TypedDict, total=False):
    messages: Annotated[list, add_messages]
    task_context: dict[str, Any]
    guardrail_flags: dict[str, str]


def _build_company_branch():
    graph = StateGraph(CompanyBranchState)
    graph.add_node("company_research", CompanyResearchNode())
    graph.add_node("cr_guardrails", run_guardrails)
    graph.add_node("cr_tools", ToolNode(COMPANY_RESEARCH_TOOLS, handle_tool_errors=True))
    graph.add_edge(START, "company_research")
    graph.add_conditional_edges(
        "company_research", route_after_agent, {"tools": "cr_guardrails", END: END}
    )
    graph.add_conditional_edges(
        "cr_guardrails", route_after_agent, {"tools": "cr_tools", END: END}
    )
    graph.add_edge("cr_tools", "company_research")
    return graph.compile()


def _message_text(message: Any) -> str:
    content = getattr(message, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(item.get("text", "") for item in content if isinstance(item, dict))
    return str(content or "")


def _merge_input(current: dict[str, Any], update: Any) -> dict[str, Any]:
    if isinstance(update, dict):
        fields = {field.name for field in workflow_fields.WORKFLOW_FIELDS}
        return {
            **current,
            **{
                key: value.strip()
                for key, value in update.items()
                if key in fields and isinstance(value, str) and value.strip()
            },
        }
    if isinstance(update, str) and update.strip():
        return {**current, "_answer_text": update.strip()}
    return current


def _clarification_question(missing: list[Any], values: dict[str, str]) -> str:
    missing_names = {field.name for field in missing}
    company = values.get("company", "")
    role = values.get("role", "")
    location = values.get("location", "")

    if missing_names == {"company", "role"} and location:
        return f"Which company and role are you targeting in {location}?"
    if missing_names == {"company", "location"} and role:
        return f"Do you have a specific company in mind for the {role} role, and what job location should I use?"
    if missing_names == {"role", "location"} and company:
        return f"Which role are you targeting at {company}, and what job location should I use?"
    if missing_names == {"company"} and role:
        suffix = f" in {location}" if location else ""
        return f"Do you have a specific company in mind for the {role} role{suffix}?"
    if missing_names == {"role"} and company:
        suffix = f" in {location}" if location else ""
        return f"Which role are you targeting at {company}{suffix}?"
    if missing_names == {"location"} and company and role:
        return f"What job location should I use for the {role} role at {company}?"

    labels = [field.label.lower() for field in missing]
    if len(labels) == len(workflow_fields.WORKFLOW_FIELDS):
        return "Which " + ", ".join(labels[:-1]) + f", and {labels[-1]} should I use for your interview prep?"
    return "What " + " and ".join(labels) + " should I use?"


class InterviewPrepOrchestrator:
    name = "interview_prep"

    def __init__(
        self,
        company_graph: Any | None = None,
        job_agent: Any | None = None,
        skill_gap_agent: SkillGapAgent | None = None,
        research_agent: ContentResearchAgent | None = None,
    ):
        self.company_graph = company_graph or _build_company_branch()
        self.job_agent = job_agent or JobIntelligenceAgent()
        self.skill_gap_agent = skill_gap_agent or SkillGapAgent()
        self.research_agent = research_agent or ContentResearchAgent()


    async def _extract_fields(self, state: dict[str, Any], text: str | None = None) -> dict[str, str]:
        messages = state.get("messages", [])
        conversation = "\n".join(
            f"{type(message).__name__}: {_message_text(message)[:1200]}"
            for message in messages[-8:]
        )
        if text:
            conversation += f"\nClarification: {text}"
        memories = state.get("memory_context") or []
        prompt = (
            "Extract only explicit values for the configured interview-preparation fields from this conversation and memory. "
            "Return one JSON object whose keys exactly match the field names in this schema. Use empty strings when unknown; "
            "never guess. The schema also identifies each field's required status and meaning:\n"
            + json.dumps(workflow_fields.extraction_schema())
            + "\nKnown memory:\n"
            + "\n".join(str(item)[:300] for item in memories[:5])
            + f"\nConversation:\n{conversation}"
        )
        try:
            response = await asyncio.wait_for(
                get_llm(temperature=0).ainvoke(prompt, config=INTERNAL_LLM_CONFIG), timeout=12
            )
            content = _message_text(response).strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[-1]
            if content.endswith("```"):
                content = content[:-3]
            parsed = json.loads(content.strip())
            if isinstance(parsed, dict):
                return workflow_fields.normalize_workflow_fields(parsed)
        except Exception:
            logger.warning("Could not extract interview-prep fields; asking for them directly", exc_info=True)
        return {}

    async def _prepare(self, state: dict[str, Any]) -> dict[str, Any]:
        current = state.get("interview_prep_input") or state.get("workflow_input") or {}
        normalized = workflow_fields.normalize_workflow_fields(current)
        extracted_from_text = False

        resume = state.get("workflow_resume_input")
        if resume:
            if isinstance(resume, dict):
                normalized = _merge_input(normalized, resume)
                answer = resume.get("answer")
                if isinstance(answer, str) and answer.strip():
                    extracted = await self._extract_fields(state, answer)
                    normalized = _merge_input(normalized, extracted)
                    extracted_from_text = True
            elif isinstance(resume, str):
                extracted = await self._extract_fields(state, resume)
                normalized = _merge_input(normalized, extracted)
                extracted_from_text = True
            else:
                normalized = _merge_input(normalized, resume)
        elif isinstance(state.get("workflow_text_input"), str) and state["workflow_text_input"].strip():
            extracted = await self._extract_fields(state, state["workflow_text_input"])
            normalized = _merge_input(normalized, extracted)
            extracted_from_text = True
        missing = workflow_fields.missing_required_fields(normalized)
        can_extract_conversation = not state.get("workflow_mode") or state.get("workflow_text_input")
        if missing and state.get("messages") and can_extract_conversation and not extracted_from_text:
            normalized = _merge_input(normalized, await self._extract_fields(state))
            missing = workflow_fields.missing_required_fields(normalized)
        if missing:
            rounds = int(state.get("workflow_clarification_rounds") or 0) + 1
            if rounds > MAX_CLARIFICATION_ROUNDS:
                message = "I still need the company, role, and location to continue. Please start a new preparation request with those details."
                return {
                    "interview_prep_input": normalized,
                    "workflow_status": "needs_restart",
                    "workflow_clarification_rounds": rounds,
                    "workflow_question": None,
                    "workflow_resume_input": {},
                    "messages": [AIMessage(content=message)],
                }
            question = _clarification_question(missing, normalized)
            return {
                "interview_prep_input": normalized,
                "workflow_status": "awaiting_input",
                "workflow_clarification_rounds": rounds,
                "workflow_question": {
                    "question": question,
                    "missing_fields": [field.name for field in missing],
                    "field_labels": [field.label for field in missing],
                },
                "workflow_resume_input": {},
                "messages": [AIMessage(content=question)],
            }

        return {
            "interview_prep_input": normalized,
            "workflow_status": "running",
            "workflow_clarification_rounds": int(state.get("workflow_clarification_rounds") or 0),
            "workflow_question": None,
            "workflow_resume_input": {},
        }

    async def prepare(self, state: dict[str, Any]) -> dict[str, Any]:
        return await self._prepare(state)

    async def pause_for_input(self, state: dict[str, Any]) -> dict[str, Any]:
        answer = interrupt(state.get("workflow_question") or {"question": "Please provide the missing details."})
        if isinstance(answer, dict):
            text = answer.get("answer") or ", ".join(
                f"{field}: {answer[field]}"
                for field in ("company", "role", "location")
                if answer.get(field)
            )
        else:
            text = str(answer)
        return {
            "workflow_resume_input": answer,
            "messages": [HumanMessage(content=text or "")],
        }

    async def run_parallel(self, state: dict[str, Any]) -> dict[str, Any]:
        values = workflow_fields.normalize_workflow_fields(state["interview_prep_input"])
        company_fields = workflow_fields.fields_for_agent(values, "company_research")
        job_fields = workflow_fields.fields_for_agent(values, "job_intelligence")
        company_prompt = (
            "Prepare a company dossier using only the company-interview fields below. "
            "Use the company overview and news tools. Clearly distinguish sourced facts from unknowns.\n"
            + json.dumps(company_fields)
        )
        company_input = {
            "messages": [HumanMessage(content=company_prompt)],
            "task_context": {},
            "guardrail_flags": {},
        }
        await dispatch_event(
            make_event("interview_prep", "parallel_agents", "running", {
                "agents": ["company_research", "job_intelligence"],
                "message": "Company Research and Job Intelligence are running in parallel.",
            }),
            None,
        )

        async def company_branch():
            result = await asyncio.wait_for(
                self.company_graph.ainvoke(company_input, config={"recursion_limit": 12}),
                timeout=BRANCH_TIMEOUT_SECONDS,
            )
            messages = result.get("messages", [])
            profile = (result.get("task_context") or {}).get("company_profile")
            dossier = _message_text(messages[-1]) if messages else ""
            status = "success" if profile and (profile.get("description") or profile.get("context_snippets")) else "partial"
            return {
                "status": status,
                "data": {
                    "profile": profile,
                    "dossier": dossier,
                    "dataSource": "dummy" if not settings.serpapi_enabled else "serpapi",
                },
                "error": None,
            }

        async def job_branch():
            return await asyncio.wait_for(
                self.job_agent({"job_intelligence_input": job_fields}),
                timeout=BRANCH_TIMEOUT_SECONDS,
            )

        company_result, job_node_result = await asyncio.gather(
            company_branch(), job_branch(), return_exceptions=True
        )
        if isinstance(company_result, BaseException):
            logger.warning("Company Research branch failed", exc_info=company_result)
            company_result = {"status": "failed", "data": None, "error": "Company research is temporarily unavailable."}
        try:
            company_result = AgentBranchResult.model_validate(company_result).model_dump()
        except ValidationError:
            logger.warning("Company Research returned an invalid result")
            company_result = {"status": "failed", "data": None, "error": "Company research returned an invalid result."}
        if isinstance(job_node_result, BaseException):
            logger.warning("Job Intelligence branch failed", exc_info=job_node_result)
            job_result = {"status": "failed", "data": None, "error": "Job market data is temporarily unavailable."}
        else:
            job_result = job_node_result.get("job_intelligence_result") or {
                "status": "failed", "data": None, "error": "Job Intelligence returned no result."
            }
        try:
            job_result = AgentBranchResult.model_validate(job_result).model_dump()
        except ValidationError:
            logger.warning("Job Intelligence returned an invalid result")
            job_result = {"status": "failed", "data": None, "error": "Job Intelligence returned an invalid result."}

        await dispatch_event(
            make_event("interview_prep", "parallel_agents", "completed", {
                "company_research": company_result.get("status"),
                "job_intelligence": job_result.get("status"),
            }),
            None,
        )

        return {
            "company_research_result": company_result,
            "job_intelligence_result": job_result,
            "workflow_status": "evaluating",
        }

    async def run_skill_gap(self, state: dict[str, Any]) -> dict[str, Any]:
        """
        Stage 2 of the pipeline: skill gap analysis.

        Reads company_research_result + job_intelligence_result from state
        (written by run_parallel), runs SkillGapAgent, and writes:
          - task_context["company_profile"]   (moved here from evaluate)
          - task_context["job_intelligence"]  (moved here from evaluate)
          - task_context["target_role"]       (for ContentResearchAgent)
          - task_context["target_company"]    (for ContentResearchAgent)
          - task_context["skill_gap"]         (full gap report)
          - state["skill_gaps"]               (list[str] for ContentResearchAgent)
        """
        values = workflow_fields.normalize_workflow_fields(state.get("interview_prep_input") or {})
        company_result = state.get("company_research_result") or {}
        job_result = state.get("job_intelligence_result") or {}

        company_profile = (company_result.get("data") or {}).get("profile") or {}
        job_intelligence = job_result.get("data") or {}

        company = values.get("company", "") or company_profile.get("name", "")
        role = values.get("role", "")
        resume_text = (state.get("task_context") or {}).get("candidate_resume_text", "")

        # Merge upstream results into task_context so downstream nodes can read them
        task_context = dict(state.get("task_context") or {})
        if company_profile:
            task_context["company_profile"] = company_profile
        if job_intelligence:
            task_context["job_intelligence"] = job_intelligence
        # ContentResearchAgent reads these top-level keys
        task_context["target_role"] = role
        task_context["target_company"] = company

        await dispatch_event(
            make_event("interview_prep", "skill_gap_analysis", "running", {
                "message": f"Analyzing skill gaps for {role} at {company}...",
                "has_resume": bool(resume_text.strip()),
            }),
            None,
        )

        try:
            gap_report = await asyncio.wait_for(
                self.skill_gap_agent.analyze(company_profile, job_intelligence, resume_text, company, role),
                timeout=BRANCH_TIMEOUT_SECONDS,
            )
            task_context["skill_gap"] = gap_report
            skill_gaps = [g["skill"] for g in gap_report.get("priority_gaps", []) if g.get("skill")]
        except Exception as exc:
            logger.warning("Skill Gap analysis failed: %s", exc)
            task_context["skill_gap"] = {"error": str(exc), "priority_gaps": [], "readiness_score": 0, "no_resume": False}
            skill_gaps = []

        await dispatch_event(
            make_event("interview_prep", "skill_gap_analysis", "completed", {
                "gaps_count": len(skill_gaps),
                "readiness_score": task_context.get("skill_gap", {}).get("readiness_score", 0),
            }),
            None,
        )

        return {
            "task_context": task_context,
            "skill_gaps": skill_gaps,
            "workflow_status": "researching",
        }

    async def run_research(self, state: dict[str, Any]) -> dict[str, Any]:
        """
        Stage 3 of the pipeline: research each skill gap.

        Delegates to ContentResearchAgent.__call__ which already loops over
        state["skill_gaps"] and reads task_context["target_role/company"].
        Skips gracefully if no gaps were identified.
        """
        skill_gaps = state.get("skill_gaps") or []
        if not skill_gaps:
            logger.info("No skill gaps to research — skipping research stage.")
            await dispatch_event(
                make_event("interview_prep", "research_stage", "completed", {
                    "message": "No skill gaps to research — research stage skipped.",
                    "modules_produced": 0,
                }),
                None,
            )
            return {"researched_materials": [], "workflow_status": "evaluating"}

        await dispatch_event(
            make_event("interview_prep", "research_stage", "running", {
                "message": f"Researching {len(skill_gaps)} skill gap(s)...",
                "gaps": skill_gaps,
            }),
            None,
        )

        try:
            result = await self.research_agent(state)
        except Exception as exc:
            logger.warning("Research stage failed: %s", exc)
            result = {"researched_materials": [], "execution_events": [], "handoffs": []}

        materials = result.get("researched_materials") or []
        await dispatch_event(
            make_event("interview_prep", "research_stage", "completed", {
                "message": f"Research complete. {len(materials)} learning module(s) produced.",
                "modules_produced": len(materials),
            }),
            None,
        )

        return {
            **result,
            "workflow_status": "evaluating",
        }

    async def evaluate(self, state: dict[str, Any]) -> dict[str, Any]:

        company_result = state.get("company_research_result") or {"status": "failed", "data": None}
        job_result = state.get("job_intelligence_result") or {"status": "failed", "data": None}
        profiles = {"company_research": company_result, "job_intelligence": job_result}
        unavailable = {"failed", "invalid_input", "timeout"}
        if company_result.get("status") in unavailable and job_result.get("status") in unavailable:
            fallback_action = "failed"
        elif company_result.get("status") == job_result.get("status") == "success":
            fallback_action = "complete"
        else:
            fallback_action = "partial"
        summary = {
            "complete": "Both company research and job-market analysis are available.",
            "partial": "Some interview-preparation data is available; the unavailable or incomplete source is identified below.",
            "failed": "Neither source returned usable interview-preparation data.",
        }[fallback_action]
        action = fallback_action
        clarification_question = None
        try:
            prompt = (
                "Evaluate this combined interview-preparation result. Return JSON with action (complete, partial, failed), "
                "and a short user-facing summary. Do not ask to retry agents. A failed or empty source means partial "
                "when the other source has usable data; failed only when both failed. Do not include hidden reasoning.\n"
                + json.dumps({"company": company_result, "job_market": job_result}, default=str)[:7000]
            )
            response = await asyncio.wait_for(
                get_llm(temperature=0).ainvoke(prompt, config=INTERNAL_LLM_CONFIG), timeout=10
            )
            content = _message_text(response).strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[-1]
            if content.endswith("```"):
                content = content[:-3]
            decision = ReActDecision.model_validate(json.loads(content.strip()))
            if decision.action == "clarify" and decision.question and decision.question.strip():
                clarification_question = decision.question.strip()
            elif decision.action == fallback_action:
                action = decision.action
                summary = decision.summary
        except Exception:
            logger.warning("ReAct evaluator failed; using deterministic result status", exc_info=True)

        if clarification_question:
            rounds = int(state.get("workflow_clarification_rounds") or 0) + 1
            if rounds <= MAX_CLARIFICATION_ROUNDS:
                return {
                    "workflow_status": "awaiting_input",
                    "workflow_question": {
                        "question": clarification_question,
                        "missing_fields": [],
                        "reason": "result_clarification",
                    },
                    "workflow_clarification_rounds": rounds,
                    "messages": [AIMessage(content=clarification_question)],
                }
            message = "I could not resolve the remaining ambiguity within the clarification limit. Please start a new request with more specific details."
            return {
                "workflow_status": "needs_restart",
                "workflow_question": None,
                "workflow_clarification_rounds": rounds,
                "messages": [AIMessage(content=message)],
            }

        result = {
            "status": action,
            "summary": summary,
            "company_research": company_result,
            "job_intelligence": job_result,
            "react": {"action": action, "summary": summary, "bounded": True},
        }
        response = AIMessage(content=summary)
        handoff = {
            "agent": self.name,
            "kind": "interview_prep",
            "summary": summary[:200],
            "data": {"status": action},
        }
        task_context = dict(state.get("task_context") or {})
        task_context["interview_prep"] = result
        company_profile = (company_result.get("data") or {}).get("profile")
        job_profile = job_result.get("data")
        if company_profile:
            task_context["company_profile"] = company_profile
        if job_profile:
            task_context["job_intelligence"] = job_profile
        return {
            "workflow_status": action,
            "interview_prep_result": result,
            "task_context": task_context,
            "messages": [response],
            "handoffs": [handoff],
        }

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        return await self.prepare(state)


def route_after_prepare(state: dict[str, Any]) -> str:
    status = state.get("workflow_status")
    if status == "awaiting_input":
        return "pause"
    if status == "running":
        return "run"
    return "stop"


def route_after_evaluate(state: dict[str, Any]) -> str:
    return "pause" if state.get("workflow_status") == "awaiting_input" else "save"