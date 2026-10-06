import asyncio
import dataclasses
import json
import re
from datetime import date

import pytest
from langchain_core.messages import AIMessage

import agents.planner_agent as planner_module
from agents.planner_agent import PlannerAgent, allocate_days, fallback_days, key_concepts
from schemas.study_plan import StudyPlan

CLAUDE_MD = """## Overview
Claude is Anthropic's assistant platform.

## Key Concepts
- **Prompt Engineering**: crafting instructions
- **Tool Use**: letting the model call functions
- **Context Windows**: how much the model sees
- **Evaluations**: measuring output quality

## Practice
- Build a demo
"""

MODULES = [
    {
        "topic": "Claude",
        "depth": "foundational",
        "content_markdown": CLAUDE_MD,
        "resources": [
            {"title": "Claude docs", "url": "https://docs.example/claude", "snippet": "Docs", "source": "Anthropic", "resource_type": "documentation"},
            {"title": "Claude book", "url": "https://books.example/claude", "snippet": "Book", "resource_type": "book"},
            {"title": "Claude video", "url": "https://youtube.example/claude", "snippet": "Video", "resource_type": "video"},
            {"title": "Claude paper", "url": "https://papers.example/claude", "snippet": "Paper", "resource_type": "paper"},
            {"title": "Broken link", "url": "not-a-url", "resource_type": "documentation"},
        ],
    },
    {
        "topic": "Enterprise Integration",
        "depth": "foundational",
        "content_markdown": "## Overview\nConnecting systems.\n\n## Key Concepts\n- **Messaging**: async queues\n",
        "resources": [
            {"title": "EI docs", "url": "https://docs.example/ei", "snippet": "...", "resource_type": "documentation"},
        ],
    },
]

GAPS = [
    {"skill": "Enterprise Integration", "status": "partial", "effort": "Medium"},
    {"skill": "Claude", "status": "missing", "effort": "High"},
    {"skill": "Salesforce", "status": "missing", "effort": "High"},  # research failed/skipped: no module
]


class ChunkLLM:
    """Answers each planner chunk prompt with exactly the days it asks for,
    recording prompts and the peak number of overlapping calls."""

    def __init__(self, fail_topics=(), short_topics=()):
        self.prompts, self.active, self.peak = [], 0, 0
        self.fail_topics, self.short_topics = set(fail_topics), set(short_topics)

    async def ainvoke(self, prompt, config=None):
        self.prompts.append(prompt)
        self.active += 1
        self.peak = max(self.peak, self.active)
        await asyncio.sleep(0)
        self.active -= 1
        topic = re.search(r'studying "(.+?)"', prompt).group(1)
        first = int(re.search(r"Plan days (\d+)-", prompt).group(1))
        count = int(re.search(r"EXACTLY (\d+) days", prompt).group(1))
        if topic in self.fail_topics:
            raise RuntimeError("model unavailable")
        if topic in self.short_topics:
            count -= 1
        days = [{"title": f"{topic} day {first + i}", "objectives": [f"Objective {first + i}"]} for i in range(count)]
        return AIMessage(content=json.dumps({"days": days}))


class FakeLLM:
    def __init__(self, content=None, error=None):
        self.content, self.error = content, error

    async def ainvoke(self, prompt, config=None):
        if self.error:
            raise self.error
        return AIMessage(content=self.content)


def build(llm=None, total_days=10, modules=MODULES, gaps=GAPS, **kw):
    return asyncio.run(PlannerAgent(llm=llm or ChunkLLM()).build_plan(
        modules, gaps, "FDE", "Anthropic", start_date=date(2026, 1, 1), total_days=total_days, **kw))


@pytest.fixture
def planner_settings(monkeypatch):
    def apply(**overrides):
        monkeypatch.setattr(planner_module, "settings", dataclasses.replace(planner_module.settings, **overrides))
    return apply


# ---- allocation -----------------------------------------------------------

@pytest.mark.parametrize(("weights", "total"), [([2, 2, 1], 45), ([2, 1], 60), ([1, 1, 1, 1, 1, 1, 1], 45), ([2], 7)])
def test_allocate_days_sums_exactly_and_follows_the_weights(weights, total):
    days = allocate_days(weights, total)
    assert sum(days) == total and min(days) >= 1
    for (w1, d1), (w2, d2) in zip(zip(weights, days), zip(weights[1:], days[1:])):
        if w1 > w2:
            assert d1 > d2


