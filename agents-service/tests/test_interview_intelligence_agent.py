import asyncio

import pytest
from langchain_core.messages import AIMessage

from agents.interview_intelligence_agent import (
    InterviewIntelligenceAgent,
    InterviewIntelligenceError,
    InterviewIntelligenceRequest,
)


class FakeTool:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.calls = []

    def invoke(self, payload):
        self.calls.append(payload)
        if self.error:
            raise self.error
        return self.result


class FakeLLM:
    def __init__(self, content="## Summary\nFour reported rounds [S1]. [S99]"):
        self.content = content
        self.prompts = []

    async def ainvoke(self, messages):
        self.prompts.append(messages)
        return AIMessage(content=self.content)


def make_tools(**overrides):
    tools = {
        "search": FakeTool({"source": "serpapi", "results": [
            {"title": "Candidate report", "url": "https://forum.example/report", "snippet": "Two coding rounds.", "source": "Forum"},
        ], "ai_overview": {"page_token": None, "text": "", "references": []}}),
        "questions": FakeTool({"source": "serpapi", "results": [
            {"title": "What is the system design round?", "url": "https://google.example/questions", "snippet": "Related question."},
        ]}),
        "videos": FakeTool({"source": "serpapi", "results": [
            {"title": "Interview walkthrough", "url": "https://youtube.example/video", "snippet": "Role walkthrough.", "source": "Channel"},
        ]}),
        "news": FakeTool({"source": "serpapi", "results": [
            {"title": "Hiring update", "url": "https://news.example/update", "snippet": "Public report.", "date": "2026-01-02"},
        ]}),
    }
    tools.update(overrides)
    return tools


REQUEST = InterviewIntelligenceRequest(target_company="Acme", target_role="Software Engineer")


def test_agent_searches_all_sources_and_links_only_verified_citations():
    tools = make_tools()
    llm = FakeLLM()
    agent = InterviewIntelligenceAgent(llm=llm, tools=tools)
    events = []

    result = asyncio.run(agent.run(REQUEST, on_event=events.append))

    brief = result["brief"]
    assert all(tool.calls for tool in tools.values())
    assert all("Acme" in tool.calls[0]["query"] for tool in tools.values())
    assert "[S1](https://forum.example/report)" in brief["content_markdown"]
    assert "[source not provided]" in brief["content_markdown"]
    assert "https://news.example/update" in brief["content_markdown"]
    assert "### YouTube Videos" in brief["content_markdown"]
    assert "### Google Search Results" in brief["content_markdown"]
    assert "### Google AI Overview References" in brief["content_markdown"]
    assert "### Related Questions" in brief["content_markdown"]
    assert "### Recent News Articles" in brief["content_markdown"]
    assert len(brief["sources"]) == 4
    assert result["handoff"]["data"]["source_count"] == 4
    assert "content_markdown" not in events[-1]["payload"]
    prompt = llm.prompts[0][1].content
    assert "## Summary" in prompt
    assert "## Reported Interview Rounds" in prompt
    assert "## Resource-by-Resource Interpretation" in prompt
    assert "### Google AI Overview" in prompt
    assert [(event["step"], event["status"]) for event in events] == [
        ("search_interview_sources", "running"),
        ("search_interview_sources", "completed"),
        ("synthesize_interview_brief", "running"),
        ("synthesize_interview_brief", "completed"),
    ]


def test_agent_continues_with_partial_source_failures():
    tools = make_tools(videos=FakeTool(error=RuntimeError("YouTube unavailable")))
    agent = InterviewIntelligenceAgent(llm=FakeLLM(), tools=tools)

    result = asyncio.run(agent.run(REQUEST))

    assert result["brief"]["source_errors"] == {"videos": "YouTube unavailable"}
    assert len(result["brief"]["sources"]) == 3


