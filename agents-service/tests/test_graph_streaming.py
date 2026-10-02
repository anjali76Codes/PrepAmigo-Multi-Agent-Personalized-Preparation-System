"""
graph.streaming.stream_turn: the CLI's direct (non-Redis) token stream.
Not to be confused with tests/test_streaming.py, which covers the
Redis-backed streaming/ package (publisher, runner, /internal/agent/execute),
or tests/test_langgraph_bridge.py, which covers the bridge between the two.
"""
import asyncio

from langchain_core.language_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END, START, StateGraph

from graph.events import INTERNAL_LLM_CONFIG, emit_to_graph_stream, make_event
from graph.state import AgentState
from graph.streaming import stream_turn


def fake_llm(text):
    return GenericFakeChatModel(messages=iter([AIMessage(content=text)]))


def build_test_graph(route, reply_suffix=""):
    """supervisor (internal LLM call) -> one specialist that streams its reply."""
    router_llm, reply_llm = fake_llm(route), fake_llm("Start with recursion then memoization.")

    async def supervisor(state):
        decision = await router_llm.ainvoke(state["messages"], config=INTERNAL_LLM_CONFIG)
        return {"next_agent": decision.content}

    async def specialist(state):
        emit_to_graph_stream(make_event("research_agent", "execute_searches", "completed"))
        reply = await reply_llm.ainvoke(state["messages"])
        return {"messages": [AIMessage(content=reply.content + reply_suffix)]}

    builder = StateGraph(AgentState)
    builder.add_node("supervisor", supervisor)
    builder.add_node(route, specialist)
    builder.add_edge(START, "supervisor")
    builder.add_edge("supervisor", route)
    builder.add_edge(route, END)
    return builder.compile()


def collect(graph, tokens=True):
    async def run():
        inputs = {"messages": [HumanMessage("help with DP")]}
        return [item async for item in stream_turn(graph, inputs, {}, tokens=tokens)]

    return asyncio.run(run())


def test_stream_yields_route_steps_tokens_and_final():
    items = collect(build_test_graph("chat"))

    kinds = [item["type"] for item in items]
    assert kinds[0] == "route" and items[0]["agent"] == "chat"
    assert "step" in kinds
    tokens = [item for item in items if item["type"] == "token"]
    assert len(tokens) > 1  # the reply arrived incrementally
    # the final item also carries the turn's task_context (added with the
    # company-research SSE integration); this test is about the reply
    assert {key: items[-1][key] for key in ("type", "agent", "content")} == {
        "type": "final", "agent": "chat", "content": "Start with recursion then memoization."}
    assert "".join(t["content"] for t in tokens) == items[-1]["content"]


def test_internal_llm_calls_are_not_streamed():
    items = collect(build_test_graph("chat"))

    # the supervisor's LLM output ("chat") is tagged internal, so only the reply streams
    assert {item["agent"] for item in items if item["type"] == "token"} == {"chat"}


def test_text_added_after_streaming_arrives_as_a_last_token():
    items = collect(build_test_graph("research", reply_suffix="\n\n---\n**Sources**"))

    tokens = [item["content"] for item in items if item["type"] == "token"]
    assert tokens[-1] == "\n\n---\n**Sources**"
    assert "".join(tokens) == items[-1]["content"]


def test_tokens_off_sends_the_reply_once():
    items = collect(build_test_graph("chat"), tokens=False)

    tokens = [item for item in items if item["type"] == "token"]
    assert [t["content"] for t in tokens] == ["Start with recursion then memoization."]
    assert items[-1]["type"] == "final"


def test_a_pending_tool_call_is_not_treated_as_final():
    """A tool-calling specialist (company_research) can run its own node
    several times, each time with a message; only the one with no pending
    tool_calls is the actual reply."""
    from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
    from langgraph.graph import END, START, StateGraph

    from graph.state import AgentState

    calls_made = {"n": 0}

    async def supervisor(state):
        return {"next_agent": "company_research"}

    async def looping_specialist(state):
        if calls_made["n"] == 0:
            calls_made["n"] += 1
            return {"messages": [AIMessage(content="", tool_calls=[
                {"name": "search", "args": {}, "id": "call-1"}
            ])]}
        return {"messages": [AIMessage(content="Here is the dossier.")]}

    async def tool_node(state):
        return {"messages": [ToolMessage(content="result", tool_call_id="call-1")]}

    def after(state):
        last = state["messages"][-1]
        return "tools" if getattr(last, "tool_calls", None) else END

    builder = StateGraph(AgentState)
    builder.add_node("supervisor", supervisor)
    builder.add_node("company_research", looping_specialist)
    builder.add_node("tools", tool_node)
    builder.add_edge(START, "supervisor")
    builder.add_edge("supervisor", "company_research")
    builder.add_conditional_edges("company_research", after, {"tools": "tools", END: END})
    builder.add_edge("tools", "company_research")
    graph = builder.compile()

    async def run():
        inputs = {"messages": [HumanMessage("research Datadog")]}
        return [item async for item in stream_turn(graph, inputs, {}, tokens=False)]

    items = asyncio.run(run())

    finals = [item for item in items if item["type"] == "final"]
    assert len(finals) == 1
    assert finals[0]["content"] == "Here is the dossier."