def test_allocate_days_with_fewer_days_than_topics_keeps_the_highest_priority():
    assert allocate_days([2, 2, 1, 1], 2) == [1, 1, 0, 0]


# ---- a 45-day plan ----------------------------------------------------------

def test_default_45_day_plan_is_valid_with_bounded_sprints(planner_settings):
    planner_settings(plan_total_days=45, plan_sprint_max_days=7)
    output = asyncio.run(PlannerAgent(llm=ChunkLLM()).build_plan(MODULES, GAPS, "FDE", "Anthropic",
                                                                 start_date=date(2026, 1, 1)))
    plan = StudyPlan.model_validate(output)

    assert output["plan"]["total_days"] == 45 and str(output["plan"]["end_date"]) == "2026-02-14"
    assert all(s["total_days"] <= 7 for s in output["sprints"])
    days = output["coverage"]["days_per_topic"]
    assert days["Claude"] == days["Salesforce"] > days["Enterprise Integration"]  # High gets more
    assert sum(days.values()) == 45
    # fixed blocks of at most 7 days across topic boundaries, named after the
    # topics they cover (the frontend shows "Sprint N" itself above the name)
    sprint_names = [s["sprint_name"] for s in output["sprints"]]
    assert len(sprint_names) == 7 and sprint_names[0] == "Claude" and "Claude & Salesforce" in sprint_names
    assert all(4 <= s["total_days"] <= 7 for s in output["sprints"])
    assert all(d["references"] for d in output["sprint_days"])


def test_no_llm_call_writes_more_than_the_chunk_size_and_later_chunks_see_earlier_titles(planner_settings):
    planner_settings(planner_days_per_call=5)
    llm = ChunkLLM()
    build(llm, total_days=30)

    assert all(int(re.search(r"EXACTLY (\d+) days", p).group(1)) <= 5 for p in llm.prompts)
    claude_prompts = [p for p in llm.prompts if 'studying "Claude"' in p]
    assert len(claude_prompts) > 1
    assert '"Claude day 1"' in claude_prompts[1]  # already-planned titles passed on, to avoid repeats


def test_topics_are_planned_one_call_at_a_time_on_ollama(planner_settings):
    planner_settings(llm_provider="ollama", llm_max_concurrency=0)
    llm = ChunkLLM()
    build(llm, total_days=30)
    assert llm.peak == 1


def test_topics_are_planned_concurrently_when_the_backend_allows(planner_settings):
    planner_settings(llm_max_concurrency=3)
    llm = ChunkLLM()
    build(llm, total_days=30)
    assert llm.peak > 1


def test_wording_is_used_and_distinct_across_chunks(planner_settings):
    planner_settings(planner_days_per_call=3)
    output = build(ChunkLLM(), total_days=15)

    claude = [d["topic_title"] for d in output["sprint_days"] if d["topic_title"].startswith("Claude")]
    assert claude == [f"Claude day {i}" for i in range(1, len(claude) + 1)]
    assert output["narrative_source"] == "llm"


def test_a_failed_or_short_chunk_falls_back_alone():
    output = build(ChunkLLM(fail_topics={"Salesforce"}, short_topics={"Enterprise Integration"}), total_days=10)

    assert output["narrative_source"] == "partial"
    claude_day1 = next(d for d in output["sprint_days"] if d["day_number"] == 1)
    assert claude_day1["topic_title"] == "Claude day 1"  # llm
    salesforce_day = next(d for d in output["sprint_days"] if d["topic_title"].startswith("Salesforce"))
    assert salesforce_day["topic_title"].startswith("Salesforce")  # fallback
    StudyPlan.model_validate(output)


@pytest.mark.parametrize("llm", [
    FakeLLM(error=RuntimeError("model unavailable")),
    FakeLLM(content="Here's a great plan for you!"),
    FakeLLM(content='{"days": "not a list"}'),
])
def test_unusable_model_output_falls_back_everywhere(llm):
    output = build(llm, total_days=10)

    assert output["narrative_source"] == "fallback"
    StudyPlan.model_validate(output)
    titles = [d["topic_title"] for d in output["sprint_days"]]
    assert len(set(titles)) == len(titles)


# ---- fallback wording -------------------------------------------------------

