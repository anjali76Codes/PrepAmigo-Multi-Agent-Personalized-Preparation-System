"""
streaming.langgraph_bridge: translates one graph turn into the Redis SSE
event taxonomy. Reuses test_graph_streaming.build_test_graph, which drives
graph.streaming.stream_turn the same way a real chat turn does.
"""
import asyncio

from graph.events import emit_to_graph_stream, make_event
from streaming.langgraph_bridge import bridge_graph_turn
from streaming.models import EventType
from test_graph_streaming import build_test_graph


def collect(graph):
    async def run():
        return [item async for item in bridge_graph_turn(graph, {"messages": []}, {})]

    return asyncio.run(run())


def test_route_becomes_calling_agent():
    events = collect(build_test_graph("research"))

    assert events[0] == (EventType.CALLING_AGENT, {"agent": "research", "message": "Routed to research"})


def test_final_becomes_completed_with_the_full_reply():
    events = collect(build_test_graph("chat"))

    kind, payload = events[-1]
    assert kind == EventType.COMPLETED
    assert payload == {"agent": "chat", "status": "success", "message": "Start with recursion then memoization."}


def test_interview_intelligence_completion_carries_the_markdown_message_and_its_agent():
    from langchain_core.messages import AIMessage
    from langgraph.graph import END, START, StateGraph

    from graph.state import AgentState

    content = "## Summary\nInterview report in Markdown."

    async def supervisor(state):
        return {"next_agent": "interview_intelligence"}

    async def specialist(state):
        return {"messages": [AIMessage(content=content)]}

    builder = StateGraph(AgentState)
    builder.add_node("supervisor", supervisor)
    builder.add_node("interview_intelligence", specialist)
    builder.add_edge(START, "supervisor")
    builder.add_edge("supervisor", "interview_intelligence")
    builder.add_edge("interview_intelligence", END)

    events = collect(builder.compile())

    assert events[-1] == (EventType.COMPLETED, {"agent": "interview_intelligence", "message": content})


def test_tokens_are_never_forwarded():
    events = collect(build_test_graph("chat"))

    # only route, step(s) and final should reach Redis — never a token
    assert all(kind != "token" for kind, _ in events)
    # exactly one CALLING_AGENT (route) + N steps + one COMPLETED (final)
    assert events[0][0] == EventType.CALLING_AGENT
    assert events[-1][0] == EventType.COMPLETED


def test_step_event_type_is_chosen_from_the_step_name():
    def make_graph():
        graph = build_test_graph("research")
        return graph

    events = collect(make_graph())

    # build_test_graph's specialist emits a "execute_searches" step, which
    # the keyword table maps to RESEARCHING regardless of which agent sent it
    step_events = [(kind, payload) for kind, payload in events if payload.get("step") == "execute_searches"]
    assert step_events == [(EventType.RESEARCHING, {"agent": "research", "step": "execute_searches", "status": "completed"})]


def _single_specialist_graph(specialist):
    from langgraph.graph import END, START, StateGraph

    from graph.state import AgentState

    async def supervisor(state):
        return {"next_agent": "chat"}

    builder = StateGraph(AgentState)
    builder.add_node("supervisor", supervisor)
    builder.add_node("chat", specialist)
    builder.add_edge(START, "supervisor")
    builder.add_edge("supervisor", "chat")
    builder.add_edge("chat", END)
    return builder.compile()


def test_tool_lifecycle_steps_become_tool_call_events():
    """invoke_tool_with_events' running/completed pair arrives as two TOOL_CALL
    events sharing a tool_call_id, even for a tool named like a research step."""
    from langchain_core.messages import AIMessage

    from graph.events import invoke_tool_with_events

    def serpapi_search(query: str) -> dict:
        return {"source": "serpapi", "organic_results": [{}, {}, {}]}

    async def specialist(state):
        await invoke_tool_with_events(serpapi_search, {"query": "acme interviews"}, agent="research")
        return {"messages": [AIMessage(content="done")]}

    events = collect(_single_specialist_graph(specialist))

    tool_events = [payload for kind, payload in events if kind == EventType.TOOL_CALL]
    assert [p["status"] for p in tool_events] == ["running", "completed"]
    running, completed = tool_events
    assert running["tool"] == completed["tool"] == "serpapi_search"
    assert running["step"] == "tool_serpapi_search"
    assert running["tool_call_id"] and running["tool_call_id"] == completed["tool_call_id"]
    assert running["query"] == completed["query"] == "acme interviews"
    assert running["message"] == "Tool serpapi_search running: acme interviews"
    assert completed["result_count"] == 3
    assert "duration_ms" in completed
    # no tool event leaks out under the old coarse type
    assert not any(kind == EventType.RESEARCHING and p.get("step", "").startswith("tool_") for kind, p in events)


