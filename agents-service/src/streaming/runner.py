import asyncio
import logging
import os
import traceback
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
    use_dummy: Optional[bool] = None,
) -> None:
    """Executes the agent workflow. Uses dummy simulation if configured or if LLM is unavailable."""
    pub = publisher or get_event_publisher()
    tid = thread_id or f"run-{run_id}"

    if use_dummy is None:
        use_dummy = os.getenv("USE_DUMMY_STREAM", "true").strip().lower() in {"true", "1", "yes"}

    try:
        if use_dummy or graph is None:
            await run_dummy_agent_stream(run_id=run_id, query=query, publisher=pub, thread_id=tid)
            return

        # Real LangGraph path
        logger.info("Starting LangGraph streaming run %s (thread: %s)", run_id, tid)
        from langchain_core.messages import HumanMessage

        await pub.emit_event(
            run_id=run_id,
            event_type=EventType.THINKING,
            payload={
                "message": "Received request. Initializing multi-agent orchestration...",
                "query": query,
            },
        )

        initial_input = {"messages": [HumanMessage(content=query)]}
        config = {"configurable": {"thread_id": tid}}

        last_state = None
        async for chunk in graph.astream(initial_input, config=config, stream_mode="updates"):
            for node_name, node_output in chunk.items():
                if node_name == "supervisor":
                    next_agent = node_output.get("next_agent", "unknown") if isinstance(node_output, dict) else "unknown"
                    await pub.emit_event(
                        run_id=run_id,
                        event_type=EventType.THINKING,
                        payload={"node": "supervisor", "next_agent": next_agent},
                    )
                elif node_name == "flight_booking":
                    await pub.emit_event(
                        run_id=run_id,
                        event_type=EventType.CALLING_AGENT,
                        payload={"agent": "flight_booking", "message": "Analyzing flight options..."},
                    )
                elif node_name == "company_research":
                    await pub.emit_event(
                        run_id=run_id,
                        event_type=EventType.CALLING_AGENT,
                        payload={
                            "agent": "company_research",
                            "message": "Company Research Agent activated — building company dossier...",
                        },
                    )
                elif node_name == "tools":
                    await pub.emit_event(
                        run_id=run_id,
                        event_type=EventType.RESEARCHING,
                        payload={"node": "tools", "message": "Executing flight search tools..."},
                    )
                elif node_name == "cr_tools":
                    # Extract which tool(s) were called from the last message
                    messages = node_output.get("messages", []) if isinstance(node_output, dict) else []
                    tool_names = []
                    for msg in messages:
                        tool_name = getattr(msg, "name", None)
                        if tool_name:
                            tool_names.append(tool_name)
                    tool_label = ", ".join(tool_names) if tool_names else "SerpApi search engine"
                    await pub.emit_event(
                        run_id=run_id,
                        event_type=EventType.RESEARCHING,
                        payload={
                            "node": "cr_tools",
                            "tools": tool_names,
                            "message": f"Querying {tool_label}...",
                        },
                    )
                elif node_name == "guardrails":
                    await pub.emit_event(
                        run_id=run_id,
                        event_type=EventType.PROCESSING,
                        payload={"node": "guardrails", "message": "Running guardrails..."},
                    )
                elif node_name == "cr_guardrails":
                    await pub.emit_event(
                        run_id=run_id,
                        event_type=EventType.PROCESSING,
                        payload={"node": "cr_guardrails", "message": "Validating company research results..."},
                    )
                last_state = node_output

        await pub.emit_event(
            run_id=run_id,
            event_type=EventType.COMPLETED,
            payload={"status": "success", "threadId": tid, "result": last_state},
        )

    except Exception as exc:
        logger.exception("Agent streaming run %s encountered error: %s", run_id, exc)
        await pub.emit_event(
            run_id=run_id,
            event_type=EventType.FAILED,
            payload={
                "error": str(exc),
                "trace": traceback.format_exc(),
                "status": "error",
            },
        )
