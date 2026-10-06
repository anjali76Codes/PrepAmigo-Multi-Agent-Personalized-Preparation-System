"""
Generic bridge from one LangGraph chat turn to the Redis-backed SSE event
contract (streaming/models.py, streaming/publisher.py, documented in
docs/agents/SSE_STREAMING_GUIDE.md).

This is the "standard component" every specialist streams through: it
reads graph.streaming.stream_turn's normalized route/step/final items,
not agent-specific state, so a new agent needs no change here to show up
correctly on the wire — it only needs to emit graph.events.AgentEvent
steps (see agents/research_agent.py) or nothing at all (like chat, which
is just a route then a final reply).

A step's event type is chosen from keywords in its name (see
_STEP_KEYWORDS) rather than a per-agent table, so it stays correct as
agents are added. Token-level events are not forwarded: this contract is
step-level progress plus one final payload, and publishing every token
would multiply Redis traffic for a UI that doesn't render partial text.
Direct token streaming (graph/streaming.py's own tokens=True path) is
what the CLI and /api/chat use instead.
"""
import logging
from typing import Any, AsyncIterator

from graph.streaming import stream_turn
from streaming.models import EventType

logger = logging.getLogger(__name__)

# step-name keyword -> event type, checked in order; first match wins.
# Falls back to THINKING, which is the right default for a step that is
# gathering context or deciding something rather than acting on the world.
_STEP_KEYWORDS: tuple[tuple[str, EventType], ...] = (
    ("tool_", EventType.RESEARCHING),
    ("search", EventType.RESEARCHING),
    ("research", EventType.RESEARCHING),
    ("fetch", EventType.RESEARCHING),
    ("parallel", EventType.RESEARCHING),
    ("extract", EventType.STRUCTURING),
    ("synthesize", EventType.STRUCTURING),
    ("structure", EventType.STRUCTURING),
    ("generate", EventType.STRUCTURING),
    ("plan", EventType.STRUCTURING),
    ("skill_gap", EventType.PROCESSING),
    ("evaluate", EventType.THINKING),
    ("guardrail", EventType.PROCESSING),
    ("valid", EventType.PROCESSING),
    ("update", EventType.PROCESSING),
)


# the plan output's second and third copies of every day (the nested form
# and the sprint/sprintday aliases, kept for the plan file and DB sync):
# one copy is enough on the wire, and the final event is also kept in the
# run's Redis history
_PLAN_COPIES = ("nested_plan", "sprint", "sprintday")


def _wire_result(result: Any) -> Any:
    """`result` with its study plan sent once: plan, sprints and sprint_days
    (each day with its references), resource pack, coverage and db_sync."""
    plan = result.get("study_plan") if isinstance(result, dict) else None
    if not isinstance(plan, dict):
        return result
    return {**result, "study_plan": {key: value for key, value in plan.items() if key not in _PLAN_COPIES}}


def _event_type_for_step(step: str) -> EventType:
    lowered = step.lower()
    for keyword, event_type in _STEP_KEYWORDS:
        if keyword in lowered:
            return event_type
    return EventType.THINKING


async def bridge_graph_turn(graph: Any, inputs: dict, config: dict) -> AsyncIterator[tuple[EventType, dict]]:
    """Run one graph turn and yield (EventType, payload) pairs, ready for
    EventPublisher.emit_event(run_id, event_type, payload). Propagates
    whatever the graph run raises; the caller decides how to report that
    (streaming/runner.py emits a FAILED event)."""
    async for item in stream_turn(graph, inputs, config, tokens=False):
        if item["type"] == "route":
            yield EventType.CALLING_AGENT, {"agent": item["agent"], "message": f"Routed to {item['agent']}"}
        elif item["type"] == "waiting":
            payload = dict(item.get("payload", {}))
            question = payload.get("question")
            if isinstance(question, str):
                payload["question"] = {"question": question}
            yield EventType.WAITING, {**payload, "status": "awaiting_input"}
        elif item["type"] == "step":
            event = item["event"]
            details = dict(event["payload"])
            agent_name = {"research_agent": "research"}.get(event["agent"], event["agent"])
            payload = {
                "agent": agent_name,
                "step": event["step"],
                **details,
            }
            # Keep an agent-provided status (including domain outcomes such as
            # success/partial) in the canonical status field. Fall back to the
            # AgentEvent lifecycle status when the payload has none.
            payload.setdefault("status", event["status"])
            # A failed step/tool is progress metadata, not necessarily a failed
            # run (parallel searches can continue). Only the final run-level
            # failure uses EventType.FAILED and closes the SSE stream.
            yield _event_type_for_step(event["step"]), payload
        elif item["type"] == "final":
            if item["agent"] == "interview_prep":
                event_type = EventType.FAILED if item.get("status") == "failed" else EventType.COMPLETED
                yield event_type, {
                    "agent": item["agent"],
                    "status": item.get("status", "partial"),
                    "message": item["content"],
                    "result": _wire_result(item.get("result")),
                }
            elif item["agent"] == "interview_intelligence":
                # without "agent" the publisher labelled this event "system"
                yield EventType.COMPLETED, {"agent": item["agent"], "message": item["content"]}
            elif item["agent"] == "company_research":
                task_context = item.get("task_context") or {}
                yield EventType.COMPLETED, {
                    "agent": item["agent"],
                    "status": "success",
                    "message": item["content"],
                    "company_profile": task_context.get("company_profile") or {},
                }
            else:
                yield EventType.COMPLETED, {
                    "agent": item["agent"], "status": "success", "message": item["content"]
                }
        # "token" items: stream_turn(tokens=False) still emits the reply as
        # one token item ahead of "final" (see graph/streaming.py); the
        # "final" item above already carries that same text, so it's skipped