def test_long_fallback_is_distinct_learns_then_practices_then_reviews():
    days = fallback_days("Claude", ["A", "B", "C"], 15)

    titles = [d["title"] for d in days]
    assert len(days) == 15 and len(set(titles)) == 15
    assert titles[:3] == ["Claude: A", "Claude: B", "Claude: C"]
    assert "practice" in titles[3]
    assert titles[-1] == "Claude: review and mini-project"


def test_short_fallback_covers_concepts_and_ends_hands_on():
    days = fallback_days("Claude", ["A", "B", "C", "D"], 2)
    assert [d["title"] for d in days] == ["Claude: A, B", "Claude: C, D"]
    assert days[-1]["objectives"][-1].startswith("Apply Claude")


# ---- content ------------------------------------------------------------------

def test_references_map_to_the_backend_enum_drop_bad_urls_and_spread_across_days():
    output = build(total_days=12)  # Claude gets 5 days for 4 valid references

    claude_days = [d for d in output["sprint_days"] if d["topic_title"].startswith("Claude")]
    refs = [r for d in claude_days for r in d["references"]]
    assert {r["url"] for r in refs} == {
        "https://docs.example/claude", "https://books.example/claude",
        "https://youtube.example/claude", "https://papers.example/claude",
    }
    assert next(r for r in refs if "papers" in r["url"])["type"] == "article"
    # docs/video spread one per day; the book and the paper ride along on day one
    assert [len(d["references"]) for d in claude_days] == [3, 1, 2, 2, 2]
    assert [r["type"] for r in claude_days[0]["references"]] == ["documentation", "book", "article"]
    # the practice and review days revisit the docs and the video, as optional
    revisits = [r for d in claude_days[2:] for r in d["references"]]
    assert {r["type"] for r in revisits} == {"documentation", "video"}
    assert not any(r["is_required"] for r in revisits)
    assert [r["is_required"] for r in claude_days[0]["references"]] == [True, False, False]


def test_papers_are_capped_per_plan_like_books(planner_settings):
    modules = [{"topic": f"T{i}", "content_markdown": "## Overview\nx", "resources": [
        {"title": f"T{i} paper {j}", "url": f"https://arxiv.org/abs/{i}{j}", "resource_type": "paper"} for j in range(2)
    ]} for i in range(3)]
    planner_settings(plan_max_papers=2)

    output = build(modules=modules, gaps=[{"skill": f"T{i}", "effort": "High"} for i in range(3)], total_days=9)

    days = output["sprint_days"]
    papers = [(d["day_number"], r["url"]) for d in days for r in d["references"] if "arxiv" in r["url"]]
    assert {url for _, url in papers} == {"https://arxiv.org/abs/00", "https://arxiv.org/abs/10"}
    assert [day for day, _ in papers if day in (1, 4)] == [1, 4]  # each on its topic's first day
    # T2's papers are past the cap: its days get search links, never nothing
    assert all(d["references"] for d in days)
    assert output["coverage"]["reference_fallbacks"]["search_links"] == ["T2"]
    assert len(output["resource_pack"]["paper"]) == 6


def test_plan_text_is_sanitized_and_urls_are_left_alone():
    modules = [{"topic": "Claude", "content_markdown": "## Overview\nClaude\u2019s API \U0001F680 \u2014 fast.\n\n## Key Concepts\n- **Tool\u00a0Use**: calls",
                "resources": [{"title": "The Ultimate Beginner\u2019s Guide \u2728", "snippet": "zero\u200bwidth",
                               "url": "https://docs.example/caf\u00e9?q=\u2013x", "resource_type": "documentation"}]}]

    output = build(modules=modules, gaps=[{"skill": "Claude", "effort": "High"}], total_days=3)

    text = json.dumps(output, ensure_ascii=False)
    assert not any(ch in text for ch in "\u2019\u2014\u00a0\u200b\u2728\U0001F680")
    ref = output["sprint_days"][0]["references"][0]
    assert ref["title"] == "The Ultimate Beginner's Guide" and ref["description"] == "zerowidth"
    assert ref["url"] == "https://docs.example/caf\u00e9?q=\u2013x"  # a link is never rewritten
    assert output["learning_modules"][0]["content_markdown"].startswith("## Overview\nClaude's API - fast.")


