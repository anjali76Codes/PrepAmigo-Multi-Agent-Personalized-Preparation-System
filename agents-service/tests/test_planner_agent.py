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
    plan = StudyPlan.model_validate(output["plan"])

    assert plan.total_days == 45 and str(plan.end_date) == "2026-02-14"
    assert all(s.total_days <= 7 for s in plan.sprints)
    days = output["coverage"]["days_per_topic"]
    assert days["Claude"] == days["Salesforce"] > days["Enterprise Integration"]  # High gets more
    assert sum(days.values()) == 45
    long_sprints = [s.sprint_name for s in plan.sprints if "(part" in s.sprint_name]
    assert "Claude (part 1 of 3)" in long_sprints


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

    claude = [d["topic_title"] for s in output["plan"]["sprints"] if s["sprint_name"].startswith("Claude")
              for d in s["sprint_days"]]
    assert claude == [f"Claude day {i}" for i in range(1, len(claude) + 1)]
    assert output["narrative_source"] == "llm"


def test_a_failed_or_short_chunk_falls_back_alone():
    output = build(ChunkLLM(fail_topics={"Salesforce"}, short_topics={"Enterprise Integration"}), total_days=10)

    by_name = {s["sprint_name"]: s for s in output["plan"]["sprints"]}
    assert output["narrative_source"] == "partial"
    assert by_name["Claude"]["sprint_days"][0]["topic_title"] == "Claude day 1"  # llm
    assert by_name["Salesforce"]["sprint_days"][0]["topic_title"].startswith("Salesforce")  # fallback
    assert "day 1" not in by_name["Enterprise Integration"]["sprint_days"][0]["topic_title"]  # short -> fallback
    StudyPlan.model_validate(output["plan"])


@pytest.mark.parametrize("llm", [
    FakeLLM(error=RuntimeError("model unavailable")),
    FakeLLM(content="Here's a great plan for you!"),
    FakeLLM(content='{"days": "not a list"}'),
])
def test_unusable_model_output_falls_back_everywhere(llm):
    output = build(llm, total_days=10)

    assert output["narrative_source"] == "fallback"
    StudyPlan.model_validate(output["plan"])
    titles = [d["topic_title"] for s in output["plan"]["sprints"] for d in s["sprint_days"]]
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

    claude_days = [d for s in output["plan"]["sprints"] if s["sprint_name"] == "Claude" for d in s["sprint_days"]]
    refs = [r for d in claude_days for r in d["references"]]
    assert {r["url"] for r in refs} == {
        "https://docs.example/claude", "https://books.example/claude",
        "https://youtube.example/claude", "https://papers.example/claude",
    }
    assert next(r for r in refs if "papers" in r["url"])["type"] == "article"
    # docs/video spread one per day; the book and the paper ride along on day one
    assert [len(d["references"]) for d in claude_days] == [3, 1, 0, 0, 0]
    assert [r["type"] for r in claude_days[0]["references"]] == ["documentation", "book", "article"]


def test_papers_are_capped_per_plan_like_books(planner_settings):
    modules = [{"topic": f"T{i}", "content_markdown": "## Overview\nx", "resources": [
        {"title": f"T{i} paper {j}", "url": f"https://arxiv.org/abs/{i}{j}", "resource_type": "paper"} for j in range(2)
    ]} for i in range(3)]
    planner_settings(plan_max_papers=2)

    output = build(modules=modules, gaps=[{"skill": f"T{i}", "effort": "High"} for i in range(3)], total_days=9)

    days = [d for s in output["plan"]["sprints"] for d in s["sprint_days"]]
    assert [d["day_number"] for d in days if d["references"]] == [1, 4]
    assert len(output["resource_pack"]["paper"]) == 6


def test_plan_text_is_sanitized_and_urls_are_left_alone():
    modules = [{"topic": "Claude", "content_markdown": "## Overview\nClaude\u2019s API \U0001F680 \u2014 fast.\n\n## Key Concepts\n- **Tool\u00a0Use**: calls",
                "resources": [{"title": "The Ultimate Beginner\u2019s Guide \u2728", "snippet": "zero\u200bwidth",
                               "url": "https://docs.example/caf\u00e9?q=\u2013x", "resource_type": "documentation"}]}]

    output = build(modules=modules, gaps=[{"skill": "Claude", "effort": "High"}], total_days=3)

    text = json.dumps(output, ensure_ascii=False)
    assert not any(ch in text for ch in "\u2019\u2014\u00a0\u200b\u2728\U0001F680")
    ref = output["plan"]["sprints"][0]["sprint_days"][0]["references"][0]
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

    days = [d for s in output["plan"]["sprints"] for d in s["sprint_days"]]
    book_days = [d["day_number"] for d in days for r in d["references"] if r["type"] == "book"]
    assert book_days == [1, 4]  # first day of the two highest-priority topics
    assert len(output["resource_pack"]["book"]) == 9  # nothing is lost from the pack


def test_gap_without_research_is_planned_and_reported():
    output = build(total_days=10)

    salesforce = [d for s in output["plan"]["sprints"] if s["sprint_name"].startswith("Salesforce") for d in s["sprint_days"]]
    assert salesforce and all(d["references"] == [] for d in salesforce)
    assert output["coverage"]["unresearched"] == ["Salesforce"]
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

    refs = [r for s in output["plan"]["sprints"] for d in s["sprint_days"] for r in d["references"]]
    assert len(refs) == 1 and refs[0]["type"] == "video"
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

    claude = next(p for p in llm.prompts if '"Claude"' in p)
    salesforce = next(p for p in llm.prompts if '"Salesforce"' in p)
    assert "used the API in one project" in claude and "skip the beginner basics" in claude
    assert "skip the beginner basics" not in salesforce
