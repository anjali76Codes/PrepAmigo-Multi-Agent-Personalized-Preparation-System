"""Extract interview-research inputs, run the research pipeline, and reply."""
import json
import logging
import re
from typing import Any

from langchain_core.messages import AIMessage, SystemMessage

from agents.base import recent_messages
from agents.interview_intelligence_agent import (
    InterviewIntelligenceAgent,
    InterviewIntelligenceError,
    InterviewIntelligenceRequest,
)
from core.config import get_llm
from graph.events import INTERNAL_LLM_CONFIG
from prompts.interview_intelligence_prompts import INTERVIEW_REQUEST_EXTRACTION_PROMPT

logger = logging.getLogger(__name__)
EXTRACTION_HISTORY = 6


def parse_interview_request(text: str) -> dict[str, str | None]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    try:
        data = json.loads(match.group(0)) if match else {}
    except json.JSONDecodeError:
        data = {}
    if not isinstance(data, dict):
        data = {}
    fields = ("target_company", "target_role")
    return {
        field: data[field].strip() if isinstance(data.get(field), str) and data[field].strip() else None
        for field in fields
    }


class InterviewIntelligenceNode:
    name = "interview_intelligence"

    def __init__(self, agent: InterviewIntelligenceAgent | None = None, llm: Any | None = None):
        self.agent = agent or InterviewIntelligenceAgent()
        self._llm = llm

    @property
    def llm(self):
        if self._llm is None:
            self._llm = get_llm(temperature=0)
        return self._llm

    async def __call__(self, state: dict) -> dict:
        facts = "\n".join(f"- {item}" for item in (state.get("memory_context") or [])) or "- none"
        response = await self.llm.ainvoke([
            SystemMessage(content=INTERVIEW_REQUEST_EXTRACTION_PROMPT.format(facts=facts)),
            *recent_messages(state.get("messages", []), EXTRACTION_HISTORY),
        ], config=INTERNAL_LLM_CONFIG)
        extracted = parse_interview_request(str(response.content))
        missing = [field.replace("target_", "") for field, value in extracted.items() if not value]
        if missing:
            requested = " and ".join(missing)
            return {"messages": [AIMessage(
                content=f"Which {requested} should I research? Please include both the company and role."
            )]}

        try:
            request = InterviewIntelligenceRequest(**extracted)
            result = await self.agent.run(request)
        except (ValueError, InterviewIntelligenceError) as exc:
            logger.warning("Interview intelligence request failed: %s", exc)
            return {"messages": [AIMessage(
                content="I couldn't complete the interview research this time. Please try again shortly."
            )]}

        brief = result["brief"]
        reply = brief["content_markdown"]
        if brief["uses_mock_sources"]:
            reply += "\n\n_Search ran in mock mode because SERPAPI_API_KEY is not configured; these are search-page links, not researched findings._"
        if brief["source_errors"]:
            unavailable = ", ".join(sorted(brief["source_errors"]))
            reply += f"\n\n_Note: some sources were unavailable during this run ({unavailable}); treat the brief as partial._"
        return {
            "messages": [AIMessage(content=reply)],
            "researched_materials": [brief],
            "execution_events": result["events"],
            "handoffs": [result["handoff"]],
        }