def test_books_are_one_per_topic_on_its_first_day_and_capped_per_plan(planner_settings):
    """A new book every two days is not a study plan."""
    modules = [{"topic": f"T{i}", "content_markdown": "## Overview\nx", "resources": [
        {"title": f"T{i} book {j}", "url": f"https://books.example/{i}/{j}", "resource_type": "book"} for j in range(3)
    ] + [{"title": f"T{i} docs", "url": f"https://docs.example/{i}", "resource_type": "documentation"}]}
        for i in range(3)]
    gaps = [{"skill": f"T{i}", "effort": "High"} for i in range(3)]
    planner_settings(plan_max_books=2)

    output = build(modules=modules, gaps=gaps, total_days=9)

    days = output["sprint_days"]
    book_days = [d["day_number"] for d in days for r in d["references"] if r["type"] == "book"]
    assert book_days == [1, 4]  # first day of the two highest-priority topics
    assert len(output["resource_pack"]["book"]) == 9  # nothing is lost from the pack


def test_gap_without_research_is_planned_and_reported():
    output = build(total_days=10)

    salesforce = [d for d in output["sprint_days"] if d["topic_title"].startswith("Salesforce")]
    # nothing was found about it anywhere: labelled search links, never an empty day
    assert salesforce and all(d["references"] for d in salesforce)
    urls = {r["url"] for d in salesforce for r in d["references"]}
    assert urls == {"https://www.youtube.com/results?search_query=Salesforce+tutorial",
                    "https://www.google.com/search?q=Salesforce+official+documentation"}
    assert output["coverage"]["unresearched"] == ["Salesforce"]
    assert output["coverage"]["reference_fallbacks"] == {"borrowed": [], "search_links": ["Salesforce"]}
    assert output["coverage"]["researched"] == ["Claude", "Enterprise Integration"]


def test_a_plan_shorter_than_the_gap_list_reports_what_was_left_out(planner_settings):
    planner_settings(plan_min_days_per_topic=1)
    output = build(total_days=2)
    assert output["coverage"]["not_scheduled"] == ["Enterprise Integration"]
    assert output["plan"]["total_days"] == 2


def test_a_short_plan_goes_deep_on_fewer_topics_instead_of_a_day_each():
    """Default: every planned topic gets at least PLAN_MIN_DAYS_PER_TOPIC days."""
    output = build(total_days=7)

    assert list(output["coverage"]["days_per_topic"].values()) == [4, 3]
    assert output["coverage"]["not_scheduled"] == ["Enterprise Integration"]


def test_many_gaps_are_capped_to_the_highest_priority_topics(planner_settings):
    """28 gaps in 45 days used to become 28 one- and two-day sprints."""
    planner_settings(plan_max_topics=6)
    gaps = [{"skill": f"Skill {i}", "effort": "Medium" if i % 2 else "High"} for i in range(28)]

    output = build(modules=[], gaps=gaps, total_days=45)

    days = output["coverage"]["days_per_topic"]
    assert len(days) == 6 and sum(days.values()) == 45 and min(days.values()) >= 5
    assert all(int(name.split()[1]) % 2 == 0 for name in days)  # the High-priority gaps
    assert len(output["coverage"]["not_scheduled"]) == 22


def test_the_same_video_under_two_urls_is_referenced_once_as_a_video():
    modules = [{"topic": "Claude", "content_markdown": CLAUDE_MD, "resources": [
        {"title": "Claude AI Tutorial for Beginners (Step-by-Step)", "resource_type": "documentation",
         "url": "https://www.youtube.com/watch?v=r2vYObllqJU&vl=en"},
        {"title": "Claude AI Tutorial for Beginners (Step-by-Step)", "resource_type": "video",
         "url": "https://www.youtube.com/watch?v=r2vYObllqJU"},
    ]}]
    output = build(modules=modules, gaps=[{"skill": "Claude", "effort": "High"}], total_days=3)

    refs = [r for d in output["sprint_days"] for r in d["references"]]
    assert len({r["url"] for r in refs}) == 1 and {r["type"] for r in refs} == {"video"}
    assert len(output["sprint_days"][0]["references"]) == 1
    assert len(output["resource_pack"]["video"]) == 1 and "documentation" not in output["resource_pack"]


def test_review_extras_resource_pack_and_learning_modules():
    output = build(total_days=10)
    assert {r["url"] for r in output["resource_pack"]["video"]} == {"https://youtube.example/claude"}
    assert [m["topic"] for m in output["learning_modules"]] == ["Claude", "Enterprise Integration"]


