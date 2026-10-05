import asyncio
import dataclasses

import pytest
from langchain_core.messages import AIMessage
from langgraph.graph import END, START, StateGraph

from agents.research_agent import (
    ContentResearchAgent,
    ResearchAgentError,
    ResearchRequest,
    classify_depth,
)
from graph.events import format_sse
from graph.state import AgentState
from memory.local_adapter import LocalMemoryProvider

STEPS = [
    "fetch_user_context",
    "identify_curation_scope",
    "execute_searches",
    "synthesize_learning_module",
]


class FakeTool:
    def __init__(self, result=None, error=None):
        self.result, self.error, self.calls = result, error, []

    def invoke(self, payload):
        self.calls.append(payload)
        if self.error:
            raise self.error
        return self.result


class FakeLLM:
    def __init__(self, content="## Overview\nDP matters."):
        self.content, self.prompts = content, []

    async def ainvoke(self, messages):
        self.prompts.append(messages)
        return AIMessage(content=self.content)


class FailingMemory(LocalMemoryProvider):
    async def search(self, query, user_id, limit=5):
        raise ConnectionError("vector store down")


def fake_tools(**overrides):
    # titles name their topic, like real search results do: the agent drops
    # results whose title+snippet don't mention the topic (tools/relevance.py)
    tools = {
        "docs": FakeTool({"source": "serpapi", "results": [
            {"title": "Dynamic Programming guide", "url": "https://docs.example/dp", "resource_type": "documentation"},
        ]}),
        "books": FakeTool({"source": "serpapi", "results": [
            {"title": "CLRS", "url": "https://books.example/clrs", "resource_type": "book",
             "snippet": "Classic algorithms text with a dynamic programming chapter."},
            {"title": "Duplicate", "url": "https://docs.example/dp", "resource_type": "book"},
        ]}),
        "papers": FakeTool({"source": "serpapi", "results": [
            {"title": "A survey of dynamic programming", "url": "https://papers.example/dp", "resource_type": "paper"},
        ]}),
        "videos": FakeTool({"source": "serpapi", "results": [
            {"title": "Dynamic Programming in 10 min", "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
             "resource_type": "video", "video_id": "dQw4w9WgXcQ"},
        ]}),
        "transcript": FakeTool({"video_id": "dQw4w9WgXcQ", "source": "youtube", "available": True,
                                "excerpt": "Memoization caches subproblems.", "truncated": False,
                                "total_chars": 31}),
    }
    tools.update(overrides)
    return tools


@pytest.fixture
def memory():
    return LocalMemoryProvider()


def make_agent(memory, llm=None, **tool_overrides):
    return ContentResearchAgent(llm=llm or FakeLLM(), memory=memory, tools=fake_tools(**tool_overrides))


REQUEST = ResearchRequest(
    user_id="u1", target_role="Software Engineer", target_company="Acme", topic_or_skill_gap="Dynamic Programming"
)


async def collect(agent, request=REQUEST):
    return [event async for event in agent.astream(request)]


def test_astream_emits_running_then_completed_for_every_step(memory):
    events = asyncio.run(collect(make_agent(memory)))

    assert [(e["step"], e["status"]) for e in events] == [
        (step, status) for step in STEPS for status in ("running", "completed")
    ]
    for event in events:
        assert set(event) == {"agent", "step", "status", "payload", "timestamp"}
        assert event["agent"] == "research_agent"
        assert event["payload"]["topic"] == "Dynamic Programming"
        assert format_sse(event).startswith(f"event: {event['step']}\ndata: {{")
    completed = [e for e in events if e["status"] == "completed"]
    assert all(isinstance(e["payload"]["duration_ms"], (int, float)) for e in completed)


def test_end_to_end_module_and_handoff(memory):
    asyncio.run(memory.add("Candidate prefers Python for Dynamic Programming practice", "u1"))
    llm = FakeLLM()

    result = asyncio.run(make_agent(memory, llm).run(REQUEST))

    module = result["module"]
    assert module["depth"] == "foundational"  # no depth_hint given
    assert module["content_markdown"] == "## Overview\nDP matters."
    # links are deduplicated tool results, never LLM output
    assert [r["url"] for r in module["resources"]] == [
        "https://docs.example/dp", "https://books.example/clrs", "https://papers.example/dp",
        "https://youtube.com/watch?v=dQw4w9WgXcQ",
    ]
    assert module["transcripts"][0]["video_id"] == "dQw4w9WgXcQ"
    assert module["uses_mock_sources"] is False

    prompt = llm.prompts[0][1].content
    assert "prefers Python" in prompt
    assert "Memoization caches subproblems." in prompt
    assert "https://books.example/clrs" in prompt

    # structured handoff for a downstream agent (graph.state.AgentHandoff);
    # compact by design: no full markdown in `data`
    handoff = result["handoff"]
    assert handoff["agent"] == "research_agent"
    assert handoff["kind"] == "learning_module"
    assert handoff["data"] == {
        "module_id": module["id"],
        "topic": "Dynamic Programming",
        "depth": "foundational",
        "resource_urls": [r["url"] for r in module["resources"]],
        "uses_mock_sources": False,
    }
    assert "content_markdown" not in handoff["data"]