def test_a_hanging_source_is_capped_by_its_own_timeout_not_the_whole_step(monkeypatch):
    """One slow/hanging source must not be able to eat the whole step's
    budget away from the other sources running alongside it."""
    import time as time_module

    import agents.interview_intelligence_agent as interview_intelligence_agent

    class TinyToolBudget:
        research_timeout_seconds = 30
        research_tool_timeout_seconds = 0.05
        research_min_relevance = 0.5
        research_synthesis_timeout_seconds = 45

    monkeypatch.setattr(interview_intelligence_agent, "settings", TinyToolBudget())

    class HangingTool:
        def invoke(self, payload):
            time_module.sleep(1)  # far longer than research_tool_timeout_seconds
            return {"source": "serpapi", "results": []}

    tools = make_tools(news=HangingTool())
    agent = InterviewIntelligenceAgent(llm=FakeLLM(), tools=tools)

    result = asyncio.run(agent.run(REQUEST))

    assert "news" in result["brief"]["source_errors"]
    assert len(result["brief"]["sources"]) == 3  # search + questions + videos still succeeded


def test_agent_fetches_ai_overview_immediately_from_search_page_token():
    search = FakeTool({"source": "serpapi", "results": [
        {"title": "Interview report", "url": "https://search.example/report", "snippet": "Candidate experience."},
    ], "ai_overview": {"page_token": "fresh-token", "text": "", "references": []}})
    ai_overview = FakeTool({"source": "serpapi", "text": "Google's overview reports four rounds.", "results": [
        {"title": "Interview round guide", "url": "https://overview.example/rounds", "snippet": "Four reported rounds."},
    ]})
    tools = make_tools(search=search, ai_overview=ai_overview)
    llm = FakeLLM("## Summary\nGoogle's overview says four rounds [A1].")

    result = asyncio.run(InterviewIntelligenceAgent(llm=llm, tools=tools).run(REQUEST))

    assert ai_overview.calls == [{"page_token": "fresh-token"}]
    assert "Google's overview reports four rounds." in llm.prompts[0][1].content
    assert "[A1](https://overview.example/rounds)" in result["brief"]["content_markdown"]


def test_agent_uses_available_youtube_transcripts():
    videos = FakeTool({"source": "serpapi", "results": [
        {"title": "Interview walkthrough", "url": "https://youtube.example/video",
         "video_id": "dQw4w9WgXcQ", "snippet": "Coding interview walkthrough."},
    ]})
    transcript = FakeTool({"available": True, "excerpt": "Candidate describes a live coding round."})
    tools = make_tools(videos=videos, transcript=transcript)
    llm = FakeLLM("## Candidate Experiences\nA walkthrough reports live coding [V1].")

    result = asyncio.run(InterviewIntelligenceAgent(llm=llm, tools=tools).run(REQUEST))

    assert transcript.calls == [{"video_id": "dQw4w9WgXcQ"}]
    assert "Candidate describes a live coding round" in llm.prompts[0][1].content
    assert result["brief"]["video_transcripts"][0]["video_id"] == "dQw4w9WgXcQ"


def test_agent_marks_mock_sources_and_warns_synthesis_not_to_treat_them_as_evidence():
    tools = make_tools()
    for tool in tools.values():
        tool.result["source"] = "mock"
        tool.result["results"][0]["title"] = "[mock] Search page placeholder"
    llm = FakeLLM()

    result = asyncio.run(InterviewIntelligenceAgent(llm=llm, tools=tools).run(REQUEST))

    assert result["brief"]["uses_mock_sources"] is True
    assert "never treat them as evidence" in llm.prompts[0][1].content


def test_agent_fails_when_every_source_fails():
    tools = {kind: FakeTool(error=RuntimeError("unavailable")) for kind in ("search", "questions", "videos", "news")}
    events = []

    with pytest.raises(InterviewIntelligenceError):
        asyncio.run(InterviewIntelligenceAgent(llm=FakeLLM(), tools=tools).run(REQUEST, on_event=events.append))

    assert events[-1]["step"] == "search_interview_sources"
    assert events[-1]["status"] == "failed"


@pytest.mark.parametrize("field", ["target_company", "target_role"])
def test_request_requires_company_and_role(field):
    values = {"target_company": "Acme", "target_role": "Software Engineer"}
    values[field] = " "

    with pytest.raises(ValueError, match=field):
        InterviewIntelligenceRequest(**values)