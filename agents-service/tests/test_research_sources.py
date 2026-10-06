"""Where study material comes from and what is allowed to count as it:
book and paper catalogues, the page-kind filter, the optional model check
of search results, and rejecting a write-up that isn't a module."""
import asyncio
import json
import pytest
from langchain_core.messages import AIMessage

import agents.research_agent as research_module
import tools.research_tools as research_tools
from agents.research_agent import ContentResearchAgent, ResearchAgentError, ResearchRequest, module_markdown
from core.config import Settings
from memory.local_adapter import LocalMemoryProvider
from test_research_agent import FakeLLM, FakeTool, fake_tools
from tools.relevance import not_learning_material

REQUEST = ResearchRequest(user_id="u1", target_role="Forward Deployed Engineer", target_company="Acme",
                          topic_or_skill_gap="Data Strategy", domain="Consulting")


# ---- page kinds ----------------------------------------------------------------

@pytest.mark.parametrize("url, title", [
    ("https://www.placementindia.com/job-search/sales-consultant-jobs-in-salt-lake.htm", "Sales Consultant Job Vacancies"),
    ("https://co.expertini.com/job/client-facing-solutions-delivery-lead", "Client-Facing Solutions Delivery Lead"),
    ("https://careers.example.com/openings", "Open roles"),
    ("https://www.appone.com/MainInfoReq.asp?R_ID=2664524", "Job Information: Azure Success Architect Job"),
])
def test_job_adverts_are_not_learning_material(url, title):
    assert not_learning_material(url, title) == "job posting"


def test_sales_pages_are_not_learning_material():
    assert not_learning_material("https://acme.example/data-strategy", "Data Strategy - Acme",
                                 "Our consultants help you. Request a demo today.") == "sales page"


@pytest.mark.parametrize("url", [
    "https://kubernetes.io/docs/concepts/workloads/controllers/job/",
    "https://docs.celery.dev/jobs/intro",
    "https://realpython.com/python-jobs-queue/",
    "https://www.oreilly.com/library/view/fluent-python/",
])
def test_documentation_about_jobs_is_still_learning_material(url):
    assert not_learning_material(url, "Jobs | Docs", "How to run a Job to completion.") == ""


def agent(tools, llm=None, judge=None):
    return ContentResearchAgent(llm=llm or FakeLLM(), memory=LocalMemoryProvider(), tools=tools, judge_llm=judge)


def results(*items):
    return FakeTool({"source": "serpapi", "results": [
        {"title": title, "url": url, "snippet": snippet, "resource_type": "documentation"} for title, url, snippet in items]})


EMPTY = FakeTool({"source": "serpapi", "results": []})


def test_job_adverts_never_become_resources():
    docs = results(("Data Strategy Lead Job in Dubai", "https://jobs.example/job/1/data-strategy-lead", "Apply"),
                   ("Data strategy guide", "https://docs.example/data-strategy", "How to write a data strategy."))
    result = asyncio.run(agent(fake_tools(docs=docs, books=EMPTY, papers=EMPTY, videos=EMPTY)).run(REQUEST, memories=[]))

    assert [r["url"] for r in result["module"]["resources"]] == ["https://docs.example/data-strategy"]


# ---- model check of results -------------------------------------------------------

class Judge:
    def __init__(self, content=None, error=None):
        self.content, self.error, self.prompts = content, error, []

    async def ainvoke(self, prompt, config=None):
        self.prompts.append(prompt)
        if self.error:
            raise self.error
        return AIMessage(content=self.content)


DOCS = results(("Data Strategy & Advisory - Cleartelligence", "https://consultancy.example/data-strategy", "Data strategy for you."),
               ("Data strategy guide", "https://docs.example/data-strategy", "How to write a data strategy."))


def judged(monkeypatch, judge):
    monkeypatch.setattr(research_module, "settings", Settings(research_judge_llm="fast"))
    tools = fake_tools(docs=DOCS, books=EMPTY, papers=EMPTY, videos=EMPTY)
    result = asyncio.run(agent(tools, judge=judge).run(REQUEST, memories=[]))
    return [r["url"] for r in result["module"]["resources"]]


