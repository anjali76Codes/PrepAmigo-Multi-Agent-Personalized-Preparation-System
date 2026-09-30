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


def test_interview_intelligence_completion_contains_only_the_markdown_message():
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

    assert events[-1] == (EventType.COMPLETED, {"message": content})


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
    assert step_events == [(EventType.RESEARCHING, {"agent": "research_agent", "step": "execute_searches"})]


def test_a_failed_step_becomes_failed():
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

    failed = next(payload for kind, payload in events if kind == EventType.FAILED)
    assert failed == {"agent": "chat", "step": "guardrail_check", "error": "blocked"}


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
