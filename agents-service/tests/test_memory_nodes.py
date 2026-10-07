import asyncio

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

import memory.nodes as memory_nodes
from agents.base import BaseAgent, recent_messages
from graph.state import append_or_reset
from memory.local_adapter import LocalMemoryProvider


class RecordingMemory(LocalMemoryProvider):
    def __init__(self):
        super().__init__()
        self.added = []
        self.searches = []

    async def add(self, messages, user_id, metadata=None):
        self.added.append((messages, user_id, metadata))
        return await super().add(messages, user_id, metadata)

    async def search(self, query, user_id, limit=5):
        self.searches.append((query, user_id, limit))
        return await super().search(query, user_id, limit)


class BrokenMemory(LocalMemoryProvider):
    async def search(self, query, user_id, limit=5):
        raise ConnectionError("mem0 down")

    async def add(self, messages, user_id, metadata=None):
        raise ConnectionError("mem0 down")


@pytest.fixture
def memory(monkeypatch):
    provider = RecordingMemory()
    monkeypatch.setattr(memory_nodes, "get_memory_provider", lambda: provider)
    return provider


async def save_and_wait(state):
    result = await memory_nodes.save_memory(state)
    await memory_nodes.drain_pending_saves()
    return result


def test_save_then_load_round_trip(memory):
    turn_one = {"user_id": "subhaan", "messages": [HumanMessage("remember subhaan is a cs student"), AIMessage("Noted!")]}
    asyncio.run(save_and_wait(turn_one))

    turn_two = {"user_id": "subhaan", "messages": [HumanMessage("what does subhaan study? cs?")]}
    recalled = asyncio.run(memory_nodes.load_memory(turn_two))

    assert recalled["memory_context"] == ["remember subhaan is a cs student"]
    saved = asyncio.run(memory.get_all("subhaan"))
    assert [m["memory"] for m in saved] == ["remember subhaan is a cs student"]  # assistant text not stored locally
    assert saved[0]["metadata"] == {"source": "chat"}


def test_interview_prep_memory_search_includes_structured_target_not_resume(memory):
    state = {
        "user_id": "u1",
        "messages": [],
        "workflow_mode": "interview_prep",
        "workflow_input": {
            "company": "Acme",
            "role": "Platform Engineer",
            "location": "Remote",
            "resume_text": "private resume text",
        },
    }

    asyncio.run(memory_nodes.load_memory(state))

    query, user_id, limit = memory.searches[0]
    assert user_id == "u1"
    assert limit == memory_nodes.MEMORY_RECALL_LIMIT
    assert "company: Acme" in query
    assert "role: Platform Engineer" in query
    assert "location: Remote" in query
    assert "private resume text" not in query


def test_save_sends_the_exchange_with_capped_assistant_context(memory):
    long_reply = "x" * 5000
    state = {"user_id": "u1", "messages": [HumanMessage("I'm weak in DP"), AIMessage(long_reply)]}

    asyncio.run(save_and_wait(state))

    messages, user_id, _ = memory.added[0]
    assert user_id == "u1"
    assert messages[0] == {"role": "user", "content": "I'm weak in DP"}
    assert messages[1]["role"] == "assistant"
    assert len(messages[1]["content"]) == memory_nodes.ASSISTANT_CONTEXT_CHARS


def test_save_does_not_block_the_turn(monkeypatch):
    started, release = asyncio.Event(), asyncio.Event()

    class SlowMemory(LocalMemoryProvider):
        async def add(self, messages, user_id, metadata=None):
            started.set()
            await release.wait()
            return {"results": []}

    monkeypatch.setattr(memory_nodes, "get_memory_provider", lambda: SlowMemory())

    async def scenario():
        await memory_nodes.save_memory({"user_id": "u1", "messages": [HumanMessage("hi there")]})
        # the node has returned while the save is still in flight
        await started.wait()
        assert memory_nodes._pending_saves
        release.set()
        await memory_nodes.drain_pending_saves()
        assert not memory_nodes._pending_saves

    asyncio.run(scenario())


def test_memory_is_scoped_per_user(memory):
    asyncio.run(save_and_wait({"user_id": "a", "messages": [HumanMessage("I love graphs")]}))

    recalled = asyncio.run(memory_nodes.load_memory({"user_id": "b", "messages": [HumanMessage("graphs")]}))

    assert recalled["memory_context"] == []


def test_nodes_skip_memory_without_user_id(memory):
    state = {"messages": [HumanMessage("I love graphs")]}

    asyncio.run(save_and_wait(state))

    assert asyncio.run(memory_nodes.load_memory(state))["memory_context"] == []
    assert memory.added == []


def test_load_memory_resets_per_turn_state(memory):
    result = asyncio.run(memory_nodes.load_memory({"messages": [HumanMessage("hello")]}))

    assert result["execution_events"] is None
    assert result["researched_materials"] is None
    assert result["handoffs"] is None


def test_append_or_reset_reducer():
    assert append_or_reset([1, 2], [3]) == [1, 2, 3]
    assert append_or_reset([1, 2], None) == []
    assert append_or_reset(None, [1]) == [1]


def test_memory_outage_does_not_break_the_turn(monkeypatch):
    monkeypatch.setattr(memory_nodes, "get_memory_provider", lambda: BrokenMemory())
    state = {"user_id": "u1", "messages": [HumanMessage("hello")]}

    assert asyncio.run(memory_nodes.load_memory(state))["memory_context"] == []
    assert asyncio.run(save_and_wait(state)) == {}


def test_recent_messages_window_starts_at_a_user_message():
    history = [HumanMessage(f"q{i}") if i % 2 == 0 else AIMessage(f"a{i}") for i in range(30)]

    window = recent_messages(history, 5)

    assert isinstance(window[0], HumanMessage)
    assert [m.content for m in window] == ["q26", "a27", "q28", "a29"]
    assert recent_messages(history[:3], 20) == history[:3]


def test_agents_see_recalled_memories_and_bounded_history(monkeypatch):
    captured = []

    class FakeLLM:
        async def ainvoke(self, messages):
            captured.extend(messages)
            return AIMessage("Hi Subhaan")

    monkeypatch.setattr("agents.base.get_llm", lambda: FakeLLM())

    class Agent(BaseAgent):
        system_prompt = "You are helpful."
        history_limit = 4

    history = [HumanMessage(f"q{i}") if i % 2 == 0 else AIMessage(f"a{i}") for i in range(10)] + [HumanMessage("hi")]
    result = asyncio.run(Agent()({"messages": history, "memory_context": ["Subhaan is a CS student"]}))

    assert isinstance(captured[1], SystemMessage)
    assert "- Subhaan is a CS student" in captured[1].content
    assert [m.content for m in captured[2:]] == ["q8", "a9", "hi"]
    # generic handoff: any BaseAgent subclass hands a compact summary to
    # whatever runs next this turn (graph.state.AgentHandoff)
    assert result["handoffs"] == [{"agent": "base", "kind": "chat_reply", "summary": "Hi Subhaan", "data": {}}]