def test_the_judge_drops_results_word_matching_cannot(monkeypatch):
    judge = Judge('{"reject": [1]}')

    assert judged(monkeypatch, judge) == ["https://docs.example/data-strategy"]
    assert "1. [docs] Data Strategy & Advisory - Cleartelligence" in judge.prompts[0]
    assert "Forward Deployed Engineer" in judge.prompts[0] and "(Consulting)" in judge.prompts[0]


@pytest.mark.parametrize("judge", [
    Judge(error=RuntimeError("429 rate limit")), Judge("no json here"), Judge('{"reject": [1, 2]}'),
])
def test_a_failed_confused_or_reject_everything_judge_keeps_the_results(monkeypatch, judge):
    assert len(judged(monkeypatch, judge)) == 2


def test_the_judge_is_off_by_default():
    judge = Judge('{"reject": [1]}')
    tools = fake_tools(docs=DOCS, books=EMPTY, papers=EMPTY, videos=EMPTY)
    asyncio.run(agent(tools, judge=judge).run(REQUEST, memories=[]))

    assert judge.prompts == []


# ---- the write-up must be a module --------------------------------------------------

def test_reasoning_before_the_module_is_dropped():
    assert module_markdown("We need to produce a sheet...\n## Overview\nX.") == "## Overview\nX."
    assert module_markdown("<think>## Overview draft</think>\n## Overview\nX.") == "## Overview\nX."
    assert module_markdown("We need sections: Overview, Key Concepts. Let's list ## Books first") == ""


class SequenceLLM:
    def __init__(self, *contents):
        self.contents, self.prompts = list(contents), []

    async def ainvoke(self, messages):
        self.prompts.append(messages)
        return AIMessage(content=self.contents.pop(0))


def test_planning_notes_instead_of_a_module_are_retried_once_then_rejected():
    notes = "We need to produce a reference sheet with sections: Overview, Key Concepts..."
    retried = SequenceLLM(notes, "## Overview\nReal module.")
    result = asyncio.run(agent(fake_tools(), llm=retried).run(
        ResearchRequest(user_id="u1", target_role="SWE", target_company="Acme", topic_or_skill_gap="Dynamic Programming"),
        memories=[]))

    assert result["module"]["content_markdown"] == "## Overview\nReal module."
    assert "first line of your answer must be exactly: ## Overview" in retried.prompts[1][-1].content

    # notes twice: never stored; the topic keeps its resources with a short note
    kept = asyncio.run(agent(fake_tools(), llm=SequenceLLM(notes, notes)).run(
        ResearchRequest(user_id="u1", target_role="SWE", target_company="Acme", topic_or_skill_gap="Dynamic Programming"),
        memories=[]))
    assert notes not in kept["module"]["content_markdown"]
    assert kept["module"]["content_markdown"].startswith("## Overview\nDynamic Programming:")


# ---- catalogues ------------------------------------------------------------------------

class Response:
    def __init__(self, payload):
        self.payload = payload
        self.text = payload if isinstance(payload, str) else ""

    def json(self):
        return self.payload


@pytest.fixture
def catalogues(monkeypatch):
    live = Settings(serpapi_api_key="k", serpapi_enabled=True, books_source="catalogue", papers_source="arxiv")
    monkeypatch.setattr(research_tools, "settings", live)
    import tools.serpapi_client as serpapi_client
    monkeypatch.setattr(serpapi_client, "settings", live)
    monkeypatch.setattr(research_tools, "get_response_cache", lambda: None)
    calls = []

    def serve(responses):
        def fake_get(url, params):
            calls.append(url)
            outcome = responses[url]
            if isinstance(outcome, Exception):
                raise outcome
            return Response(outcome)
        monkeypatch.setattr(research_tools, "_http_get", fake_get)
        return calls
    return serve


OPEN_LIBRARY = {"docs": [
    {"key": "/works/OL1W", "title": "Claude Code: The Reliability Playbook", "author_name": ["R. Vale"],
     "first_publish_year": 2026, "edition_count": 1, "readinglog_count": 0},
    {"key": "/works/OL2W", "title": "Enterprise Integration", "author_name": ["F. Cummins"],
     "first_publish_year": 2002, "edition_count": 3, "readinglog_count": 4},
    {"key": "/works/OL3W", "title": "Enterprise Integration Patterns", "author_name": ["G. Hohpe", "B. Woolf"],
     "first_publish_year": 2003, "edition_count": 1, "readinglog_count": 250},
]}


