import asyncio
import logging
import os
from typing import Any, Dict, Optional

from .models import EventType
from .publisher import EventPublisher, get_event_publisher

logger = logging.getLogger(__name__)


async def run_dummy_agent_stream(
    run_id: str,
    query: str,
    publisher: EventPublisher,
    thread_id: str,
    step_delay: float = 1.0,
) -> None:
    """Simulates realistic multi-agent step-by-step execution for testing and UI development."""
    logger.info("[Dummy Stream] Starting simulated agent execution for query: %s", query)

    # 1. Thinking (6.0s)
    await publisher.emit_event(
        run_id=run_id,
        event_type=EventType.THINKING,
        payload={
            "node": "supervisor",
            "message": f"Supervisor analyzing travel query: '{query}'...",
            "next_agent": "flight_booking",
        },
    )
    if step_delay > 0:
        await asyncio.sleep(6.0 * step_delay)

    # 2. Calling specialist agent (6.0s)
    await publisher.emit_event(
        run_id=run_id,
        event_type=EventType.CALLING_AGENT,
        payload={
            "agent": "flight_booking",
            "message": "Invoked Flight Booking Specialist to formulate flight search query...",
        },
    )
    if step_delay > 0:
        await asyncio.sleep(6.0 * step_delay)

    # 3. Researching / Tool execution (2.5s)
    await publisher.emit_event(
        run_id=run_id,
        event_type=EventType.RESEARCHING,
        payload={
            "node": "tools",
            "tool": "search_flights",
            "message": "Searching flight availability and comparing airline pricing...",
            "parameters": {"route": query, "departure": "2026-10-15"},
        },
    )
    if step_delay > 0:
        await asyncio.sleep(2.5 * step_delay)

    # 4. Safety & Guardrails (6.0s)
    await publisher.emit_event(
        run_id=run_id,
        event_type=EventType.PROCESSING,
        payload={
            "node": "guardrails",
            "message": "Running budget validation, PII safety checks, and policy compliance...",
            "guardrail_flags": {"pii_check": "pass", "budget_check": "pass"},
        },
    )
    if step_delay > 0:
        await asyncio.sleep(6.0 * step_delay)

    # 5. Structuring final payload (1.5s)
    await publisher.emit_event(
        run_id=run_id,
        event_type=EventType.STRUCTURING,
        payload={
            "message": "Formatting verified flight options into structured itinerary format...",
        },
    )
    if step_delay > 0:
        await asyncio.sleep(1.5 * step_delay)

    # 6. Completed (~10s total elapsed)

    # 6. Completed
    await publisher.emit_event(
        run_id=run_id,
        event_type=EventType.COMPLETED,
        payload={
            "status": "success",
            "threadId": thread_id,
            "message": f"Found 3 best flight options for '{query}' with top recommendation on Air France at $480.",
            "flights": [
                {"airline": "Air France", "price": "$480", "duration": "7h 45m", "stops": "Direct"},
                {"airline": "Delta Airlines", "price": "$520", "duration": "8h 10m", "stops": "1 Stop"},
                {"airline": "British Airways", "price": "$550", "duration": "8h 30m", "stops": "1 Stop"},
            ],
        },
    )
    logger.info("[Dummy Stream] Completed simulated run %s", run_id)


async def execute_agent_stream(
    run_id: str,
    query: str,
    graph: Any = None,
    publisher: Optional[EventPublisher] = None,
    thread_id: Optional[str] = None,
    user_id: Optional[str] = None,
    use_dummy: Optional[bool] = None,
    workflow_mode: Optional[str] = None,
    workflow_input: Optional[Dict[str, Any]] = None,
    workflow_text_input: Optional[str] = None,
    resume_input: Optional[Dict[str, Any]] = None,
) -> None:
    """Executes the agent workflow. Uses dummy simulation if configured or
    if LLM is unavailable. The real path is agent-agnostic: whichever
    specialist the supervisor routes to (chat, research, ...) streams
    through streaming/langgraph_bridge.py without this function knowing
    about it by name. `user_id` enables long-term memory for agents that
    use it (e.g. content research)."""
    pub = publisher or get_event_publisher()
    tid = thread_id or f"run-{run_id}"

    if use_dummy is None:
        use_dummy = os.getenv("USE_DUMMY_STREAM", "true").strip().lower() in {"true", "1", "yes"}
    if workflow_mode == "interview_prep":
        use_dummy = False

    if workflow_mode == "interview_prep" and graph is None:
        await pub.emit_event(
            run_id=run_id,
            event_type=EventType.FAILED,
            payload={"status": "failed", "detail": "The interview-preparation workflow is unavailable."},
        )
        return
    if use_dummy or graph is None:
        await run_dummy_agent_stream(run_id=run_id, query=query, publisher=pub, thread_id=tid)
        return

    from langchain_core.messages import HumanMessage
    from langgraph.types import Command

    from graph.errors import friendly_error_detail
    from streaming.langgraph_bridge import bridge_graph_turn

    logger.info("Starting LangGraph streaming run %s (thread: %s, user: %s)", run_id, tid, user_id or "anonymous")
    config = {"configurable": {"thread_id": tid}}
    if resume_input is not None:
        inputs: Any = Command(resume=resume_input)
    else:
        inputs = {
            "messages": [HumanMessage(content=query)],
            "workflow_mode": workflow_mode,
            "workflow_input": workflow_input or {},
            "workflow_text_input": workflow_text_input,
            "interview_prep_input": {},
            "workflow_clarification_rounds": 0,
        }
        if workflow_mode == "interview_prep":
            inputs["workflow_input"] = workflow_input or {}
        if user_id:
            inputs["user_id"] = user_id

    await pub.emit_event(
        run_id=run_id,
        event_type=EventType.THINKING,
        payload={"message": "Received request. Determining which agent should handle it...", "query": query},
    )

    try:
        async for event_type, payload in bridge_graph_turn(graph, inputs, config):
            await pub.emit_event(run_id=run_id, event_type=event_type, payload=payload)
    except Exception as exc:
        # the traceback goes to the server log only; a client-facing
        # payload should never carry raw internals (see graph/errors.py)
        logger.exception("Agent streaming run %s encountered error: %s", run_id, exc)
        await pub.emit_event(
            run_id=run_id,
            event_type=EventType.FAILED,
            # "error" keeps the raw exception text (existing contract, for
            # logs/debugging on the client side); "detail" is the
            # user-facing message main.py's /api/chat also uses
            payload={"error": str(exc), "detail": friendly_error_detail(exc), "status": "error"},
        )