def test_user_id_is_only_kept_when_it_is_a_mongo_object_id():
    assert build(user_id="subhaan")["plan"]["user_id"] is None
    oid = "0123456789abcdef01234567"
    assert build(user_id=oid)["plan"]["user_id"] == oid


def test_nothing_to_plan_raises():
    with pytest.raises(ValueError, match="nothing to plan"):
        asyncio.run(PlannerAgent(llm=ChunkLLM()).build_plan([], [], "FDE", "Anthropic"))


def test_key_concepts_parses_bold_and_plain_bullets():
    md = "## Key Concepts\n- **Bold One**: detail\n- Plain Two: detail\n* Three\n\n## Practice\n- not a concept\n"
    assert key_concepts(md) == ["Bold One", "Plain Two", "Three"]


def test_the_planner_model_and_its_concurrency_are_configurable(planner_settings, monkeypatch):
    """PLANNER_MODEL picks a smaller model for the short day-wording JSON;
    PLANNER_LLM=fast uses the fast model and its own concurrency."""
    seen = {}

    def fake_get_llm(**kwargs):
        seen.update(kwargs)
        return ChunkLLM()

    monkeypatch.setattr(planner_module, "get_llm", fake_get_llm)
    planner_settings(planner_model="small-model", planner_llm="default")
    asyncio.run(PlannerAgent().build_plan(MODULES, GAPS, "FDE", "Anthropic", start_date=date(2026, 1, 1), total_days=9))
    assert seen["model"] == "small-model" and seen["profile"] == "default" and seen["max_tokens"]

    planner_settings(planner_llm="fast", fast_llm_base_url="https://fast.example/v1", fast_llm_model="m",
                     fast_llm_api_key="k", fast_llm_max_concurrency=3, llm_provider="ollama", llm_max_concurrency=0)
    llm = ChunkLLM()
    asyncio.run(PlannerAgent(llm=llm).build_plan(MODULES, GAPS, "FDE", "Anthropic", start_date=date(2026, 1, 1), total_days=9))
    assert llm.peak == 3  # the fast model's concurrency, not Ollama's one-at-a-time


def test_references_go_on_the_day_they_are_about():
    """Dealt out in search order, "Why Java Is So Hard To Learn" landed on
    the Exception Handling day."""
    from tools.plan_builder import place_references

    refs = [{"title": "Java Tutorial", "description": "A general course."},
            {"title": "Java exception handling best practices", "description": "try, catch, finally."},
            {"title": "The Java Collections Framework", "description": "Lists, maps, sets."},
            {"title": "Why Java Is So Hard To Learn", "description": "An opinion."}]
    titles = ["Java Fundamentals", "Exception Handling", "Java Collections Framework", "Review and Mini Project"]

    placed = place_references(refs, titles, "Java")

    assert [[r["title"] for r in day] for day in placed] == [
        ["Java Tutorial"],                                  # general material fills from the start
        ["Java exception handling best practices"],
        ["The Java Collections Framework"],
        ["Why Java Is So Hard To Learn"],
    ]
    # fewer references than days: the closing days stay empty, by design
    assert [len(day) for day in place_references(refs[:1], titles, "Java")] == [1, 0, 0, 0]
    assert all(len(day) <= 3 for day in place_references(refs * 5, titles, "Java"))


def test_days_for_a_partly_known_skill_skip_the_basics():
    llm = ChunkLLM()
    gaps = [{"skill": "Claude", "status": "partial", "effort": "Medium", "evidence": "used the API in one project"},
            {"skill": "Salesforce", "status": "missing", "effort": "High"}]

    build(llm=llm, gaps=gaps, total_days=8)

    claude = next(p for p in llm.prompts if 'studying "Claude"' in p)
    salesforce = next(p for p in llm.prompts if 'studying "Salesforce"' in p)
    assert "used the API in one project" in claude and "skip the beginner basics" in claude
    assert "skip the beginner basics" not in salesforce


def test_ninety_day_plan_generation_allocates_correct_days_and_sprints():
    llm = ChunkLLM()
    output = build(llm=llm, modules=MODULES, gaps=GAPS, total_days=90)

    # 1. Total days in plan
    assert output["plan"]["total_days"] == 90
    assert len(output["sprint_days"]) == 90

    # 2. Sprints partition 90 days cleanly into 13 sprints (7 days each, last sprint has 6)
    sprints = output["sprints"]
    assert len(sprints) == 13
    assert sum(s["total_days"] for s in sprints) == 90

    # 3. Days per topic sum to 90
    days_per_topic = output["coverage"]["days_per_topic"]
    assert sum(days_per_topic.values()) == 90

