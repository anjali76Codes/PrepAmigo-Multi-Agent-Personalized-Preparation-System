"""
Supervisor: the graph's traffic controller. Classifies the latest user
message and decides which specialist node runs next. Kept separate from
BaseAgent because it returns a routing decision, not a chat message.

The model gets one compact classification prompt (specialists, a short
excerpt of recent context, the latest message, then the instruction)
rather than the chat transcript: given a transcript, chat models tend to
continue the conversation instead of emitting a label.
"""
import logging
import re

from langchain_core.messages import BaseMessage, HumanMessage

from agents.registry import DEFAULT_SPECIALIST, SPECIALISTS, SPECIALIST_NAMES
from core.config import get_llm
from graph.events import INTERNAL_LLM_CONFIG
from prompts.system_prompts import SUPERVISOR_PROMPT

logger = logging.getLogger(__name__)

# context the classifier sees besides the latest message
CONTEXT_MESSAGES = 4
CONTEXT_CHARS_PER_MESSAGE = 300


def build_supervisor_prompt(messages: list[BaseMessage]) -> str:
    latest_index = next(
        (i for i in range(len(messages) - 1, -1, -1) if isinstance(messages[i], HumanMessage)), None
    )
    latest = messages[latest_index].content if latest_index is not None else ""
    earlier = messages[:latest_index][-CONTEXT_MESSAGES:] if latest_index else []
    context = "\n".join(
        f"{'User' if isinstance(m, HumanMessage) else 'Assistant'}: {str(m.content)[:CONTEXT_CHARS_PER_MESSAGE]}"
        for m in earlier
    ) or "(none)"
    return SUPERVISOR_PROMPT.format(
        specialists="\n".join(f"- {s.name}: {s.description}" for s in SPECIALISTS),
        context=context,
        message=latest,
        names=" or ".join(s.name for s in SPECIALISTS),
    )


def parse_decision(text: str) -> str | None:
    """The single specialist name mentioned in `text`, else None."""
    text = text.strip().lower()
    found = [name for name in SPECIALIST_NAMES if re.search(rf"\b{re.escape(name)}\b", text)]
    return found[0] if len(found) == 1 else None


def supervisor_node(state: dict) -> dict:
    llm = get_llm(temperature=0)
    reply = llm.invoke(
        [HumanMessage(content=build_supervisor_prompt(state["messages"]))], config=INTERNAL_LLM_CONFIG
    )
    decision = parse_decision(str(reply.content))
    if decision is None:
        logger.warning(
            "Supervisor returned no single valid agent (%r); using %s",
            str(reply.content)[:200],
            DEFAULT_SPECIALIST,
        )
        decision = DEFAULT_SPECIALIST
    return {"next_agent": decision}