def test_books_come_from_the_catalogue_and_only_established_ones(catalogues):
    """Two self-published 2026 titles nobody had read were recommended:
    a catalogue lists everything, so being listed is not enough."""
    calls = catalogues({research_tools.OPEN_LIBRARY_URL: OPEN_LIBRARY})

    result = research_tools.search_books.invoke({"topic": "enterprise integration", "limit": 2})

    assert calls == [research_tools.OPEN_LIBRARY_URL]  # no SerpApi credit, no Google API
    assert [r["title"] for r in result["results"]] == [
        "Enterprise Integration Patterns \u2014 G. Hohpe, B. Woolf",  # most read first
        "Enterprise Integration \u2014 F. Cummins",                   # several editions
    ]
    assert result["results"][0]["url"] == "https://openlibrary.org/works/OL3W"


def test_a_tool_with_no_established_book_gets_no_book(catalogues):
    catalogues({research_tools.OPEN_LIBRARY_URL: {"docs": OPEN_LIBRARY["docs"][:1]}})

    assert research_tools.search_books.invoke({"topic": "claude code"})["results"] == []


ARXIV_FEED = """<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><id>http://arxiv.org/abs/2212.08073v1</id><title>Constitutional AI:
  Harmlessness from AI Feedback</title><summary>We experiment with methods.</summary>
<published>2022-12-15T00:00:00Z</published><author><name>Y. Bai</name></author><author><name>S. Kadavath</name></author></entry>
</feed>"""


def test_papers_come_from_arxiv_without_a_serpapi_credit(catalogues):
    calls = catalogues({research_tools.ARXIV_URL: ARXIV_FEED})
    queries = []
    served = research_tools._http_get
    research_tools._http_get = lambda url, params: queries.append(params["search_query"]) or served(url, params)
    try:
        result = research_tools.search_academic_papers.invoke({"topic": "constitutional AI"})
    finally:
        research_tools._http_get = served

    assert calls == [research_tools.ARXIV_URL]
    assert queries == ['all:"constitutional AI"']  # a phrase: any-word matching returned a maths paper
    assert result["results"] == [{
        "title": "Constitutional AI: Harmlessness from AI Feedback", "url": "https://arxiv.org/abs/2212.08073v1",
        "snippet": "We experiment with methods.", "source": "Y. Bai, S. Kadavath", "resource_type": "paper",
        "published": "2022-12-15"}]


def test_a_paper_must_match_the_whole_topic_not_one_word_of_it():
    """"Client-Facing Solutions" got "Symmetric Solutions to Symmetric
    Partial Difference Equations": half the topic's words matched."""
    request = ResearchRequest(user_id="u1", target_role="FDE", target_company="Acme",
                              topic_or_skill_gap="Client-Facing Solutions")
    papers = FakeTool({"source": "arxiv", "results": [
        {"title": "Symmetric Solutions to Symmetric Partial Difference Equations", "url": "https://arxiv.org/abs/1",
         "snippet": "Linear difference equations.", "resource_type": "paper"},
        {"title": "Delivering client-facing solutions with LLMs", "url": "https://arxiv.org/abs/2",
         "snippet": "A field study.", "resource_type": "paper"}]})

    result = asyncio.run(agent(fake_tools(docs=EMPTY, books=EMPTY, videos=EMPTY, papers=papers)).run(request, memories=[]))

    assert [r["url"] for r in result["module"]["resources"]] == ["https://arxiv.org/abs/2"]


# ---- company platform module -------------------------------------------------------------

PROFILE = {"name": "Anthropic", "website": "https://www.anthropic.com/",
           "brief": {"products": ["Claude"], "tech_stack": ["Constitutional AI", "multi-cloud infrastructure"]}}


def test_company_module_queries_come_from_the_profile_not_from_code():
    from agents.research_agent import company_module_request

    request = company_module_request(PROFILE, "u1", "Forward Deployed Engineer", "Anthropic")

    assert request.topic_or_skill_gap == "Anthropic Claude platform"
    assert request.official_queries["docs"].startswith("site:anthropic.com ")
    assert request.official_queries["repos"].startswith("site:github.com Anthropic Claude ")
    # a product already named after the company is not repeated
    uber = company_module_request({"name": "Uber", "website": "uber.com", "brief": {"products": ["Uber Marketplace"]}},
                                  "u1", "SWE", "Uber")
    assert uber.topic_or_skill_gap == "Uber Marketplace platform"
    assert request.official_queries["papers"] == "Constitutional AI"
    assert company_module_request({}, "u1", "SWE", "Acme") is None  # nothing to search by
    no_site = company_module_request({"name": "Acme", "brief": {"products": ["Anvil"]}}, "u1", "SWE", "Acme")
    assert no_site.official_queries["docs"] == '"Acme" official developer documentation'


