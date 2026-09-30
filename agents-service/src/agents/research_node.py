"""
Chat-graph adapter for the Content Research Agent.

The research agent needs a structured ResearchRequest; chat gives us free
text. This node asks the LLM to extract {topic, target_role,
target_company, depth_hint} from the conversation plus recalled memories,
runs the agent (its step events flow to LangGraph's custom stream and,
via streaming/langgraph_bridge.py, to the Redis-backed SSE pipeline), and
replies with the learning module — nothing appended after it that the LLM
didn't write, since the module's own "Curated Resources" section already
cites every source.
"""
import json
import logging
import re
from typing import Any

from langchain_core.messages import AIMessage, SystemMessage

from agents.base import recent_messages
from agents.research_agent import ContentResearchAgent, ResearchAgentError, ResearchRequest
from config import get_llm
from graph.events import INTERNAL_LLM_CONFIG
from prompts.research_prompts import RESEARCH_REQUEST_EXTRACTION_PROMPT

logger = logging.getLogger(__name__)

# used when neither the message nor memory names a role/company
DEFAULT_ROLE = "Software Engineer"
DEFAULT_COMPANY = "top tech companies"
# the topic/role/company are almost always in the last few turns
EXTRACTION_HISTORY = 6


def parse_research_request(text: str) -> dict[str, str | None]:
    """Pull the first JSON object out of an LLM reply; missing or blank
    fields become None."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    try:
        data = json.loads(match.group(0)) if match else {}
    except json.JSONDecodeError:
        data = {}
    if not isinstance(data, dict):
        data = {}
    fields = ("topic", "target_role", "target_company", "depth_hint")
    return {
        field: data[field].strip() if isinstance(data.get(field), str) and data[field].strip() else None
        for field in fields
    }


def format_module_reply(module: dict[str, Any]) -> str:
    """The LLM's markdown as-is, plus a mock-mode notice if it applies.
    No appended source list: the module's own "## Curated Resources"
    section already cites every link, and the user won't read a second one."""
    reply = module["content_markdown"].rstrip()
    if module.get("uses_mock_sources"):
        reply += "\n\n_Search ran in mock mode using placeholders or local JSON fixtures, not live research._"
    return reply


class ResearchNode:
    name = "research"

    def __init__(self, agent: ContentResearchAgent | None = None, llm: Any | None = None):
        self.agent = agent or ContentResearchAgent()
        self._llm = llm

    @property
    def llm(self):
        if self._llm is None:
            self._llm = get_llm(temperature=0)
        return self._llm

    async def __call__(self, state: dict) -> dict:
        user_id = state.get("user_id")
        if not user_id:
            return {"messages": [AIMessage(
                content="I can research learning material once I know who you are. Please send a user_id with your message."
            )]}

        memories = state.get("memory_context") or []
        facts = "\n".join(f"- {m}" for m in memories) or "- none"
        reply = await self.llm.ainvoke([
            SystemMessage(content=RESEARCH_REQUEST_EXTRACTION_PROMPT.format(facts=facts)),
            *recent_messages(state["messages"], EXTRACTION_HISTORY),
        ], config=INTERNAL_LLM_CONFIG)
        extracted = parse_research_request(str(reply.content))
        if not extracted["topic"]:
            return {"messages": [AIMessage(
                content="Which topic or skill should I research for you? For example: \"dynamic programming\" or \"system design\"."
            )]}

        try:
            request = ResearchRequest(
                user_id=user_id,
                target_role=extracted["target_role"] or DEFAULT_ROLE,
                target_company=extracted["target_company"] or DEFAULT_COMPANY,
                topic_or_skill_gap=extracted["topic"],
                depth_hint=extracted["depth_hint"],
            )
            # reuse this turn's recall instead of searching memory again
            result = await self.agent.run(request, memories=memories)
        except (ValueError, ResearchAgentError) as exc:
            logger.warning("Research request failed: %s", exc)
            return {"messages": [AIMessage(
                content=f"I couldn't finish researching that ({exc}). Please try again or rephrase the topic."
            )]}

        module = result["module"]
        return {
            "messages": [AIMessage(content=format_module_reply(module))],
            "researched_materials": [module],
            "execution_events": result["events"],
            "handoffs": [result["handoff"]],
        }
