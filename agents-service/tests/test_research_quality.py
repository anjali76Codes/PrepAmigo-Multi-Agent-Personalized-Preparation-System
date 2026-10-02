"""Research quality guards: role-anchored queries, off-topic and duplicate
result removal, role focus in synthesis, and link grounding."""
import asyncio

from langchain_core.messages import AIMessage

from agents.research_agent import (
    ContentResearchAgent,
    ResearchRequest,
    build_queries,
    normalize_links,
    role_focus,
)
from memory.local_adapter import LocalMemoryProvider
from test_research_agent import FakeLLM, FakeTool, fake_tools

REQUEST = ResearchRequest(
    user_id="u1", target_role="Forward Deployed Engineer", target_company="Acme",
    topic_or_skill_gap="Pre-Sales Engineering",
)


def run(tools, llm=None, request=REQUEST):
    agent = ContentResearchAgent(llm=llm or FakeLLM(), memory=LocalMemoryProvider(), tools=tools)
    return asyncio.run(agent.run(request, memories=[]))


def test_web_queries_quote_the_topic_add_the_category_and_not_the_role_title():
    """Quoting stops Google dropping the topic words; the role title was
    left out after live testing showed it took over the ranking."""
    for depth in ("foundational", "intermediate", "advanced", "revision"):
        queries = build_queries("Claude", "Forward Deployed Engineer", "Acme", depth, domain="AI tools")
        assert '"Claude"' in queries["docs"]
        for kind in ("docs", "books"):
            assert "AI tools" in queries[kind] and "Forward Deployed Engineer" not in queries[kind]
        # book catalogues take a plain query; job adverts and sales pages
        # are excluded from the web search itself
        assert queries["books"].endswith("Claude AI tools") and "-jobs" in queries["docs"]
    assert build_queries("Claude", "", "", "foundational")["docs"] == '"Claude" guide OR tutorial -jobs -vacancy -careers -pricing'


def test_video_queries_carry_the_category_to_disambiguate_the_topic():
    """A bare "Pinecone explained for beginners" returned a pine-cone
    wreath craft tutorial."""
    for depth in ("foundational", "intermediate", "advanced", "revision"):
        assert "vector database" in build_queries("Pinecone", "SWE", "Acme", depth, domain="vector database")["videos"]


def test_category_lookup_tolerates_a_reworded_skill_name():
    from agents.research_agent import domain_for

    domains = {"rest apis": "Backend", "pinecone": "Vector databases"}
    assert domain_for("REST API", domains) == "Backend"
    assert domain_for("Pinecone", domains) == "Vector databases"
    assert domain_for("Figma", domains) == ""


def test_each_gap_carries_its_job_intelligence_category():
    from agents.research_agent import skill_domains

    domains = skill_domains({"skills": [{"name": "Claude", "category": "AI tools"}, {"name": "Python"}]})
    assert domains == {"claude": "AI tools"}


def test_off_topic_results_are_dropped_and_counted():
    tools = fake_tools(docs=FakeTool({"source": "serpapi", "results": [
        {"title": "Voting Assistance Guide", "url": "https://fvap.example/guide", "resource_type": "documentation"},
        {"title": "Pre-sales engineering playbook", "url": "https://docs.example/presales", "resource_type": "documentation"},
    ]}), books=FakeTool({"source": "serpapi", "results": [
        {"title": "Book", "url": "https://en.wikipedia.org/wiki/Book", "resource_type": "book"},
    ]}), videos=FakeTool({"source": "serpapi", "results": []}),
        papers=FakeTool({"source": "arxiv", "results": []}))

    result = run(tools)

    urls = [r["url"] for r in result["module"]["resources"]]
    assert urls == ["https://docs.example/presales"]
    search_done = next(e for e in result["events"] if e["step"] == "execute_searches" and e["status"] == "completed")
    assert search_done["payload"]["filtered_off_topic"] == {"docs": 1, "books": 1}


def test_mock_and_fixture_results_are_never_relevance_filtered():
    tools = fake_tools(docs=FakeTool({"source": "dummy", "results": [
        {"title": "Acme Engineering", "url": "https://example.test/eng", "resource_type": "documentation"},
    ]}), books=FakeTool({"source": "dummy", "results": []}), videos=FakeTool({"source": "dummy", "results": []}))

    assert [r["url"] for r in run(tools)["module"]["resources"]] == ["https://example.test/eng"]


