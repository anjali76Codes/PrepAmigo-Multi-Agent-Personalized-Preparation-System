import asyncio

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from agents.research_agent import ContentResearchAgent
from agents.research_node import ResearchNode, parse_research_request
from memory.local_adapter import LocalMemoryProvider
from test_research_agent import FakeLLM, fake_tools


class ExtractorLLM:
    def __init__(self, reply):
        self.reply, self.prompts = reply, []

    async def ainvoke(self, messages, config=None):
        self.prompts.append(messages)
        return AIMessage(content=self.reply)


@pytest.mark.parametrize(
    ("reply", "expected"),
    [
        ('{"topic": "Dynamic Programming", "target_role": "SWE", "target_company": "Google", "depth_hint": "advanced"}',
         {"topic": "Dynamic Programming", "target_role": "SWE", "target_company": "Google", "depth_hint": "advanced"}),
        ('Sure! ```json\n{"topic": "Graphs", "target_role": null, "target_company": ""}\n```',
         {"topic": "Graphs", "target_role": None, "target_company": None, "depth_hint": None}),
        ("I cannot help", {"topic": None, "target_role": None, "target_company": None, "depth_hint": None}),
        ('{"topic": 42', {"topic": None, "target_role": None, "target_company": None, "depth_hint": None}),
    ],
)
def test_parse_research_request(reply, expected):
    assert parse_research_request(reply) == expected


def make_node(extractor_reply):
    agent = ContentResearchAgent(llm=FakeLLM(), memory=LocalMemoryProvider(), tools=fake_tools())
    return ResearchNode(agent=agent, llm=ExtractorLLM(extractor_reply))


def test_research_node_runs_agent_and_replies_with_the_module(tmp_path):
    node = make_node('{"topic": "Dynamic Programming", "target_role": null, "target_company": "Google"}')
    state = {
        "user_id": "subhaan",
        "messages": [HumanMessage("find me resources to learn DP for my Google prep")],
        "memory_context": ["Subhaan is preparing for a Software Engineer role at Google"],
    }

    result = asyncio.run(node(state))

    reply = result["messages"][0].content
    assert reply == "## Overview\nDP matters."  # FakeLLM's output verbatim, no appended text
    # no appended source list: the module's own Curated Resources section
    # (written by the real LLM) already cites these — a second list would be
    # unread duplicate text, so format_module_reply doesn't add one
    assert "Sources found by the research agent" not in reply
    assert any(r["url"] == "https://books.example/clrs" for r in result["researched_materials"][0]["resources"])
    assert result["researched_materials"][0]["target_role"] == "Software Engineer"  # default
    assert result["researched_materials"][0]["target_company"] == "Google"
    assert len(result["execution_events"]) == 8  # 4 steps x running+completed
    assert result["handoffs"][0]["data"]["topic"] == "Dynamic Programming"
    # recalled memories are offered to the extractor
    assert "Software Engineer role at Google" in node.llm.prompts[0][0].content


def test_research_node_passes_the_extracted_depth_hint_through():
    node = make_node('{"topic": "Dynamic Programming", "depth_hint": "advanced"}')

    result = asyncio.run(node({
        "user_id": "u1",
        "messages": [HumanMessage("I'm proficient in DP, go deep on internals")],
    }))

    assert result["researched_materials"][0]["depth"] == "advanced"


def test_research_node_asks_for_topic_when_none_found():
    node = make_node('{"topic": null}')

    result = asyncio.run(node({"user_id": "u1", "messages": [HumanMessage("find me resources")]}))

    assert "Which topic" in result["messages"][0].content


def test_research_node_requires_user_id():
    node = make_node('{"topic": "DP"}')

    result = asyncio.run(node({"messages": [HumanMessage("resources for DP")]}))

    assert "user_id" in result["messages"][0].content


def test_mock_mode_notice_is_appended_once(monkeypatch):
    node = make_node('{"topic": "Dynamic Programming"}')

    async def mock_run(request, on_event=None, memories=None):
        module = {"content_markdown": "## Overview\ntext", "resources": [], "transcripts": [],
                  "uses_mock_sources": True, "id": "m1", "topic": "Dynamic Programming", "depth": "foundational",
                  "target_role": "SWE", "target_company": "Acme"}
        return {"module": module, "events": [], "handoff": {"agent": "research_agent", "kind": "learning_module",
                                                              "summary": "", "data": {}}}

    monkeypatch.setattr(node.agent, "run", mock_run)

    result = asyncio.run(node({"user_id": "u1", "messages": [HumanMessage("find me resources on DP")]}))

    reply = result["messages"][0].content
    assert reply.count("mock mode") == 1