# ---- restored: the model picks each day's references; gap searches (lost in a merge) ----

def test_a_gap_without_research_borrows_what_other_topics_found_about_it():
    modules = [{"topic": "Java", "content_markdown": "## Overview\nx", "resources": [
        {"title": "Java tutorial", "url": "https://docs.example/java", "resource_type": "documentation"},
        {"title": "Spring Boot with Java: build a REST API", "url": "https://docs.example/spring",
         "resource_type": "documentation"},
    ]}]
    gaps = [{"skill": "Java", "effort": "High"}, {"skill": "Spring Boot", "effort": "High"}]

    output = build(modules=modules, gaps=gaps, total_days=6)

    spring = [d for d in output["sprint_days"] if d["topic_title"].startswith("Spring Boot")]
    assert spring and all(d["references"] for d in spring)
    assert {r["url"] for d in spring for r in d["references"]} == {"https://docs.example/spring"}
    assert output["coverage"]["reference_fallbacks"] == {"borrowed": ["Spring Boot"], "search_links": []}


def test_every_day_reaches_the_backend_with_its_references(monkeypatch):
    """The plan's days, references included, are what POST /api/sprint-days receives."""
    import httpx

    from tools import plan_db_sync

    output = build(total_days=45)
    assert all(d["references"] for d in output["sprint_days"])

    sent_days = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        if request.url.path == "/api/sprint-days":
            sent_days.extend(body["days"])
            return httpx.Response(201, json={"ids": [str(i) for i in range(len(body["days"]))]})
        return httpx.Response(201, json={"id": "0123456789abcdef01234567"})

    real_client = httpx.AsyncClient
    monkeypatch.setattr(plan_db_sync.httpx, "AsyncClient",
                        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs))

    result = asyncio.run(plan_db_sync.sync_generated_plan_to_db(output, base_url="http://backend.test"))

    assert result["success"] and result["total_days_created"] == 45
    assert [d["references"] for d in sent_days] == [d["references"] for d in output["sprint_days"]]


class PickingLLM(ChunkLLM):
    """Like ChunkLLM, but answers the way the prompt asks: per day the
    numbers of the listed resources whose title shares a word with the
    day's subject, else a search for that subject. `day_subjects` maps a
    topic to the subject of each of its days (cycled)."""

    def __init__(self, day_subjects, **kw):
        super().__init__(**kw)
        self.day_subjects = day_subjects

    async def ainvoke(self, prompt, config=None):
        self.prompts.append(prompt)
        topic = re.search(r'studying "(.+?)"', prompt).group(1)
        first = int(re.search(r"Plan days (\d+)-", prompt).group(1))
        count = int(re.search(r"EXACTLY (\d+) days", prompt).group(1))
        listed = re.findall(r"^(\d+)\. \[[a-z]+\] (.+)$", prompt, re.M)
        subjects = self.day_subjects[topic]
        days = []
        for i in range(count):
            subject = subjects[(first - 1 + i) % len(subjects)]
            refs = [int(n) for n, title in listed if subject.casefold() in title.casefold()]
            days.append({"title": f"{topic}: {subject} (day {first + i})", "objectives": [f"Learn {subject}"],
                         "refs": refs[:2] + [99], "search": "" if refs else f"{subject} tutorial"})
        return AIMessage(content=json.dumps({"days": days}))


class FakeDocsSearch:
    """Stands in for research_tools.search_technical_docs."""
    name = "search_technical_docs"

    def __init__(self, source="serpapi"):
        self.queries, self.source = [], source

    def invoke(self, payload):
        query = payload["query"].split(" -")[0]  # without the -jobs ... terms
        self.queries.append(query)
        subject = query.removesuffix(" tutorial")
        return {"source": self.source, "results": [
            {"title": f"{subject} explained", "url": f"https://learn.example/{subject.replace(' ', '-')}",
             "snippet": f"A tutorial on {subject}.", "resource_type": "documentation"},
            {"title": f"{subject} engineer jobs", "url": "https://jobs.example/apply", "snippet": "Hiring now"},
        ]}