def test_same_video_from_two_searches_is_kept_once_as_a_video():
    """The reviewed plan listed one tutorial twice: once from the web search
    (URL with &vl=en, typed as documentation) and once from YouTube search."""
    video = "https://www.youtube.com/watch?v=r2vYObllqJU"
    tools = fake_tools(docs=FakeTool({"source": "serpapi", "results": [
        {"title": "Pre-sales engineering crash course", "url": video + "&vl=en", "resource_type": "documentation"},
    ]}), books=FakeTool({"source": "serpapi", "results": []}), videos=FakeTool({"source": "serpapi", "results": [
        {"title": "Pre-sales engineering crash course!", "url": video, "resource_type": "video", "video_id": "r2vYObllqJU"},
    ]}))

    resources = run(tools)["module"]["resources"]

    assert len(resources) == 1
    assert resources[0]["resource_type"] == "video" and resources[0]["video_id"] == "r2vYObllqJU"


def test_results_are_trimmed_back_to_the_depth_limit_after_overfetching():
    many = [{"title": f"Pre-sales engineering guide {i}", "url": f"https://docs.example/{i}",
             "resource_type": "documentation"} for i in range(10)]
    docs = FakeTool({"source": "serpapi", "results": many})
    tools = fake_tools(docs=docs, books=FakeTool({"source": "serpapi", "results": []}),
                       videos=FakeTool({"source": "serpapi", "results": []}))

    resources = run(tools)["module"]["resources"]

    assert docs.calls[0]["limit"] == 10  # asked for twice the foundational limit of 5
    assert len(resources) == 5


def test_role_focus_reaches_the_synthesis_prompt():
    llm = FakeLLM()
    request = ResearchRequest(**{**REQUEST.__dict__, "focus": "Responsibilities: integrate LLM APIs for customers"})

    run(fake_tools(), llm=llm, request=request)

    prompt = llm.prompts[0][1].content
    assert "integrate LLM APIs for customers" in prompt


def test_role_focus_is_built_from_job_intelligence():
    focus = role_focus({
        "commonResponsibilities": ["Deploy models with customers", "Build integrations"],
        "skills": [{"name": "Python"}, {"name": "LLM APIs"}, "not-a-dict"],
    })
    assert focus == "Responsibilities: Deploy models with customers; Build integrations. Skills employers list: Python, LLM APIs"
    assert role_focus(None) == ""


def test_resources_are_shown_to_the_model_as_markdown_links():
    llm = FakeLLM()
    run(fake_tools(), llm=llm, request=ResearchRequest(
        user_id="u1", target_role="SWE", target_company="Acme", topic_or_skill_gap="Dynamic Programming"))

    prompt = llm.prompts[0][1].content
    assert "[Dynamic Programming guide](https://docs.example/dp)" in prompt
    assert "<https://" not in prompt


def test_normalize_links_repairs_angle_bracket_links_and_unlinks_invented_ones():
    allowed = ["https://www.youtube.com/watch?v=js_HSbgesX8", "https://docs.example/a"]
    markdown = (
        "- [Enterprise Integration <https://www.youtube.com/watch?v=js_HSbgesX8>]: basics\n"
        "- [Intro [part 1] <https://docs.example/a>]: nested brackets\n"
        "- [MuleSoft QuickStart <https://help.mulesoft.example/start]: invented, no closing >\n"
        "- [Real](https://docs.example/a) and [Made up](https://nowhere.example/x)\n"
        "- 1 hour: watch <https://www.youtube.com/watch?v=js_HSbgesX8> then read <https://nowhere.example/y>\n"
    )

    fixed, removed = normalize_links(markdown, allowed)

    assert "[Enterprise Integration](https://www.youtube.com/watch?v=js_HSbgesX8)" in fixed
    assert "[Intro [part 1]](https://docs.example/a)" in fixed
    assert "MuleSoft QuickStart" in fixed and "mulesoft.example" not in fixed
    assert "[Real](https://docs.example/a)" in fixed and "Made up" in fixed and "nowhere.example" not in fixed
    assert "<https://www.youtube.com/watch?v=js_HSbgesX8>" in fixed
    assert removed == 3


def test_synthesized_module_has_no_invented_links():
    llm = FakeLLM(content="## Overview\nX.\n## Practice\n- Try [Fake Lab](https://invented.example/lab)\n"
                          "- Read [Dynamic Programming guide <https://docs.example/dp>]\n")
    result = run(fake_tools(), llm=llm, request=ResearchRequest(
        user_id="u1", target_role="SWE", target_company="Acme", topic_or_skill_gap="Dynamic Programming"))

    content = result["module"]["content_markdown"]
    assert "invented.example" not in content and "Fake Lab" in content
    assert "[Dynamic Programming guide](https://docs.example/dp)" in content
