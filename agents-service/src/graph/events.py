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
import asyncio
import inspect
import json
import time
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
    # not inside a LangGraph run: langgraph raises RuntimeError in some
    # versions, KeyError('__pregel_runtime') in others (confirmed via a
    # standalone tool.invoke() call outside any graph, e.g. direct unit
    # tests or CLI tool R&D) — either way, there's no stream to write to
    except (RuntimeError, KeyError):
        return
    writer(event)


def _tool_name(tool: Any, fallback_name: str | None = None) -> str:
    return str(
        getattr(tool, "name", None)
        or getattr(tool, "__name__", None)
        or fallback_name
        or type(tool).__name__
    )


def _tool_input_summary(tool_input: Any) -> dict[str, Any]:
    """Keep useful search context without copying arbitrary tool inputs."""
    if not isinstance(tool_input, dict):
        return {}
    summary: dict[str, Any] = {}
    for key in ("query", "q", "topic", "company_name", "location", "limit", "engine", "video_id"):
        value = tool_input.get(key)
        if isinstance(value, (str, int, float)):
            summary["query" if key == "q" else key] = value[:240] if isinstance(value, str) else value
    return summary


def summarize_tool_input(tool_input: Any) -> dict[str, Any]:
    return _tool_input_summary(tool_input)


def _tool_result_summary(result: Any) -> dict[str, Any]:
    result = _tool_result_object(result)
    if result is None:
        return {}
    summary: dict[str, Any] = {}
    source = result.get("source")
    if isinstance(source, str):
        summary["source"] = source
    for key in ("results", "jobs_results", "news_results", "organic_results"):
        value = result.get(key)
        if isinstance(value, list):
            summary["result_count"] = len(value)
            break
    return summary


def _tool_result_object(result: Any) -> dict[str, Any] | None:
    if isinstance(result, str):
        try:
            result = json.loads(result)
        except (TypeError, ValueError):
            return None
    return result if isinstance(result, dict) else None


def summarize_tool_result(result: Any) -> dict[str, Any]:
    return _tool_result_summary(result)


def _emit_tool_state(
    agent: str,
    tool_name: str,
    status: StepStatus,
    payload: dict[str, Any] | None = None,
) -> None:
    details = {"tool": tool_name, **(payload or {})}
    details.setdefault("message", f"Tool {tool_name} {status}.")
    emit_to_graph_stream(make_event(agent, f"tool_{tool_name}", status, details))


def emit_tool_event(
    agent: str,
    tool: Any,
    status: StepStatus,
    payload: dict[str, Any] | None = None,
) -> None:
    """Emit a tool lifecycle event, deriving its name from the runtime tool."""
    name = tool if isinstance(tool, str) else _tool_name(tool)
    _emit_tool_state(agent, name, status, payload)


async def invoke_tool_with_events(
    tool: Any,
    tool_input: Any,
    *,
    agent: str,
    timeout: float | None = None,
    fallback_name: str | None = None,
    invoke: Callable[[], Any] | None = None,
) -> tuple[Any, dict[str, Any]]:
    """Invoke a tool and emit generic lifecycle events using its runtime name."""
    name = _tool_name(tool, fallback_name)
    input_summary = _tool_input_summary(tool_input)
    _emit_tool_state(agent, name, "running", input_summary)
    started = time.perf_counter()

    if invoke is None:
        method = getattr(tool, "invoke", None)
        if method is not None:
            invoke = lambda: method(tool_input)
        elif callable(tool) and isinstance(tool_input, dict):
            invoke = lambda: tool(**tool_input)
        else:
            invoke = lambda: tool(tool_input)

    try:
        work = asyncio.to_thread(invoke)
        result = await asyncio.wait_for(work, timeout=timeout) if timeout else await work
    except Exception as exc:
        duration_ms = round((time.perf_counter() - started) * 1000, 1)
        # str(TimeoutError()) is "", which told the client nothing
        timed_out = isinstance(exc, asyncio.TimeoutError) and timeout
        error = f"timed out after {timeout:g}s" if timed_out else str(exc) or type(exc).__name__
        details = {
            **input_summary,
            "duration_ms": duration_ms,
            "error": error[:240],
            "message": f"Tool {name} failed.",
        }
        _emit_tool_state(agent, name, "failed", details)
        raise

    duration_ms = round((time.perf_counter() - started) * 1000, 1)
    result_object = _tool_result_object(result)  # parsed once: tools may return JSON strings
    result_summary = _tool_result_summary(result_object)
    details = {**result_summary, "duration_ms": duration_ms}
    failure = result_object.get("error") if result_object else None
    if not failure and result_object:
        metadata = result_object.get("search_metadata")
        if isinstance(metadata, dict) and metadata.get("status") == "Error":
            failure = metadata.get("error") or "Tool returned an error"
    if failure:
        details.update(error=str(failure)[:240], message=f"Tool {name} returned an error.")
        _emit_tool_state(agent, name, "failed", details)
        return result, {**result_summary, "duration_ms": duration_ms, "failed": True}
    if "result_count" in result_summary:
        details["message"] = f"Tool {name} returned {result_summary['result_count']} results."
    _emit_tool_state(agent, name, "completed", details)
    return result, {**result_summary, "duration_ms": duration_ms}


def format_sse(event: AgentEvent) -> str:
    """Encode an event as one Server-Sent Events frame."""
    return f"event: {event['step']}\ndata: {json.dumps(event, default=str)}\n\n"