def test_company_module_searches_official_sources_and_trusts_their_wording():
    from agents.research_agent import company_module_request

    docs = FakeTool({"source": "serpapi", "results": [
        {"title": "Tool use - Docs", "url": "https://docs.anthropic.com/tool-use", "snippet": "Function calling.",
         "resource_type": "documentation"}]})
    papers = FakeTool({"source": "arxiv", "results": [
        {"title": "Constitutional AI: Harmlessness from AI Feedback", "url": "https://arxiv.org/abs/2212.08073",
         "snippet": "We experiment.", "resource_type": "paper"}]})
    books = FakeTool({"source": "open_library", "results": []})
    tools = fake_tools(docs=docs, repos=docs, papers=papers, books=books, videos=EMPTY)

    result = asyncio.run(agent(tools).run(company_module_request(PROFILE, "u1", "FDE", "Anthropic"), memories=[]))

    # neither title says "Anthropic Claude platform": the site: query is what scopes them
    assert [r["url"] for r in result["module"]["resources"]] == [
        "https://docs.anthropic.com/tool-use", "https://arxiv.org/abs/2212.08073"]
    assert docs.calls[0]["query"].startswith("site:anthropic.com") and docs.calls[1]["query"].startswith("site:github.com")
    assert books.calls == []  # no books for a company platform


# ---- choosing what to search before searching -----------------------------------------------

def scoped(monkeypatch, answer=None, error=None):
    monkeypatch.setattr(research_module, "settings", Settings(research_scope_llm="fast"))
    scope = Judge(answer, error)
    tools = fake_tools()
    researcher = ContentResearchAgent(llm=FakeLLM(), memory=LocalMemoryProvider(), tools=tools, scope_llm=scope)
    asyncio.run(researcher({"user_id": "u1", "skill_gaps": ["Dynamic Programming", "Collaboration"],
                            "memory_context": [], "task_context": {"target_role": "SWE", "target_company": "Acme"}}))
    return tools, scope


def test_only_the_chosen_kinds_are_searched(monkeypatch):
    """One call for the whole batch, before any search: a soft skill gets
    no book or paper search at all, instead of searches whose results are
    then thrown away."""
    tools, scope = scoped(monkeypatch, '{"1": ["docs", "videos", "books", "papers"], "2": ["videos"]}')

    assert len(scope.prompts) == 1 and "1. Dynamic Programming" in scope.prompts[0] and "2. Collaboration" in scope.prompts[0]
    assert (len(tools["docs"].calls), len(tools["books"].calls), len(tools["papers"].calls), len(tools["videos"].calls)) == (1, 1, 1, 2)


def test_a_topic_always_keeps_something_to_read_or_watch(monkeypatch):
    tools, _ = scoped(monkeypatch, '{"1": ["books"], "2": []}')

    assert len(tools["docs"].calls) == 2 and len(tools["videos"].calls) == 2
    assert len(tools["books"].calls) == 1 and tools["papers"].calls == []


@pytest.mark.parametrize("answer, error", [(None, RuntimeError("429")), ("not json", None), ('{"9": ["docs"]}', None)])
def test_without_a_usable_selection_every_kind_is_searched(monkeypatch, answer, error):
    tools, _ = scoped(monkeypatch, answer, error)

    assert all(len(tools[kind].calls) == 2 for kind in ("docs", "books", "papers", "videos"))


# ---- compact write-up for the pipeline ----------------------------------------------------