@pytest.mark.parametrize(
    ("depth_hint", "expected"),
    [(None, "foundational"), ("foundational", "foundational"), ("intermediate", "intermediate"),
     ("advanced", "advanced"), ("revision", "revision"), ("not-a-depth", "foundational")],
)
def test_classify_depth(depth_hint, expected):
    assert classify_depth(depth_hint) == expected


def test_depth_hint_is_validated_by_the_request():
    with pytest.raises(ValueError, match="depth_hint"):
        dataclasses.replace(REQUEST, depth_hint="bogus")


def test_papers_are_fetched_at_every_depth_except_revision(memory):
    """Papers come from a free catalogue (arXiv), so a foundational module
    gets one too; a revision pass stays short."""
    agent = make_agent(memory)

    foundational = asyncio.run(agent.run(REQUEST))
    assert len(agent.tools["papers"].calls) == 1
    assert any(r["url"] == "https://papers.example/dp" for r in foundational["module"]["resources"])

    asyncio.run(agent.run(dataclasses.replace(REQUEST, depth_hint="revision")))
    assert len(agent.tools["papers"].calls) == 1


def test_revision_scope_skips_books_and_transcripts(memory):
    agent = make_agent(memory)

    result = asyncio.run(agent.run(dataclasses.replace(REQUEST, depth_hint="revision")))

    assert result["module"]["depth"] == "revision"
    assert agent.tools["books"].calls == []
    assert agent.tools["transcript"].calls == []


def test_partial_tool_failures_are_reported_not_fatal(memory):
    agent = make_agent(
        memory,
        books=FakeTool(error=RuntimeError("books down")),
        transcript=FakeTool(error=RuntimeError("TranscriptsDisabled")),
    )

    events = asyncio.run(collect(agent))

    search_done = next(e for e in events if e["step"] == "execute_searches" and e["status"] == "completed")
    assert search_done["payload"]["errors"] == {
        "books": "books down", "transcript:dQw4w9WgXcQ": "TranscriptsDisabled",
    }
    assert search_done["payload"]["transcripts"] == 0
    assert "docs" in search_done["payload"]["tool_timings_ms"]
    assert events[-1]["status"] == "completed"


def test_a_hanging_tool_call_is_capped_by_its_own_timeout_not_the_whole_step(memory, monkeypatch):
    """One slow/hanging SerpApi engine must not be able to eat the whole
    step's remaining budget away from the other kinds running alongside it
    (observed live: one uncached, unlucky query stalled execute_searches
    for 58.8s while the other three kinds had already finished in <6s)."""
    import time as time_module

    import agents.research_agent as research_agent

    class TinyToolBudget:
        research_timeout_seconds = 30
        research_tool_timeout_seconds = 0.05
        research_min_relevance = 0.5
        research_synthesis_timeout_seconds = 45

    monkeypatch.setattr(research_agent, "settings", TinyToolBudget())

    class HangingTool:
        def invoke(self, payload):
            time_module.sleep(1)  # far longer than research_tool_timeout_seconds
            return {"source": "serpapi", "results": []}

    agent = make_agent(memory, books=HangingTool())
    events = asyncio.run(collect(agent))

    search_done = next(e for e in events if e["step"] == "execute_searches" and e["status"] == "completed")
    assert "books" in search_done["payload"]["errors"]
    # the other kinds still completed instead of waiting on books
    assert "docs" in search_done["payload"]["tool_timings_ms"]
    assert events[-1]["status"] == "completed"


def test_all_sources_failing_emits_failed_event_and_raises(memory):
    down = RuntimeError("down")
    agent = make_agent(memory, docs=FakeTool(error=down), books=FakeTool(error=down),
                       papers=FakeTool(error=down), videos=FakeTool(error=down))
    events = []

    with pytest.raises(ResearchAgentError, match="execute_searches"):
        asyncio.run(agent.run(REQUEST, on_event=events.append))

    assert (events[-1]["step"], events[-1]["status"]) == ("execute_searches", "failed")
    assert "All research sources failed" in events[-1]["payload"]["error"]


def test_empty_llm_output_fails_synthesis(memory):
    events = []
    with pytest.raises(ResearchAgentError):
        asyncio.run(make_agent(memory, FakeLLM(content="  ")).run(REQUEST, on_event=events.append))

    assert (events[-1]["step"], events[-1]["status"]) == ("synthesize_learning_module", "failed")


def test_memory_outage_degrades_gracefully():
    events = asyncio.run(collect(make_agent(FailingMemory())))

    context = next(e for e in events if e["step"] == "fetch_user_context" and e["status"] == "completed")
    assert context["payload"]["memory_error"] == "vector store down"
    assert events[-1]["status"] == "completed"


