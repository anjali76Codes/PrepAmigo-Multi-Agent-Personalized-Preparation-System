"""Bounded parallel workflow for company and job-market interview prep."""
import asyncio
import difflib
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

from agents.company_brief import DirectCompanyResearch, company_context
from agents.company_research_node import CompanyResearchNode
from agents import interview_prep_fields as workflow_fields
from agents.job_intelligence_agent import JobIntelligenceAgent, JobIntelligenceInput
from agents.planner_agent import PlannerAgent
from agents.skill_gap_agent import SkillGapAgent
from agents.research_agent import ContentResearchAgent, company_module_request, prep_focus
from core.config import get_llm, llm_concurrency, service_path, settings
from graph.events import INTERNAL_LLM_CONFIG, dispatch_event, emit_to_graph_stream, make_event
from graph.router import route_after_agent
from guardrails.validators import run_guardrails
from observability.metrics import agent_scope
from observability.timing import log_failure
from storage.llm_cache import forget_response
from storage.json_store import save_json
from tools.company_research_tools import COMPANY_RESEARCH_TOOLS
from tools.duration import extract_duration_days, resolve_plan_total_days
from tools.plan_db_sync import sync_generated_plan_to_db
from graph.knowledge_graph import best_effort, get_knowledge_graph, record_in_background
from tools.plan_builder import key_concepts, plan_topics, schedule

logger = logging.getLogger(__name__)

MAX_CLARIFICATION_ROUNDS = 3
COMPANY_MODULE_MIN_RESOURCES = 4


class _SkipEvaluator(Exception):
    """The closing model call is switched off (EVALUATOR_LLM=off)."""


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


def plannable_gaps(skill_gaps: list[str], priority_gaps: list[dict[str, Any]], total_days: int) -> set[str]:
    """The gaps the planner will give days to, worked out before research
    with the planner's own scheduling (plan_builder.schedule): a 10-day plan
    has room for 3 topics, so researching 6 paid for 3 that were never
    planned. When the company-platform module is on it takes the first
    slot, so it is counted in. Any gap can be researched if this fails."""
    gaps = priority_gaps or [{"skill": gap, "effort": "High"} for gap in skill_gaps]
    if settings.company_module == "on":
        gaps = [{"skill": "(company platform module)", "effort": "High"}, *gaps]
    try:
        scheduled, _ = schedule(plan_topics([], gaps), total_days, settings.plan_max_topics,
                                settings.plan_min_days_per_topic)
    except Exception:
        logger.warning("Could not work out the plan's topics before research; researching every gap", exc_info=True)
        return set(skill_gaps)
    keys = {topic["key"] for topic in scheduled}
    return {gap for gap in skill_gaps if gap.strip().casefold() in keys}


def canonical_company(user_value: str, profile_name: str) -> str:
    """The company name the rest of the pipeline should use: the research
    profile's name (Google's knowledge-graph title or spelling fix) when it
    is plausibly the same company the user typed — a typo fix like
    "Antropic" -> "Anthropic", or a fuller form like "Google" -> "Google
    LLC" — otherwise exactly what the user typed."""
    user_value, profile_name = user_value.strip(), (profile_name or "").strip()
    if not profile_name or profile_name.casefold() in {"the company", "target company"}:
        return user_value
    if not user_value:
        return profile_name
    a, b = user_value.casefold(), profile_name.casefold()
    if b.startswith(a) or difflib.SequenceMatcher(None, a, b).ratio() >= 0.8:
        return profile_name
    return user_value


def route_company_branch(state: dict[str, Any]) -> str:
    """route_after_agent with a cap on tool rounds. Without thinking, the
    model calls one tool per turn and can keep re-searching; past the cap
    the branch ends with the profile already built from the tool results
    so far, instead of hitting the recursion limit and losing all of it.
    Only safe in this isolated branch: its messages are discarded after
    the run, so ending on an unanswered tool call never reaches a chat
    thread's history."""
    if route_after_agent(state) == END:
        return END
    rounds = sum(1 for m in state.get("messages", []) if getattr(m, "tool_calls", None))
    return END if rounds > settings.company_research_max_tool_rounds else "tools"


