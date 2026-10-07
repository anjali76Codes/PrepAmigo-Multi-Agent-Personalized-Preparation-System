"""
Graph nodes that connect the chat graph to long-term memory:

  load_memory  (runs in parallel with the supervisor)
      Recall the user's memories relevant to the latest message into
      state["memory_context"], and reset the per-turn state lists.

  save_memory  (last node)
      Hand the latest exchange (user message + assistant reply) to the
      memory provider in the background; mem0 decides which facts to keep.
      The reply is not held up by the save. Call drain_pending_saves()
      before shutdown so queued saves are not lost.

Memory is enrichment: if the provider fails, the turn still completes.
Both nodes skip memory when the request carries no user_id.
"""
import asyncio
import logging
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage

from memory.store import get_memory_provider

logger = logging.getLogger(__name__)

MEMORY_RECALL_LIMIT = 5
# the assistant reply is context for fact extraction, not a fact source;
# capping it keeps long learning modules from inflating extraction cost
ASSISTANT_CONTEXT_CHARS = 1000

_pending_saves: set[asyncio.Task] = set()


def _latest_exchange(state: dict) -> tuple[str, str]:
    """(latest user message, assistant reply that followed it)."""
    messages = state.get("messages", [])
    for index in range(len(messages) - 1, -1, -1):
        message = messages[index]
        if isinstance(message, HumanMessage) and isinstance(message.content, str):
            reply = next(
                (m for m in messages[index + 1:] if isinstance(m, AIMessage) and isinstance(m.content, str)),
                None,
            )
            return message.content.strip(), (reply.content.strip() if reply else "")
    return "", ""


async def load_memory(state: dict) -> dict:
    # None resets the per-turn lists (see graph.state.append_or_reset)
    turn_reset: dict[str, Any] = {"execution_events": None, "researched_materials": None, "handoffs": None}
    user_id = state.get("user_id")
    query, _ = _latest_exchange(state)
    website_context = str(
        (state.get("workflow_input") or {}).get("website_context") or ""
    ).strip()
    website_context_entry = (
        [f"Relevant content from this user's PrepAmigo profile, plan, sprints, and resources:\n{website_context}"]
        if website_context
        else []
    )
    if not user_id:
        return {**turn_reset, "memory_context": website_context_entry}
    if state.get("workflow_mode") == "interview_prep":
        # Website workflow requests often put the target in structured
        # fields while the chat message is only a generic "make a plan".
        # Include those fields in the existing memory search so its recalled
        # context is relevant to preparation, without searching resume text.
        from agents import interview_prep_fields

        values = interview_prep_fields.normalize_workflow_fields(
            state.get("interview_prep_input") or state.get("workflow_input") or {}
        )
        target = " ".join(f"{name}: {value}" for name, value in values.items() if value)
        if target:
            query = "\n".join(part for part in (
                query,
                f"Interview preparation target: {target}",
            ) if part)
    if not query:
        return {**turn_reset, "memory_context": website_context_entry}
    try:
        memories = await get_memory_provider().search(query, user_id, limit=MEMORY_RECALL_LIMIT)
    except Exception:
        logger.warning("Memory recall failed for user %s; continuing without it", user_id, exc_info=True)
        return {**turn_reset, "memory_context": website_context_entry}
    recalled = [m["memory"] for m in memories if m["memory"]]
    return {**turn_reset, "memory_context": [*website_context_entry, *recalled]}


async def save_memory(state: dict) -> dict:
    user_id = state.get("user_id")
    user_text, reply = _latest_exchange(state)
    if user_id and user_text:
        messages = [{"role": "user", "content": user_text}]
        if reply:
            messages.append({"role": "assistant", "content": reply[:ASSISTANT_CONTEXT_CHARS]})
        task = asyncio.create_task(_save(messages, user_id))
        _pending_saves.add(task)
        task.add_done_callback(_pending_saves.discard)
    return {}


async def _save(messages: list[dict[str, str]], user_id: str) -> None:
    try:
        await get_memory_provider().add(messages, user_id, metadata={"source": "chat"})
    except Exception:
        logger.warning("Memory save failed for user %s", user_id, exc_info=True)


async def drain_pending_saves(timeout: float = 15.0) -> None:
    """Wait for background saves still in flight (call on shutdown)."""
    if _pending_saves:
        await asyncio.wait(set(_pending_saves), timeout=timeout)