class SlowMemory(LocalMemoryProvider):
    async def search(self, query, user_id, limit=5):
        await asyncio.sleep(0.2)
        return []


def test_research_phase_stops_once_its_time_budget_is_spent(monkeypatch):
    import agents.research_agent as research_agent

    class TinyBudget:
        research_timeout_seconds = 0.01
        research_tool_timeout_seconds = 12
        research_min_relevance = 0.5

    # settings is a frozen dataclass instance; rebind the module-level name
    # research_agent reads from, rather than mutating the shared instance
    monkeypatch.setattr(research_agent, "settings", TinyBudget())

    events = []
    with pytest.raises(ResearchAgentError):
        asyncio.run(make_agent(SlowMemory()).run(REQUEST, on_event=events.append))

    assert events[-1]["status"] == "failed"
    assert events[-1]["step"] in {"fetch_user_context", "identify_curation_scope", "execute_searches"}
    assert "budget" in events[-1]["payload"]["error"]


def test_synthesis_has_its_own_time_budget_independent_of_the_research_phase(memory, monkeypatch):
    import agents.research_agent as research_agent

    class TinyBudget:
        research_timeout_seconds = 30  # plenty for the (fast, mocked) research phase
        research_tool_timeout_seconds = 12
        research_min_relevance = 0.5
        research_synthesis_timeout_seconds = 0.01

    monkeypatch.setattr(research_agent, "settings", TinyBudget())

    class SlowLLM(FakeLLM):
        async def ainvoke(self, messages):
            await asyncio.sleep(0.2)
            return await super().ainvoke(messages)

    events = []
    with pytest.raises(ResearchAgentError):
        asyncio.run(make_agent(memory, SlowLLM()).run(REQUEST, on_event=events.append))

    assert (events[-1]["step"], events[-1]["status"]) == ("synthesize_learning_module", "failed")
    assert "budget" in events[-1]["payload"]["error"]
    # regression: duration_ms must be measured at the moment of failure, not
    # left at 0 by reading it before the Timer context manager exits
    assert events[-1]["payload"]["duration_ms"] > 0


def test_async_callbacks_are_awaited(memory):
    received = []

    async def on_event(event):
        await asyncio.sleep(0)
        received.append(event["status"])

    asyncio.run(make_agent(memory).run(REQUEST, on_event=on_event))

    assert len(received) == len(STEPS) * 2


@pytest.mark.parametrize("field", ["user_id", "target_role", "target_company", "topic_or_skill_gap"])
def test_request_validation(field):
    values = {"user_id": "u1", "target_role": "SWE", "target_company": "Acme", "topic_or_skill_gap": "DP"}
    values[field] = " "
    with pytest.raises(ValueError, match=field):
        ResearchRequest(**values)


def test_langgraph_node_streams_custom_events_and_updates_state(memory):
    agent = make_agent(memory)
    builder = StateGraph(AgentState)
    builder.add_node("research_agent", agent)
    builder.add_edge(START, "research_agent")
    builder.add_edge("research_agent", END)
    graph = builder.compile()
    state = {
        "messages": [],
        "user_id": "u1",
        "task_context": {"target_role": "SWE", "target_company": "Acme"},
        "skill_gaps": ["Dynamic Programming", "   ", "Graphs"],
        "execution_events": [],
    }

    async def stream():
        custom, final = [], None
        async for mode, chunk in graph.astream(state, stream_mode=["custom", "values"]):
            if mode == "custom":
                custom.append(chunk)
            else:
                final = chunk
        return custom, final

    custom, final = asyncio.run(stream())

    # 2 successful gaps x (2 events/step x 4 steps) + 1 validation failure for the blank gap
    assert len(final["execution_events"]) == 2 * len(STEPS) * 2 + 1
    # custom stream includes all execution_events plus tool-level progress events
    assert len(custom) == 49
    assert all(e in custom for e in final["execution_events"])
    assert sum(1 for e in custom if e["step"] == "validate_request") == 1
    assert [m["topic"] for m in final["researched_materials"]] == ["Dynamic Programming", "Graphs"]
    assert [h["data"]["topic"] for h in final["handoffs"]] == ["Dynamic Programming", "Graphs"]
    assert any(e["step"] == "validate_request" and e["status"] == "failed" for e in custom)


def test_prefetched_memories_skip_a_second_search():
    llm = FakeLLM()
    agent = ContentResearchAgent(llm=llm, memory=FailingMemory(), tools=fake_tools())
    events = []

    asyncio.run(agent.run(REQUEST, on_event=events.append, memories=["Prefers Python for DP practice"]))

    context = next(e for e in events if e["step"] == "fetch_user_context" and e["status"] == "completed")
    assert context["payload"]["memory_source"] == "prefetched"
    assert "memory_error" not in context["payload"]  # FailingMemory.search was never called
    assert "Prefers Python for DP practice" in llm.prompts[0][1].content
