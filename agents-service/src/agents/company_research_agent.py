"""
Company Research Agent
-----------------------
Specialist agent responsible for producing a comprehensive company dossier
for interview preparation candidates.

Inherits BaseAgent which:
  - Binds the LLM + tool list together (llm.bind_tools)
  - Injects the system prompt as a SystemMessage on every invocation
  - Is directly callable as a LangGraph node: (state) -> {"messages": [response], "task_context": task_context}

Tools (exactly 2 SerpApi-backed data sources):
  - search_company_overview (Google Search — facts, products, tech stack, culture, discussions)
  - search_company_news     (Google News — recent developments, launches, funding)

Wiring (in graph/builder.py and interview_prep_orchestrator.py):
  company_research -> cr_guardrails -> cr_tools -> company_research (loop until no tool_calls)
"""

import json
import logging
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agents.base import BaseAgent
from graph.events import emit_to_graph_stream, make_event
from prompts.system_prompts import COMPANY_RESEARCH_PROMPT
from tools.company_research_tools import COMPANY_RESEARCH_TOOLS, normalize_company_profile

logger = logging.getLogger(__name__)


def _extract_company_from_messages(messages: list) -> str:
    """
    Try to recover the company name from the original HumanMessage when the
    knowledge_graph has no title (common for AI-research companies like Anthropic).

    Handles two cases:
      1. Orchestrator input: last line of HumanMessage is a JSON dict with a "company" key.
         e.g. {"company": "Anthropic", "role": "ML Engineer"}
      2. CLI / chat input: plain text query. We don't parse this — the LLM already
         extracted the company name when it formed the tool call, so returning "" is fine.
    """
    for msg in messages:
        if not isinstance(msg, HumanMessage):
            continue
        content = getattr(msg, "content", "") or ""
        # Try each line in reverse: orchestrator puts JSON on the last line
        for line in reversed(content.strip().splitlines()):
            stripped = line.strip()
            if not stripped.startswith("{"):
                continue
            try:
                data = json.loads(stripped)
                if isinstance(data, dict) and data.get("company"):
                    return data["company"].strip()
            except (json.JSONDecodeError, ValueError):
                pass
        break  # Only inspect the first HumanMessage
    return ""


class CompanyResearchAgent(BaseAgent):
    name = "company_research"
    system_prompt = COMPANY_RESEARCH_PROMPT
    tools = COMPANY_RESEARCH_TOOLS

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        task_context = dict(state.get("task_context") or {})
        messages = list(state.get("messages", []))

        # ------------------------------------------------------------------
        # Parse ToolMessages from the most recent tool-call batch.
        # We only look at messages after the last AIMessage that had tool_calls,
        # to avoid reprocessing tool outputs from earlier turns on long threads.
        # ------------------------------------------------------------------
        search_data: dict = {}
        news_data: dict = {}
        detected_company: str = ""
        has_tool_messages: bool = False

        # Find the slice of messages that belong to the current tool-call round
        last_ai_with_tools_idx = -1
        for i, msg in enumerate(messages):
            if getattr(msg, "tool_calls", None):
                last_ai_with_tools_idx = i

        recent_messages = messages[last_ai_with_tools_idx + 1:] if last_ai_with_tools_idx >= 0 else messages

        for msg in recent_messages:
            tool_name = getattr(msg, "name", None)
            content = getattr(msg, "content", None)
            if not content or not isinstance(content, str):
                continue

            if tool_name in {"search_company_overview", "search_company_info"}:
                has_tool_messages = True
                try:
                    parsed = json.loads(content)
                    if isinstance(parsed, dict) and parsed.get("search_metadata", {}).get("status") != "Error":
                        search_data = parsed
                        # Prefer the KG title as the authoritative company name
                        kg_title = parsed.get("knowledge_graph", {}).get("title")
                        if kg_title:
                            detected_company = kg_title
                except Exception as exc:
                    logger.warning("[CompanyResearchAgent] Failed to parse search tool output: %s", exc)

            elif tool_name == "search_company_news":
                has_tool_messages = True
                try:
                    parsed = json.loads(content)
                    if isinstance(parsed, dict) and parsed.get("search_metadata", {}).get("status") != "Error":
                        news_data = parsed
                except Exception as exc:
                    logger.warning("[CompanyResearchAgent] Failed to parse news tool output: %s", exc)

        # ------------------------------------------------------------------
        # Normalize tool outputs into task_context["company_profile"]
        # ------------------------------------------------------------------
        company_name: str = ""
        if search_data or news_data:
            existing_profile = task_context.get("company_profile", {})
            # Resolution order: KG title > existing profile > orchestrator JSON > fallback
            company_name = (
                detected_company
                or existing_profile.get("name", "")
                or _extract_company_from_messages(messages)
                or "the company"
            )
            try:
                task_context["company_profile"] = normalize_company_profile(
                    company_name=company_name,
                    search_data=search_data,
                    news_data=news_data,
                )
                emit_to_graph_stream(
                    make_event(
                        "company_research",
                        "structure_company_profile",
                        "completed",
                        {
                            "company": company_name,
                            "message": f"Normalized company profile and tech stack signals for {company_name}.",
                            "has_description": bool(search_data.get("knowledge_graph", {}).get("description")),
                            "news_count": len(news_data.get("news_results", [])),
                            "organic_count": len(search_data.get("organic_results", [])),
                        },
                    )
                )
            except Exception as exc:
                logger.error("[CompanyResearchAgent] Error normalizing company profile: %s", exc)

        # ------------------------------------------------------------------
        # Emit SSE step events based on which turn we're on
        # ------------------------------------------------------------------
        if not has_tool_messages:
            emit_to_graph_stream(
                make_event(
                    "company_research",
                    "identify_company_scope",
                    "running",
                    {"message": "Analyzing query and determining company research scope..."},
                )
            )
        else:
            emit_to_graph_stream(
                make_event(
                    "company_research",
                    "synthesize_company_dossier",
                    "running",
                    {
                        "company": company_name,
                        "message": f"Synthesizing comprehensive company dossier for {company_name or 'the company'}...",
                    },
                )
            )

        # ------------------------------------------------------------------
        # Invoke LLM with bound tools — full message history gives LLM access
        # to the tool outputs for synthesis
        # ------------------------------------------------------------------
        prompt_messages = [SystemMessage(content=self.system_prompt), *messages]
        response = await self.llm.ainvoke(prompt_messages)

        if has_tool_messages and not getattr(response, "tool_calls", None):
            emit_to_graph_stream(
                make_event(
                    "company_research",
                    "synthesize_company_dossier",
                    "completed",
                    {
                        "company": company_name,
                        "message": "Company dossier synthesized successfully.",
                    },
                )
            )

        # Return contract is fixed — orchestrator reads messages[-1] and task_context["company_profile"]
        return {
            "messages": [response],
            "task_context": task_context,
        }
