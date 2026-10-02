"""Company name resolution (typo fixes from Google) and the company profile
surviving a model that calls one tool per turn."""
import asyncio
import json

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from agents.company_research_agent import CompanyResearchAgent
from agents.interview_prep_orchestrator import canonical_company
from tools.company_research_tools import corrected_company_name


@pytest.mark.parametrize(("name", "query", "fixed", "expected"), [
    ("Antropic", "Antropic company engineering tech stack", "Anthropic company engineering tech stack", "Anthropic"),
    ("Antropic", "latest Antropic news", "latest Anthropic news", "Anthropic"),
    ("Stripe", "Stripe engineering", "Stripe engineering", ""),             # nothing to fix
    ("Antropic", "Antropic tech", None, ""),                                # no correction offered
    ("Antropic", "Antropic tech stack", "Anthropic AI company technology", ""),  # rewritten, can't align
])
def test_corrected_company_name(name, query, fixed, expected):
    assert corrected_company_name(name, query, fixed) == expected


@pytest.mark.parametrize(("typed", "profile", "expected"), [
    ("Antropic", "Anthropic", "Anthropic"),          # typo fix
    ("Google", "Google LLC", "Google LLC"),          # fuller legal name
    ("Acme Robotics", "Microsoft", "Acme Robotics"),  # different company: keep what the user typed
    ("Stripe", "", "Stripe"),
    ("Stripe", "the company", "Stripe"),             # the agent's placeholder, not a real name
    ("", "Anthropic", "Anthropic"),
])
def test_canonical_company(typed, profile, expected):
    assert canonical_company(typed, profile) == expected


class FakeLLM:
    async def ainvoke(self, messages):
        return AIMessage(content="dossier")


def _search(corrected="", organic=()):
    return json.dumps({
        "status": "success", "search_metadata": {"status": "Success"}, "corrected_company": corrected,
        "knowledge_graph": {}, "organic_results": list(organic), "related_questions": [],
        "discussions_and_forums": [], "sitelinks": [],
    })


def test_profile_keeps_every_tool_round_of_the_turn_and_uses_the_corrected_name():
    agent = CompanyResearchAgent()
    agent.llm = FakeLLM()
    messages = [
        HumanMessage(content='Research this company.\n{"company": "Antropic"}'),
        AIMessage(content="", tool_calls=[{"name": "search_company_overview", "args": {}, "id": "1"}]),
        ToolMessage(content=_search("Anthropic", [{"title": "Eng blog", "link": "https://a.example/eng", "snippet": "s"}]),
                    name="search_company_overview", tool_call_id="1"),
        AIMessage(content="", tool_calls=[{"name": "search_company_news", "args": {}, "id": "2"}]),
        ToolMessage(content=json.dumps({"status": "success", "search_metadata": {"status": "Success"},
                                        "news_results": [{"title": "Funding", "link": "https://n.example/1"}]}),
                    name="search_company_news", tool_call_id="2"),
        AIMessage(content="", tool_calls=[{"name": "search_company_overview", "args": {}, "id": "3"}]),
        ToolMessage(content=_search(organic=[{"title": "Careers", "link": "https://a.example/jobs", "snippet": "s"},
                                             {"title": "Eng blog", "link": "https://a.example/eng", "snippet": "s"}]),
                    name="search_company_overview", tool_call_id="3"),
    ]

    profile = asyncio.run(agent({"messages": messages, "task_context": {}}))["task_context"]["company_profile"]

    assert profile["name"] == "Anthropic"
    assert profile["recent_developments"], "news from round 2 must survive later search rounds"
    organic_links = [r.get("link") or r.get("url") for r in profile["organic_results"]]
    assert sorted(organic_links) == ["https://a.example/eng", "https://a.example/jobs"]  # merged, deduped


def test_earlier_turns_on_a_chat_thread_are_not_reprocessed():
    agent = CompanyResearchAgent()
    agent.llm = FakeLLM()
    messages = [
        HumanMessage(content="Research Stripe"),
        ToolMessage(content=_search("Stripe Inc"), name="search_company_overview", tool_call_id="old"),
        AIMessage(content="old dossier"),
        HumanMessage(content="Now research Acme"),
    ]

    result = asyncio.run(agent({"messages": messages, "task_context": {}}))

    assert "company_profile" not in result["task_context"]