@pytest.fixture
def searchable(planner_settings, monkeypatch):
    search = FakeDocsSearch()
    monkeypatch.setattr(planner_module, "search_technical_docs", search)
    planner_settings(serpapi_enabled=True, serpapi_api_key="k", plan_gap_searches="auto")
    return search


def test_each_day_gets_the_references_the_model_picked_for_it(planner_settings):
    planner_settings(serpapi_enabled=False)
    modules = [{"topic": "Java", "content_markdown": "## Overview\nx", "resources": [
        {"title": "Java tutorial", "url": "https://docs.example/java", "resource_type": "documentation"},
        {"title": "Exception handling in Java", "url": "https://docs.example/exceptions", "resource_type": "documentation"},
        {"title": "Java collections video", "url": "https://videos.example/collections", "resource_type": "video"},
    ]}]
    llm = PickingLLM({"Java": ["Exception", "Collections", "tutorial"]})

    output = build(llm, modules=modules, gaps=[{"skill": "Java", "effort": "High"}], total_days=3)

    days = output["sprint_days"]
    assert [[r["url"] for r in d["references"]] for d in days] == [
        ["https://docs.example/exceptions"], ["https://videos.example/collections"], ["https://docs.example/java"]]
    assert "1. [docs] Java tutorial" in llm.prompts[0]  # the model sees the list, numbered
    assert all(d["references"][0]["is_required"] for d in days)  # 99 (not listed) was ignored


def test_a_resource_picked_again_is_optional_and_a_book_past_the_cap_is_never_picked(planner_settings):
    planner_settings(serpapi_enabled=False, plan_max_books=0)
    modules = [{"topic": "Go", "content_markdown": "## Overview\nx", "resources": [
        {"title": "Go concurrency guide", "url": "https://docs.example/go", "resource_type": "documentation"},
        {"title": "Go concurrency book", "url": "https://books.example/go", "resource_type": "book"},
    ]}]
    output = build(PickingLLM({"Go": ["concurrency"]}), modules=modules,
                   gaps=[{"skill": "Go", "effort": "High"}], total_days=3)

    refs = [d["references"] for d in output["sprint_days"]]
    assert all([r["url"] for r in day] == ["https://docs.example/go"] for day in refs)
    assert [day[0]["is_required"] for day in refs] == [True, False, False]


def test_days_no_resource_covers_get_a_targeted_search_within_the_budget(searchable):
    modules = [{"topic": "Data Structures", "content_markdown": "## Overview\nx", "resources": [
        {"title": "Hash maps deep dive", "url": "https://docs.example/hash", "resource_type": "documentation"},
    ]}]
    subjects = ["Hash maps", "Bloom filters", "Tries", "Skip lists", "Heaps"]
    output = build(PickingLLM({"Data Structures": subjects}), modules=modules,
                   gaps=[{"skill": "Data Structures", "effort": "High"}], total_days=10)

    days = output["sprint_days"]
    assert len(searchable.queries) == 2  # auto: one per 5 days of a 10-day plan
    assert searchable.queries == ["Bloom filters tutorial", "Tries tutorial"]  # earliest days first
    assert [r["url"] for r in days[1]["references"]] == ["https://learn.example/Bloom-filters"]  # job advert dropped
    assert all(d["references"] for d in days)


def test_search_budget_one_topic_does_not_need_goes_to_another(searchable, planner_settings):
    modules = [
        {"topic": "Java", "content_markdown": "## Overview\nx", "resources": [
            {"title": "Java streams", "url": "https://docs.example/streams", "resource_type": "documentation"}]},
        {"topic": "Go", "content_markdown": "## Overview\nx", "resources": []},
    ]
    gaps = [{"skill": "Java", "effort": "High"}, {"skill": "Go", "effort": "High"}]
    llm = PickingLLM({"Java": ["streams"], "Go": ["goroutines", "channels", "select", "context"]})

    planner_settings(plan_gap_searches="3")
    output = build(llm, modules=modules, gaps=gaps, total_days=24)  # shares Java 2 / Go 1

    assert sorted(searchable.queries) == ["channels tutorial", "goroutines tutorial", "select tutorial"]
    go_days = [d for d in output["sprint_days"] if d["topic_title"].startswith("Go")]
    assert all(d["references"] for d in go_days)  # searched days, the rest revisit what was found
    assert output["coverage"]["reference_fallbacks"]["search_links"] == []