def _build_company_branch():
    graph = StateGraph(CompanyBranchState)
    graph.add_node("company_research", CompanyResearchNode())
    graph.add_node("cr_guardrails", run_guardrails)
    graph.add_node("cr_tools", ToolNode(COMPANY_RESEARCH_TOOLS, handle_tool_errors=True))
    graph.add_edge(START, "company_research")
    graph.add_conditional_edges(
        "company_research", route_company_branch, {"tools": "cr_guardrails", END: END}
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
        planner_agent: PlannerAgent | None = None,
        company_direct: DirectCompanyResearch | None = None,
    ):
        self.company_direct = company_direct or DirectCompanyResearch()
        self.company_graph = company_graph or _build_company_branch()
        self.job_agent = job_agent or JobIntelligenceAgent()
        self.skill_gap_agent = skill_gap_agent or SkillGapAgent()
        self.research_agent = research_agent or ContentResearchAgent()
        self.planner_agent = planner_agent or PlannerAgent()


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
        response = None
        try:
            response = await asyncio.wait_for(
                get_llm(guarded=True, temperature=0).ainvoke(prompt, config=INTERNAL_LLM_CONFIG),
                timeout=settings.interview_prep_extract_timeout_seconds,
            )
            content = _message_text(response).strip()
            if "```json" in content:
                content = content.split("```json", 1)[1].split("```", 1)[0]
            elif "```" in content:
                content = content.split("```", 1)[1].split("```", 1)[0]
            elif "{" in content and "}" in content:
                content = content[content.find("{"):content.rfind("}") + 1]
            parsed = json.loads(content.strip())
            if isinstance(parsed, dict):
                return workflow_fields.normalize_workflow_fields(parsed)
        except Exception as exc:
            forget_response(response)  # an unparseable answer must not be replayed from the cache
            log_failure(logger, "Could not extract interview-prep fields; asking for them directly", exc)
        return {}

    async def _prepare(self, state: dict[str, Any]) -> dict[str, Any]:
        current = state.get("interview_prep_input") or state.get("workflow_input") or {}
        normalized = workflow_fields.normalize_workflow_fields(current)
        extracted_from_text = False

        resume = state.get("workflow_resume_input")
        pending_question = state.get("workflow_question") or {}
        if pending_question.get("reason") == "result_clarification":
            answer = resume if isinstance(resume, str) else (
                resume.get("answer") if isinstance(resume, dict) else None
            )
            structured_answer = isinstance(resume, dict) and any(
                isinstance(resume.get(field.name), str) and resume[field.name].strip()
                for field in workflow_fields.WORKFLOW_FIELDS
            )
            if not (isinstance(answer, str) and answer.strip()) and not structured_answer:
                rounds = int(state.get("workflow_clarification_rounds") or 0) + 1
                if rounds > MAX_CLARIFICATION_ROUNDS:
                    message = (
                        "I could not resolve the remaining ambiguity within the clarification limit. "
                        "Please start a new request with more specific details."
                    )
                    return {
                        "workflow_status": "needs_restart",
                        "workflow_question": None,
                        "workflow_clarification_rounds": rounds,
                        "workflow_resume_input": {},
                        "messages": [AIMessage(content=message)],
                    }
                question = pending_question.get("question") or "Please provide the missing details."
                return {
                    "workflow_status": "awaiting_input",
                    "workflow_question": pending_question,
                    "workflow_clarification_rounds": rounds,
                    "workflow_resume_input": {},
                    "messages": [AIMessage(content=question)],
                }

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
        # Resolve requested plan duration in days (e.g. 90 days, 30 days, 60 days)
        extracted_days = resolve_plan_total_days(
            state,
            [
                state.get("workflow_text_input"),
                resume if isinstance(resume, str) else (resume.get("answer") if isinstance(resume, dict) else None),
            ],
        )

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
            res = {
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
            if extracted_days:
                res["plan_total_days"] = extracted_days
            return res

        res = {
            "interview_prep_input": normalized,
            "workflow_status": "running",
            "workflow_clarification_rounds": int(state.get("workflow_clarification_rounds") or 0),
            "workflow_question": None,
            "workflow_resume_input": {},
        }
        if extracted_days:
            res["plan_total_days"] = extracted_days
        return res

    async def prepare(self, state: dict[str, Any]) -> dict[str, Any]:
        with agent_scope("prepare"):
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
        # a single local Ollama server generates one response at a time, so
        # two branches that each make their own LLM calls don't actually run
        # concurrently there — they just queue behind each other while each
        # branch's own timeout keeps counting down, so one (or both) can
        # spuriously time out waiting for a turn that was always coming.
        # Cloud providers (openai) genuinely serve concurrent requests, so
        # gather is a real win there; for ollama, run them one at a time so
        # neither branch's budget is spent waiting on the other.
        # direct company research takes a couple of seconds and its brief
        # is what job intelligence falls back on when the company has no
        # postings, so it always runs first in that mode
        run_concurrently = llm_concurrency(settings) > 1 and settings.company_research_mode != "direct"
        job_state: dict[str, Any] = {"job_intelligence_input": job_fields}
        await dispatch_event(
            make_event("interview_prep", "parallel_agents", "running", {
                "agents": ["company_research", "job_intelligence"],
                "message": (
                    "Company Research and Job Intelligence are running in parallel."
                    if run_concurrently
                    else "Company Research and Job Intelligence are running sequentially (local model)."
                ),
            }),
            None,
        )

        async def company_branch():
            with agent_scope("company_research"):
                return await _company_branch()

        async def _company_direct():
            # COMPANY_RESEARCH_MODE=direct: both searches in parallel, then
            # one small model call (agents/company_brief.py)
            outcome = await asyncio.wait_for(
                self.company_direct.run(values.get("company", ""), values.get("role", "")),
                timeout=settings.interview_prep_branch_timeout_seconds,
            )
            profile, brief = outcome["profile"], outcome.get("brief")
            has_content = bool(profile.get("description") or any(profile.get("context_snippets", {}).values()))
            return {
                "status": "success" if has_content and brief else "partial",
                "data": {
                    "profile": profile,
                    "dossier": (brief or {}).get("summary", ""),
                    "dataSource": "dummy" if not settings.serpapi_enabled else "serpapi",
                },
                "error": None,
            }

        async def _company_branch():
            if settings.company_research_mode == "direct":
                return await _company_direct()
            # agent -> guardrails -> tools per round, plus the final
            # agent step: always room for the round cap to end it first
            config = {"recursion_limit": 3 * settings.company_research_max_tool_rounds + 4}
            latest: dict[str, Any] = {}

            async def run() -> dict[str, Any]:
                # streamed state by state where the graph supports it, so a
                # timeout keeps what earlier rounds already gathered
                if not hasattr(self.company_graph, "astream"):
                    return await self.company_graph.ainvoke(company_input, config=config)
                async for mode, update in self.company_graph.astream(
                    company_input, config=config, stream_mode=["values", "custom"]
                ):
                    if mode == "values":
                        latest.update(update)
                    elif mode == "custom":
                        emit_to_graph_stream(update)
                return latest

            timed_out = False
            try:
                result = await asyncio.wait_for(run(), timeout=settings.interview_prep_branch_timeout_seconds)
            except asyncio.TimeoutError:
                if not (latest.get("task_context") or {}).get("company_profile"):
                    raise
                # the profile is built from tool results; only the model's
                # closing dossier text was still pending
                logger.warning("Company Research timed out after %.0fs; keeping the profile gathered so far",
                               settings.interview_prep_branch_timeout_seconds)
                result, timed_out = latest, True
            messages = result.get("messages", [])
            profile = (result.get("task_context") or {}).get("company_profile")
            dossier = "" if timed_out else (_message_text(messages[-1]) if messages else "")
            status = "success" if not timed_out and profile and (profile.get("description") or profile.get("context_snippets")) else "partial"
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
            with agent_scope("job_intelligence"):
                return await asyncio.wait_for(
                    self.job_agent(job_state),
                    timeout=settings.interview_prep_branch_timeout_seconds,
                )

        async def _outcome(coro):
            """await a branch and hand back its exception instead of raising,
            matching asyncio.gather(..., return_exceptions=True)'s contract
            so the error handling below works the same either way."""
            try:
                return await coro
            except Exception as exc:
                return exc

        if run_concurrently:
            company_result, job_node_result = await asyncio.gather(
                company_branch(), job_branch(), return_exceptions=True
            )
        else:
            company_result = await _outcome(company_branch())
            # running one after the other lets the job search use the company
            # name the research just resolved (e.g. a typo fix) instead of the raw input
            if isinstance(company_result, dict) and job_fields.get("company"):
                profile_name = ((company_result.get("data") or {}).get("profile") or {}).get("name", "")
                job_fields["company"] = canonical_company(job_fields["company"], profile_name)
            if isinstance(company_result, dict):
                job_state["company_context"] = company_context((company_result.get("data") or {}).get("profile"))
            job_node_result = await _outcome(job_branch())
        if isinstance(company_result, BaseException):
            log_failure(logger, "Company Research branch failed", company_result)
            company_result = {"status": "failed", "data": None, "error": "Company research is temporarily unavailable."}
        try:
            company_result = AgentBranchResult.model_validate(company_result).model_dump()
        except ValidationError:
            logger.warning("Company Research returned an invalid result")
            company_result = {"status": "failed", "data": None, "error": "Company research returned an invalid result."}
        if isinstance(job_node_result, BaseException):
            log_failure(logger, "Job Intelligence branch failed", job_node_result)
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
        with agent_scope("skill_gap"):
            return await self._run_skill_gap(state)

    async def _run_skill_gap(self, state: dict[str, Any]) -> dict[str, Any]:
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

        company = canonical_company(values.get("company", ""), company_profile.get("name", ""))
        role = values.get("role", "")
        task_context = dict(state.get("task_context") or {})
        wf_input = state.get("workflow_input") or {}

        resume_text = (
            task_context.get("candidate_resume_text")
            or wf_input.get("resume_text")
            or wf_input.get("candidate_resume_text")
            or ""
        )
        has_user_resume = bool(resume_text.strip())

        if not has_user_resume:
            # Baseline resume so skill-gap analysis and planner can build a comprehensive study plan
            resume_text = (
                f"Candidate Software Engineer\n"
                f"Target Role: {role}\n"
                f"Skills: Core Programming, Software Engineering Fundamentals, Git, Basic System Design\n"
                f"Experience: Software Engineer with 2 years of general development experience.\n"
                f"Education: Bachelor's Degree in Computer Science\n"
            )
            task_context["candidate_resume_text"] = resume_text

        # Merge upstream results into task_context so downstream nodes can read them
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
                "has_resume": has_user_resume,
            }),
            None,
        )

        try:
            gap_report = await asyncio.wait_for(
                self.skill_gap_agent.analyze(company_profile, job_intelligence, resume_text, company, role),
                timeout=settings.interview_prep_branch_timeout_seconds,
            )
            if state.get("user_id"):
                gap_report = await drop_mastered_gaps(state["user_id"], gap_report)
                # first evidence of each skill for the user's knowledge graph
                record_in_background("recording the skill gap", "record_skill_gap", state["user_id"], gap_report)
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
        with agent_scope("research"):
            return await self._run_research(state)

    async def _run_research(self, state: dict[str, Any]) -> dict[str, Any]:
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

        # one module per gap, highest priority first (skill_gaps keeps the
        # skill-gap agent's priority order), only for gaps the plan has room
        # for and at most RESEARCH_MAX_GAPS, so research time and SerpApi
        # spend follow the plan, not the gap count; a planned gap past the
        # cap gets borrowed references, gap searches or search links
        planned = plannable_gaps(
            skill_gaps, (state.get("task_context") or {}).get("skill_gap", {}).get("priority_gaps") or [],
            state.get("plan_total_days") or settings.plan_total_days,
        )
        researched = [gap for gap in skill_gaps if gap in planned][: settings.research_max_gaps]
        skipped = [gap for gap in skill_gaps if gap not in researched]
        await dispatch_event(
            make_event("interview_prep", "research_stage", "running", {
                "message": f"Researching {len(researched)} skill gap(s)..."
                + (f" ({len(skipped)} lower-priority gap(s) not researched: no room in the plan or past the cap)"
                   if skipped else ""),
                "gaps": researched,
                "skipped": skipped,
            }),
            None,
        )

        # started alongside the gap research, not after it
        company_task = asyncio.ensure_future(self._research_company_module(state))
        try:
            result = await self.research_agent({**state, "skill_gaps": researched})
        except Exception as exc:
            logger.warning("Research stage failed: %s", exc)
            result = {"researched_materials": [], "execution_events": [], "handoffs": []}
        company_module = await company_task

        materials = result.get("researched_materials") or []
        task_context_update = {}
        if company_module:
            # first in the plan: the company's own platform is what the
            # candidate will be asked about and work with
            materials = [company_module] + materials
            task_context = dict(state.get("task_context") or {})
            skill_gap = dict(task_context.get("skill_gap") or {})
            skill_gap["priority_gaps"] = [
                {"skill": company_module["topic"], "status": "company", "effort": "High",
                 "evidence": "the target company's own platform"},
                *(skill_gap.get("priority_gaps") or []),
            ]
            task_context["skill_gap"] = skill_gap
            task_context_update = {"task_context": task_context}
            result = {**result, "researched_materials": materials}
        await dispatch_event(
            make_event("interview_prep", "research_stage", "completed", {
                "message": f"Research complete. {len(materials)} learning module(s) produced.",
                "modules_produced": len(materials),
            }),
            None,
        )

        return {
            **result,
            **task_context_update,
            "workflow_status": "evaluating",
        }

    async def _research_company_module(self, state: dict[str, Any]) -> dict[str, Any] | None:
        """COMPANY_MODULE=on: one module on the company's own platform from
        its official site and GitHub. None when off, when the profile gives
        nothing to search by, or when the research fails."""
        if settings.company_module != "on":
            return None
        task_context = state.get("task_context") or {}
        try:
            request = company_module_request(
                task_context.get("company_profile"), state.get("user_id") or "anonymous",
                task_context.get("target_role", ""), task_context.get("target_company", ""),
                focus=prep_focus(task_context.get("job_intelligence"), task_context.get("company_profile")),
            )
            if request is None:
                return None
            outcome = (await self.research_agent.research_many([request], memories=[]))[0]
        except Exception as exc:
            log_failure(logger, "Company platform module unavailable; planning skill gaps only", exc)
            return None
        module = outcome["module"] if outcome else None
        # a company whose site has no developer material (most of what came
        # back was dropped as marketing) must not get the plan's first and
        # largest slot on the strength of a couple of links
        if module and len(module.get("resources") or []) < COMPANY_MODULE_MIN_RESOURCES:
            logger.info("Company platform module dropped: only %d usable resource(s) found for %r",
                        len(module.get("resources") or []), module.get("topic"))
            return None
        return module

    async def run_planner(self, state: dict[str, Any]) -> dict[str, Any]:
        with agent_scope("planner"):
            return await self._run_planner(state)

    async def _run_planner(self, state: dict[str, Any]) -> dict[str, Any]:
        """
        Stage 4 of the pipeline: turn the skill gaps and research modules
        into a study plan in the backend's plan -> sprints -> sprint_days
        shape (agents/planner_agent.py, schemas/study_plan.py), and save it
        to PLAN_OUTPUT_DIR/<plan id>.json for review.

        Plans whenever there is at least one gap or module; a gap whose
        research failed still gets its sprint (see the planner's docstring).
        """
        values = workflow_fields.normalize_workflow_fields(state.get("interview_prep_input") or {})
        task_context = state.get("task_context") or {}
        role = values.get("role", "")
        company = task_context.get("target_company") or canonical_company(
            values.get("company", ""), task_context.get("company_profile", {}).get("name", "")
        )
        materials = state.get("researched_materials") or []
        priority_gaps = (task_context.get("skill_gap") or {}).get("priority_gaps", [])

        if not materials and not priority_gaps:
            await dispatch_event(
                make_event("interview_prep", "planning_stage", "completed", {
                    "message": "No skill gaps or research modules to plan around — planning stage skipped.",
                }),
                None,
            )
            return {"study_plan": None, "study_plan_path": None}

        await dispatch_event(
            make_event("interview_prep", "planning_stage", "running", {
                "message": f"Building a study plan for {len(priority_gaps) or len(materials)} skill(s)...",
            }),
            None,
        )

        requested_days = (
            state.get("plan_total_days")
            or resolve_plan_total_days(state)
            or settings.plan_total_days
        )

        try:
            output = await self.planner_agent.build_plan(
                materials, priority_gaps, role, company, user_id=state.get("user_id"),
                focus=prep_focus(task_context.get("job_intelligence"), task_context.get("company_profile")),
                total_days=requested_days,
            )
        except Exception as exc:
            logger.warning("Planning stage failed: %s", exc, exc_info=True)
            await dispatch_event(
                make_event("interview_prep", "planning_stage", "failed", {"error": str(exc)}),
                None,
            )
            return {"study_plan": None, "study_plan_path": None}

        saved_path = None
        if settings.plan_output_dir:
            try:
                out_dir = service_path(settings.plan_output_dir)
                saved_path = str(save_json(out_dir, f"{output['id']}.json", output))
                save_json(out_dir, "plan.json", output)
                logger.info("Study plan %s saved to %s and plan.json", output["id"], saved_path)
            except OSError:
                # the plan is still in state; a disk problem shouldn't fail the run
                logger.warning("Could not save study plan %s", output["id"], exc_info=True)

        if state.get("user_id"):
            # the plan's topics, concepts and resources for the knowledge graph
            record_in_background("recording the plan", "record_plan", state["user_id"], plan_graph_topics(output))

        # saved through the backend API for CLI runs; a run the backend
        # started is saved by the backend itself (tools/plan_db_sync.py)
        db_sync_result = await sync_generated_plan_to_db(output)
        output["db_sync"] = db_sync_result

        plan = output["plan"]
        sprints = output.get("sprints") or plan.get("sprints", [])
        await dispatch_event(
            make_event("interview_prep", "planning_stage", "completed", {
                "message": f"Study plan ready: {plan['total_days']} day(s) across {len(sprints)} sprint(s).",
                "plan_id": output["id"],
                "total_days": plan["total_days"],
                "sprints": len(sprints),
                "narrative_source": output["narrative_source"],
                "unresearched": output["coverage"]["unresearched"],
                "saved_path": saved_path,
                "db_sync": db_sync_result,
            }),
            None,
        )

        return {"study_plan": output, "study_plan_path": saved_path, "db_sync": db_sync_result}

    async def evaluate(self, state: dict[str, Any]) -> dict[str, Any]:
        with agent_scope("evaluate"):
            return await self._evaluate(state)

    async def _evaluate(self, state: dict[str, Any]) -> dict[str, Any]:

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
        response = None
        try:
            # the decision only needs each source's status and error, not
            # the raw profile JSON (which used to fill ~7,000 prompt chars
            # and push this call past its timeout)
            def brief(result: dict[str, Any]) -> dict[str, Any]:
                return {"status": result.get("status"), "error": result.get("error"),
                        "has_data": bool(result.get("data"))}

            prompt = (
                "Evaluate this combined interview-preparation result. Return JSON with action (complete, partial, failed), "
                "and a short user-facing summary. Do not ask to retry agents. A failed or empty source means partial "
                "when the other source has usable data; failed only when both failed. Do not include hidden reasoning.\n"
                + json.dumps({"company": brief(company_result), "job_market": brief(job_result)})
            )
            if settings.evaluator_llm == "off":
                # EVALUATOR_LLM=off: the status is already decided from the
                # branch results above; the model only rephrases the summary
                raise _SkipEvaluator()
            llm = get_llm(guarded=True, temperature=0, max_tokens=120,
                          profile="fast" if settings.evaluator_llm == "fast" else "default")
            response = await asyncio.wait_for(
                llm.ainvoke(prompt, config=INTERNAL_LLM_CONFIG),
                timeout=settings.interview_prep_evaluator_timeout_seconds,
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
        except _SkipEvaluator:
            pass
        except Exception as exc:
            forget_response(response)  # an unparseable answer must not be replayed from the cache
            log_failure(logger, "ReAct evaluator failed; using deterministic result status", exc)

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
            "study_plan": state.get("study_plan"),
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
        if state.get("study_plan"):
            task_context["preparation_plan"] = state["study_plan"]
        return {
            "workflow_status": action,
            "interview_prep_result": result,
            "task_context": task_context,
            "messages": [response],
            "handoffs": [handoff],
        }

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        return await self.prepare(state)


async def drop_mastered_gaps(user_id: str, gap_report: dict[str, Any]) -> dict[str, Any]:
    """The gap report without the gaps the user's knowledge graph says
    they have mastered (from earlier quizzes): a re-plan spends no days on
    them. Unchanged when the graph is unavailable or knows nothing."""
    gaps = gap_report.get("priority_gaps") or []
    names = [g.get("skill") for g in gaps if g.get("skill")]
    if not names:
        return gap_report
    graph = await best_effort("opening the graph", get_knowledge_graph, timeout=5)
    context = await best_effort("reading mastered skills", graph.study_context, user_id, names,
                                timeout=5) if graph else None
    mastered = {name.casefold() for name in (context or {}).get("mastered") or []}
    if not mastered:
        return gap_report
    logger.info("Skill gap: %d gap(s) skipped as already mastered: %s", len(mastered), sorted(mastered))
    return {**gap_report, "priority_gaps": [g for g in gaps if str(g.get("skill", "")).casefold() not in mastered],
            "mastered_in_graph": sorted(mastered)}


def plan_graph_topics(output: dict[str, Any]) -> list[dict[str, Any]]:
    """The plan's topics for the knowledge graph: each with its key
    concepts (from its learning module) and its resources."""
    modules = {m.get("topic"): m for m in output.get("learning_modules") or [] if m.get("topic")}
    topics = []
    for name in (output.get("coverage") or {}).get("days_per_topic") or {}:
        module = modules.get(name) or {}
        topics.append({
            "name": name,
            "concepts": key_concepts(module.get("content_markdown") or ""),
            "references": [{"url": r.get("url"), "title": r.get("title"), "type": kind}
                           for kind, refs in (output.get("resource_pack") or {}).items()
                           for r in refs if r.get("topic") == name],
        })
    return topics


def route_after_prepare(state: dict[str, Any]) -> str:
    status = state.get("workflow_status")
    if status == "awaiting_input":
        return "pause"
    if status == "running":
        return "run"
    return "stop"


def route_after_evaluate(state: dict[str, Any]) -> str:
    return "pause" if state.get("workflow_status") == "awaiting_input" else "save"