def test_a_failed_tool_is_a_failed_tool_call_not_a_failed_run():
    from langchain_core.messages import AIMessage

    from graph.events import invoke_tool_with_events

    def flaky_fetch(query: str) -> dict:
        raise RuntimeError("upstream 503")

    async def specialist(state):
        try:
            await invoke_tool_with_events(flaky_fetch, {"query": "x"}, agent="research")
        except RuntimeError:
            pass
        return {"messages": [AIMessage(content="done")]}

    events = collect(_single_specialist_graph(specialist))

    failed = [p for kind, p in events if kind == EventType.TOOL_CALL and p["status"] == "failed"]
    assert len(failed) == 1 and failed[0]["error"] == "upstream 503"
    assert events[-1][0] == EventType.COMPLETED


def test_a_failed_step_is_progress_not_a_failed_run():
    """A failed step or tool (one of several parallel searches) is reported
    with status "failed" under its step's event type; only a failed run is
    EventType.FAILED, which closes the client's stream."""
    from langchain_core.messages import AIMessage
    from langgraph.graph import END, START, StateGraph

    from graph.state import AgentState

    async def supervisor(state):
        return {"next_agent": "chat"}

    async def specialist(state):
        emit_to_graph_stream(make_event("chat", "guardrail_check", "failed", {"error": "blocked"}))
        return {"messages": [AIMessage(content="done")]}

    builder = StateGraph(AgentState)
    builder.add_node("supervisor", supervisor)
    builder.add_node("chat", specialist)
    builder.add_edge(START, "supervisor")
    builder.add_edge("supervisor", "chat")
    builder.add_edge("chat", END)
    graph = builder.compile()

    events = collect(graph)

    failed = next(payload for kind, payload in events if payload.get("status") == "failed")
    assert failed == {"agent": "chat", "step": "guardrail_check", "error": "blocked", "status": "failed"}


def test_waiting_interrupt_is_forwarded_as_a_waiting_event(monkeypatch):
    async def fake_stream_turn(_graph, _inputs, _config, tokens=False):
        assert tokens is False
        yield {
            "type": "waiting",
            "payload": {
                "question": "Which role are you targeting at Acme?",
                "missing_fields": ["role"],
            },
        }

    monkeypatch.setattr("streaming.langgraph_bridge.stream_turn", fake_stream_turn)

    events = collect(object())

    assert events == [(
        EventType.WAITING,
        {
            "question": {"question": "Which role are you targeting at Acme?"},
            "missing_fields": ["role"],
            "status": "awaiting_input",
        },
    )]


def test_partial_interview_prep_result_is_a_completed_event():
    async def fake_stream_turn(_graph, _inputs, _config, tokens=False):
        yield {
            "type": "final",
            "agent": "interview_prep",
            "content": "One source returned useful data.",
            "status": "partial",
            "result": {"status": "partial"},
        }

    import pytest

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr("streaming.langgraph_bridge.stream_turn", fake_stream_turn)
    try:
        events = collect(object())
    finally:
        monkeypatch.undo()

    assert events == [(
        EventType.COMPLETED,
        {
            "agent": "interview_prep",
            "status": "partial",
            "message": "One source returned useful data.",
            "result": {"status": "partial"},
        },
    )]


def test_the_final_plan_is_sent_once_with_every_days_references():
    """The plan output keeps three copies of every day (nested_plan and the
    sprint/sprintday aliases) for the plan file; the SSE event and its Redis
    history carry one."""
    day = {"day_number": 1, "references": [{"type": "video", "title": "T", "url": "https://x.example"}]}
    plan = {"plan": {"total_days": 1}, "sprints": [{"sprint_number": 1}], "sprint_days": [day],
            "sprint": [{"sprint_number": 1}], "sprintday": [day], "nested_plan": {"sprints": []},
            "coverage": {}, "db_sync": {"success": True}}

    async def fake_stream_turn(_graph, _inputs, _config, tokens=False):
        yield {"type": "final", "agent": "interview_prep", "content": "Done.", "status": "complete",
               "result": {"status": "complete", "study_plan": plan}}

    import pytest

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr("streaming.langgraph_bridge.stream_turn", fake_stream_turn)
    try:
        [(kind, payload)] = collect(object())
    finally:
        monkeypatch.undo()

    sent = payload["result"]["study_plan"]
    assert kind == EventType.COMPLETED
    assert set(sent) == {"plan", "sprints", "sprint_days", "coverage", "db_sync"}
    assert sent["sprint_days"][0]["references"] == day["references"]
    assert "nested_plan" in plan  # the state's copy is left alone