def test_the_pipeline_asks_for_a_compact_note_and_chat_keeps_the_full_sheet():
    """The plan takes links from the search results and the schedule from
    the planner; re-listing every link and drafting a study plan in the
    write-up was most of its output, read by nothing."""
    pipeline_llm, chat_llm = FakeLLM(), FakeLLM()

    result = asyncio.run(ContentResearchAgent(llm=pipeline_llm, memory=LocalMemoryProvider(), tools=fake_tools())(
        {"user_id": "u1", "skill_gaps": ["Dynamic Programming"], "memory_context": [],
         "task_context": {"target_role": "SWE", "target_company": "Acme"}}))
    asyncio.run(agent(fake_tools(), llm=chat_llm).run(
        ResearchRequest(user_id="u1", target_role="SWE", target_company="Acme", topic_or_skill_gap="Dynamic Programming"),
        memories=[]))

    system, user = pipeline_llm.prompts[0][0].content, pipeline_llm.prompts[0][1].content
    assert '"key_concepts"' in system and "Return ONLY a JSON object" in system and "Study Plan" not in system
    assert "https://" not in user  # titles and short snippets only: nothing to cite
    assert "Dynamic Programming guide" in user
    # the references are still all there, from the search results
    assert len(result["researched_materials"][0]["resources"]) == 4

    assert "## Study Plan" in chat_llm.prompts[0][0].content and "https://docs.example/dp" in chat_llm.prompts[0][1].content


def test_partly_known_gaps_are_researched_past_the_basics_and_without_transcripts():
    tools = fake_tools()
    researcher = ContentResearchAgent(llm=FakeLLM(), memory=LocalMemoryProvider(), tools=tools)
    result = asyncio.run(researcher({
        "user_id": "u1", "skill_gaps": ["Dynamic Programming"], "memory_context": [],
        "task_context": {"target_role": "SWE", "target_company": "Acme", "skill_gap": {"priority_gaps": [
            {"skill": "Dynamic Programming", "status": "partial"}]}}}))

    assert result["researched_materials"][0]["depth"] == "intermediate"
    assert "best practices" in tools["docs"].calls[0]["query"]
    # a compact note uses nothing from a transcript; fetching one cost 20s when it hung
    assert tools["transcript"].calls == []


# ---- the compact note is JSON from the model, Markdown from code ---------------------------

NOTE = {"overview": "Dynamic programming solves problems by reusing subproblem answers.",
        "key_concepts": [{"name": "Memoization", "definition": "cache results top-down"},
                         {"name": "**Tabulation**", "definition": "fill a table bottom-up"},
                         "Optimal substructure: the answer is built from sub-answers"],
        "practice": ["Climbing Stairs: 1-D recurrence", "Longest Common Subsequence: 2-D table"]}
NOTE_MD = ("## Overview\nDynamic programming solves problems by reusing subproblem answers.\n\n"
           "## Key Concepts\n- **Memoization**: cache results top-down\n- **Tabulation**: fill a table bottom-up\n"
           "- **Optimal substructure**: the answer is built from sub-answers\n\n"
           "## Practice\n- Climbing Stairs: 1-D recurrence\n- Longest Common Subsequence: 2-D table")


def test_a_json_note_is_laid_out_as_the_same_three_sections_every_time():
    from agents.research_agent import note_markdown

    assert note_markdown(json.dumps(NOTE)) == NOTE_MD
    assert note_markdown("<think>plan</think>```json\n" + json.dumps(NOTE) + "\n```") == NOTE_MD
    # a model that answered in Markdown anyway is still accepted
    assert note_markdown("## Overview\nX.\n## Key Concepts\n- **A**: b") == "## Overview\nX.\n## Key Concepts\n- **A**: b"
    # no overview, or too few concepts, is not a note
    assert note_markdown(json.dumps({**NOTE, "overview": ""})) == ""
    assert note_markdown(json.dumps({**NOTE, "key_concepts": NOTE["key_concepts"][:2]})) == ""
    assert note_markdown("We need to produce a JSON object with overview...") == ""


def test_the_planner_reads_its_concepts_from_a_json_note():
    from tools.plan_builder import key_concepts, overview

    result = asyncio.run(ContentResearchAgent(llm=FakeLLM(json.dumps(NOTE)), memory=LocalMemoryProvider(), tools=fake_tools())(
        {"user_id": "u1", "skill_gaps": ["Dynamic Programming"], "memory_context": [],
         "task_context": {"target_role": "SWE", "target_company": "Acme"}}))

    markdown = result["researched_materials"][0]["content_markdown"]
    assert markdown == NOTE_MD
    assert key_concepts(markdown) == ["Memoization", "Tabulation", "Optimal substructure"]
    assert overview(markdown).startswith("Dynamic programming solves")
