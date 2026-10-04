"""
Generic streaming runner for PrepAmigo agents.

Two execution paths:
  - Live (default, USE_DUMMY_STREAM=false): runs the real LangGraph multi-agent
    pipeline and streams structured SSE events via streaming/langgraph_bridge.py.
  - Dummy (USE_DUMMY_STREAM=true): emits scripted PrepAmigo-themed events for
    UI development without a running LLM.

The interview_prep workflow always runs the real graph regardless of
USE_DUMMY_STREAM, because its structured output (study plan JSON) cannot be
meaningfully faked.
"""
import asyncio
import json
import logging
from typing import Any, Dict, Optional

from core.config import settings
from observability.metrics import collect_metrics

from .models import EventType
from .publisher import EventPublisher, get_event_publisher

logger = logging.getLogger(__name__)


async def run_dummy_agent_stream(
    run_id: str,
    query: str,
    publisher: EventPublisher,
    thread_id: str,
    step_delay: Optional[float] = None,
) -> None:
    """Simulates PrepAmigo multi-agent step-by-step execution with scripted events.
    Only active when USE_DUMMY_STREAM=true. The default (false) runs real agents."""
    delay = step_delay if step_delay is not None else settings.dummy_stream_step_delay
    logger.info("[Dummy Stream] Starting simulated run for query: %s", query)

    # 1. Thinking
    await publisher.emit_event(
        run_id=run_id,
        event_type=EventType.THINKING,
        payload={
            "node": "supervisor",
            "message": f"Analyzing your interview preparation request: '{query}'...",
        },
    )
    if delay > 0:
        await asyncio.sleep(3.0 * delay)

    # 2. Calling specialist
    await publisher.emit_event(
        run_id=run_id,
        event_type=EventType.CALLING_AGENT,
        payload={
            "agent": "interview_prep",
            "message": "Routing to Interview Preparation specialist...",
        },
    )
    if delay > 0:
        await asyncio.sleep(2.0 * delay)

    # 3. Researching company
    await publisher.emit_event(
        run_id=run_id,
        event_type=EventType.RESEARCHING,
        payload={
            "node": "company_research",
            "message": "Researching company profile and engineering culture...",
        },
    )
    if delay > 0:
        await asyncio.sleep(2.5 * delay)

    # 4. Researching job market
    await publisher.emit_event(
        run_id=run_id,
        event_type=EventType.RESEARCHING,
        payload={
            "node": "job_intelligence",
            "message": "Analyzing job postings and required skills for the role...",
        },
    )
    if delay > 0:
        await asyncio.sleep(2.5 * delay)

    # 5. Processing skill gap
    await publisher.emit_event(
        run_id=run_id,
        event_type=EventType.PROCESSING,
        payload={
            "node": "skill_gap",
            "message": "Evaluating skill gaps against job requirements...",
        },
    )
    if delay > 0:
        await asyncio.sleep(2.0 * delay)

    # 6. Structuring plan
    await publisher.emit_event(
        run_id=run_id,
        event_type=EventType.STRUCTURING,
        payload={
            "message": "Building your personalized study plan...",
        },
    )
    if delay > 0:
        await asyncio.sleep(1.5 * delay)

    # 7. Completed
    await publisher.emit_event(
        run_id=run_id,
        event_type=EventType.COMPLETED,
        payload={
            "status": "complete",
            "threadId": thread_id,
            "message": (
                f"Interview preparation plan ready for: '{query}'. "
                "[Dummy mode — set USE_DUMMY_STREAM=false to run real agents.]"
            ),
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
    plan_days: Optional[int] = None,
) -> None:
    """Execute the agent workflow, streaming events via Redis pub/sub.

    - Live mode (USE_DUMMY_STREAM=false, default): runs the real LangGraph
      multi-agent graph and publishes structured SSE events.
    - Dummy mode (USE_DUMMY_STREAM=true): emits scripted PrepAmigo-themed events
      without running the LLM — for UI development only.

    The `interview_prep` workflow always uses the real graph regardless of
    USE_DUMMY_STREAM, because its output is structured plan JSON.
    """
    pub = publisher or get_event_publisher()
    tid = thread_id or f"run-{run_id}"

    # Resolve dummy mode: per-call override > settings
    if use_dummy is None:
        use_dummy = settings.use_dummy_stream

    # interview_prep always runs live — dummy output is meaningless for it
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

    logger.info(
        "Starting LangGraph run %s (thread: %s, user: %s, mode: %s)",
        run_id, tid, user_id or "anonymous", workflow_mode or "chat",
    )
    config = {"configurable": {"thread_id": tid}}

    if resume_input is not None:
        inputs: Any = Command(resume=resume_input)
    else:
        snapshot = None
        if graph is not None and hasattr(graph, "aget_state"):
            try:
                snapshot = await graph.aget_state(config)
            except Exception:
                snapshot = None
        if snapshot is not None and "interview_prep_pause" in (snapshot.next or ()):
            inputs = Command(resume={"answer": query})
        else:
            wf_input = workflow_input or {}
            resume_text = wf_input.get("resume_text") or wf_input.get("candidate_resume_text")
            inputs = {
                "messages": [HumanMessage(content=query)],
                "workflow_mode": workflow_mode,
                "workflow_input": wf_input,
                "workflow_text_input": workflow_text_input,
                "interview_prep_input": {},
                "workflow_clarification_rounds": 0,
            }
            if resume_text:
                inputs["task_context"] = {"candidate_resume_text": str(resume_text).strip()}
            if user_id:
                inputs["user_id"] = user_id
            if plan_days:
                inputs["plan_total_days"] = plan_days

    await pub.emit_event(
        run_id=run_id,
        event_type=EventType.THINKING,
        payload={"message": "Received request. Determining which agent should handle it...", "query": query},
    )

    try:
        with collect_metrics() as run_metrics:
            try:
                async for event_type, payload in bridge_graph_turn(graph, inputs, config):
                    await pub.emit_event(run_id=run_id, event_type=event_type, payload=payload)
            finally:
                logger.info("Run %s metrics: %s", run_id, json.dumps(run_metrics.summary()))
    except Exception as exc:
        logger.exception("Agent run %s encountered error: %s", run_id, exc)
        await pub.emit_event(
            run_id=run_id,
            event_type=EventType.FAILED,
            payload={"error": str(exc), "detail": friendly_error_detail(exc), "status": "error"},
        )
