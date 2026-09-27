"""
Standard step events every agent emits, so a streaming endpoint (SSE) can
relay progress without knowing agent internals.

  {"agent": "research_agent", "step": "execute_searches",
   "status": "running" | "completed" | "failed",
   "payload": {...}, "timestamp": "2026-01-01T00:00:00+00:00"}

Agents deliver events three ways; consumers pick whichever fits:
  - async iteration (agent.astream(...))
  - an on_event callback
  - LangGraph's custom stream, when running as a graph node:
    graph.astream(..., stream_mode="custom")
"""
import inspect
import json
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Literal

from langgraph.constants import TAG_NOSTREAM
from typing_extensions import TypedDict

# config for internal LLM calls (routing, extraction) whose output is not
# the user-facing reply: LangGraph leaves them out of stream_mode="messages"
INTERNAL_LLM_CONFIG = {"tags": [TAG_NOSTREAM]}

StepStatus = Literal["running", "completed", "failed"]


class AgentEvent(TypedDict):
    agent: str
    step: str
    status: StepStatus
    payload: dict[str, Any]
    timestamp: str


EventCallback = Callable[[AgentEvent], Awaitable[None] | None]


def make_event(
    agent: str, step: str, status: StepStatus, payload: dict[str, Any] | None = None
) -> AgentEvent:
    return {
        "agent": agent,
        "step": step,
        "status": status,
        "payload": payload or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def dispatch_event(event: AgentEvent, callback: EventCallback | None) -> None:
    """Send an event to a sync or async callback, and to LangGraph's custom
    stream if we are executing inside a graph run."""
    if callback is not None:
        result = callback(event)
        if inspect.isawaitable(result):
            await result
    emit_to_graph_stream(event)


def emit_to_graph_stream(event: AgentEvent) -> None:
    from langgraph.config import get_stream_writer

    try:
        writer = get_stream_writer()
    except RuntimeError:  # not inside a LangGraph run
        return
    writer(event)


def format_sse(event: AgentEvent) -> str:
    """Encode an event as one Server-Sent Events frame."""
    return f"event: {event['step']}\ndata: {json.dumps(event, default=str)}\n\n"