def test_offline_search_results_are_not_used_as_material(searchable, monkeypatch):
    monkeypatch.setattr(planner_module, "search_technical_docs", FakeDocsSearch(source="mock"))
    output = build(PickingLLM({"Claude": ["zzz"], "Enterprise Integration": ["zzz"], "Salesforce": ["zzz"]}),
                   total_days=10)
    assert not any("learn.example" in r["url"] for d in output["sprint_days"] for r in d["references"])


@pytest.mark.parametrize("total_days", [10, 14, 45, 60, 90])
def test_short_and_long_plans_have_a_reference_on_every_day(total_days, searchable):
    gaps = [{"skill": name, "effort": effort} for name, effort in
            [("Claude", "High"), ("Enterprise Integration", "Medium"), ("Salesforce", "High"),
             ("Kafka", "High"), ("Terraform", "Medium"), ("GraphQL", "Medium"), ("Rust", "High")]]
    subjects = {g["skill"]: ["docs", "video", "internals", "practice"] for g in gaps}

    output = build(PickingLLM(subjects), gaps=gaps, total_days=total_days)

    StudyPlan.model_validate(output)
    days = output["sprint_days"]
    assert len(days) == total_days and all(d["references"] for d in days)
    assert len(searchable.queries) <= -(-total_days // 5)  # never past the budget
    assert all(sum(r["is_required"] for r in d["references"]) <= 1 for d in days)


def test_an_overview_reused_for_unrelated_days_is_replaced_by_searches(searchable, planner_settings):
    """The same "What is Solana?" video sat on Proof of History, Tower BFT
    and Sealevel. A repeat is kept only for a day it is about (or a review
    day); the others ask for a search on their own subject."""
    modules = [{"topic": "Solana", "content_markdown": "## Overview\nx", "resources": [
        {"title": "What is Solana? Explained", "url": "https://videos.example/solana", "resource_type": "video"},
        {"title": "The Solana book", "url": "https://books.example/solana", "resource_type": "book"},
    ]}]

    class LazyLLM(ChunkLLM):  # picks resource 1 for every day
        async def ainvoke(self, prompt, config=None):
            self.prompts.append(prompt)
            titles = ["Solana Overview", "Proof of History", "Tower BFT", "Review and Mini Project"]
            return AIMessage(content=json.dumps({"days": [
                {"title": t, "objectives": ["x"], "refs": [1], "search": ""} for t in titles]}))

    llm = LazyLLM()
    planner_settings(plan_gap_searches="2")
    output = build(llm, modules=modules, gaps=[{"skill": "Solana", "effort": "High"}], total_days=4)

    assert "The Solana book" not in llm.prompts[0]  # a companion, not a per-day pick
    assert searchable.queries == ["Solana proof history", "Solana tower bft"]
    days = output["sprint_days"]
    assert days[0]["references"][0]["url"] == "https://videos.example/solana"
    assert [r["url"] for r in days[1]["references"]] == ["https://learn.example/Solana-proof-history"]
    assert days[3]["references"][0]["url"] == "https://videos.example/solana"  # review: a repeat is fine


def test_a_slow_gap_search_never_holds_the_plan_up(searchable, monkeypatch):
    import time

    class SlowSearch(FakeDocsSearch):
        def invoke(self, payload):
            time.sleep(0.5)
            return super().invoke(payload)

    monkeypatch.setattr(planner_module, "search_technical_docs", SlowSearch())
    monkeypatch.setattr(planner_module, "GAP_SEARCH_GRACE_SECONDS", 0.05)
    llm = PickingLLM({"Claude": ["zzz"], "Enterprise Integration": ["zzz"], "Salesforce": ["zzz"]})

    async def timed():
        started = time.monotonic()
        plan = await PlannerAgent(llm=llm).build_plan(MODULES, GAPS, "FDE", "Anthropic",
                                                      start_date=date(2026, 1, 1), total_days=10)
        return plan, time.monotonic() - started

    output, took = asyncio.run(timed())  # (asyncio.run itself waits for the abandoned thread at exit)

    assert took < 0.45
    assert all(d["references"] for d in output["sprint_days"])  # the computed placement still applies


def test_each_topic_prompt_names_the_plans_other_topics():
    llm = ChunkLLM()
    build(llm, total_days=10)
    claude = next(p for p in llm.prompts if 'studying "Claude"' in p)
    assert 'do not plan days about them: ["Salesforce", "Enterprise Integration"]' in claude
