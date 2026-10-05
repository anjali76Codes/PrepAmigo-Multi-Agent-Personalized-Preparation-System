"""
Planner Agent: turns the skill-gap report and the research modules into a
study plan in the backend's own shape (schemas/study_plan.py: plan ->
sprints -> sprint_days) of a target length (PLAN_TOTAL_DAYS, default 45,
or a per-run override).

Scaling to long plans (45-60 days):
  - Days are split across skill gaps by priority weight (a missing/High
    gap gets twice a partial/Medium one), so a longer plan means more days
    per gap, never more research: research stays one module per gap.
  - The plan's days, in topic order, are cut into sprints of at most
    PLAN_SPRINT_MAX_DAYS (7) across topic boundaries, each named after the
    topics it covers (assessments and flashcards are made per sprint).
  - Day wording comes from small LLM calls: one per chunk of at most
    PLANNER_DAYS_PER_CALL days of one topic, each prompt holding only that
    topic's concepts and the titles already planned for it (so later chunks
    don't repeat earlier ones). No call grows with plan length, a failed
    chunk falls back on its own, and topics run concurrently up to the LLM
    backend's concurrency (config.llm_concurrency).

Reliability: the LLM never produces the plan's structure. Day counts,
sprints, dates, numbering and references are computed by the plan builder
(tools/plan_builder.py), which validates the plan against the StudyPlan
contract (field limits plus cross-field arithmetic) before it leaves this
agent. This file only asks the model for each day's wording. Nothing
depends on the model honoring a JSON schema (Ollama's schema mode was
ignored outright by nemotron-3-nano:30b-cloud) — swapping the model can
only change wording. `narrative_source` records whether the wording came
from the model.

What the model decides (in the same per-chunk call, no extra calls):
  - which of the topic's researched resources fit each day ("refs", by
    number from a list in the prompt, so it can only pick real links);
  - for a day none of them covers, a short web search for that day's
    subject ("search"). Up to PLAN_GAP_SEARCHES of those run (auto: one
    per 5 plan days), shared across topics by their day counts, each as
    soon as its chunk is written, so they overlap the remaining wording
    calls; budget a topic doesn't use goes to the others' requests at the
    end. Unhelpful results (off-subject, job adverts, sales pages) are
    dropped. Code validates every pick and keeps the computed placement
    for any day the model left out.

Every gap that fits in the plan gets days, including ones whose research
failed (no module): those days carry references other topics' research
found about it, else search links, and the topic is listed under
coverage.unresearched (and coverage.reference_fallbacks). If the plan has
fewer days than gaps, the lowest priority gaps are listed under
coverage.not_scheduled.
"""
import asyncio
import json
import logging
from datetime import date
from typing import Any

from pydantic import BaseModel, ValidationError, field_validator

from agents.research_agent import NOT_LEARNING_TERMS
from core.config import get_llm, llm_concurrency, settings
from graph.events import INTERNAL_LLM_CONFIG, invoke_tool_with_events
from observability.timing import log_failure
from storage.llm_cache import forget_response
from tools.plan_builder import (  # noqa: F401  (allocate_days etc. re-exported for callers/tests)
    MATCH_THRESHOLD,
    allocate_days,
    assemble_plan,
    borrow_references,
    clip,
    fallback_days,
    key_concepts,
    parse_json_object,
    plan_topics,
    references,
    schedule,
)
from tools.relevance import canonical_url, not_learning_material, relevance, topic_terms
from tools.research_tools import search_technical_docs
from tools.serpapi_client import account_unavailable

logger = logging.getLogger(__name__)

AGENT_NAME = "planner"
NARRATIVE_TIMEOUT_SECONDS = 45
# ~100 tokens per planned day (wording plus its picks or search) x
# PLANNER_DAYS_PER_CALL (10), with headroom
PLANNER_MAX_TOKENS = 1800
# a topic's resources listed in each wording prompt (~15 tokens each)
MAX_PROMPT_REFERENCES = 12
MAX_PICKS_PER_DAY = 2
GAP_SEARCH_RESULTS = 2
# searches still running when the last wording call is done get this long;
# later ones are dropped (their results still reach the cache for next run)
GAP_SEARCH_GRACE_SECONDS = 5.0
# words in a day title that say what kind of day it is, not its subject
GENERIC_DAY_WORDS = frozenset(
    "review project mini practice hands build polish overview basics fundamentals introduction intro "
    "essentials deep dive recap capstone final wrap exercises exercise implementation applied concepts "
    "core advanced patterns techniques".split())
REFERENCE_KINDS = {"documentation": "docs", "video": "video", "book": "book", "article": "article"}


class DayNarrative(BaseModel):
    title: str
    objectives: list[str]
    # optional and forgiving: a malformed pick or query never costs the day
    refs: list[int] = []
    search: str = ""

    @field_validator("refs", mode="before")
    @classmethod
    def _numbers(cls, value: Any) -> list[int]:
        numbers = []
        for item in value if isinstance(value, list) else []:
            try:
                numbers.append(int(item))
            except (TypeError, ValueError):
                continue
        return numbers

    @field_validator("search", mode="before")
    @classmethod
    def _query(cls, value: Any) -> str:
        return " ".join(str(value or "").split())[:100]


class PlannerAgent:
    name = AGENT_NAME

    def __init__(self, llm: Any | None = None):
        self._llm = llm

    @property
    def llm(self):
        if self._llm is None:
            # PLANNER_LLM / PLANNER_MODEL: the day wording is short JSON, so
            # a smaller or faster model than the research one does it well
            self._llm = get_llm(guarded=True, temperature=0.2, max_tokens=PLANNER_MAX_TOKENS, profile=settings.planner_llm,
                                model=settings.planner_model or None)
        return self._llm

    async def build_plan(
        self,
        modules: list[dict[str, Any]],
        priority_gaps: list[dict[str, Any]],
        role: str,
        company: str,
        start_date: date | None = None,
        user_id: str | None = None,
        focus: str = "",
        total_days: int | None = None,
    ) -> dict[str, Any]:
        start_date = start_date or date.today()
        total_days = total_days or settings.plan_total_days
        all_topics = plan_topics(modules, priority_gaps)
        if not all_topics:
            raise ValueError("nothing to plan: no skill gaps and no research modules")
        topics, not_scheduled = schedule(
            all_topics, total_days, settings.plan_max_topics, settings.plan_min_days_per_topic)
        # before the wording calls, so the model can pick among borrowed ones
        topics = borrow_references(topics, modules)
        # no gap searches when SerpApi is off, has no key, or already said the
        # account is out of searches this run (each would fail the same way)
        searchable = settings.serpapi_enabled and bool(settings.serpapi_api_key) and not account_unavailable()
        budget = settings.gap_search_budget(total_days) if searchable else 0

        wording, narrative_source = await self._narratives(topics, role, company, focus, budget)

        return assemble_plan(
            topics, wording, modules=modules, role=role, company=company, start_date=start_date,
            sprint_max_days=settings.plan_sprint_max_days, narrative_source=narrative_source,
            not_scheduled=not_scheduled, user_id=user_id, max_books=settings.plan_max_books,
            max_papers=settings.plan_max_papers,
        )

    async def _narratives(
        self, topics: list[dict[str, Any]], role: str, company: str, focus: str = "", search_budget: int = 0,
    ) -> tuple[dict[str, list[dict[str, Any]]], str]:
        """Day wording (and reference picks) for every topic, each topic in
        chunks of at most PLANNER_DAYS_PER_CALL days, topics concurrently up
        to the backend's LLM concurrency, plus up to `search_budget` gap
        searches (see the module docstring). Returns ({topic_key: days},
        source) where source is "llm", "partial" or "fallback" (how many
        chunks the model wrote)."""
        semaphore = asyncio.Semaphore(llm_concurrency(settings, settings.planner_llm))
        chunk_results: list[bool] = []
        # each topic's share of the searches, by its number of days
        shares = allocate_days([t["days"] for t in topics], search_budget)
        searches: list[tuple[dict[str, Any], asyncio.Task]] = []
        # requests past their topic's share: (topic rank, day index, topic, day)
        waiting: list[tuple[int, int, dict[str, Any], dict[str, Any]]] = []

        async def topic_days(rank: int, topic: dict[str, Any], share: int) -> list[dict[str, Any]]:
            fallback = fallback_days(topic["name"], topic["concepts"], topic["days"])
            others = [t["name"] for t in topics if t is not topic]
            days: list[dict[str, Any]] = []
            used: set[str] = set()  # references this topic's days already picked
            for start in range(0, topic["days"], settings.planner_days_per_call):
                count = min(settings.planner_days_per_call, topic["days"] - start)
                async with semaphore:
                    chunk = await self._chunk(topic, start, count, [d["title"] for d in days], role, company,
                                              focus, others)
                chunk_results.append(chunk is not None)
                days.extend(chunk or fallback[start:start + count])
                for day in chunk or []:
                    check_picks(topic, day, used)
                for offset, day in enumerate(chunk or []):
                    if not day.get("search"):
                        continue
                    if share:  # started now: it runs while the next chunks are written
                        share -= 1
                        searches.append((day, asyncio.create_task(self._gap_search(topic, day["search"]))))
                    else:
                        waiting.append((rank, start + offset, topic, day))
            return days

        results = await asyncio.gather(*(
            topic_days(rank, t, share) for rank, (t, share) in enumerate(zip(topics, shares))))
        # budget a topic did not need goes to the others' requests: highest
        # priority topic first, earliest day first
        spare = search_budget - len(searches)
        searches += [(day, asyncio.create_task(self._gap_search(topic, day["search"])))
                     for _, _, topic, day in sorted(waiting, key=lambda w: w[:2])[:max(0, spare)]]
        if searches:
            # the plan never waits long on optional material
            _, late = await asyncio.wait([task for _, task in searches], timeout=GAP_SEARCH_GRACE_SECONDS)
            for task in late:
                task.cancel()
            for day, task in searches:
                found = [] if task in late else task.result()
                if found:
                    day["found"] = found
            logger.info("Planner gap searches: %d of %d run, %d found material for their day%s",
                        len(searches), search_budget, sum(1 for day, _ in searches if day.get("found")),
                        f", {len(late)} too slow and dropped" if late else "")
        wording = {t["key"]: days for t, days in zip(topics, results)}
        if all(chunk_results):
            return wording, "llm"
        if any(chunk_results):
            logger.info("Planner wording: %d/%d chunks from the model, the rest concept-based",
                        sum(chunk_results), len(chunk_results))
            return wording, "partial"
        logger.warning("Planner wording unavailable from the model; using concept-based wording")
        return wording, "fallback"

    async def _chunk(
        self, topic: dict[str, Any], start: int, count: int, covered: list[str],
        role: str, company: str, focus: str, others: list[str] | None = None,
    ) -> list[dict[str, Any]] | None:
        """Wording for days start+1..start+count of one topic, or None when
        the model's answer is missing, late, unparseable or short."""
        last_chunk = start + count == topic["days"]
        listed = pickable(topic)
        if listed:
            resources = (
                "Study resources found for this topic (refer to them by number):\n"
                + "".join(f"{n}. [{REFERENCE_KINDS.get(r['type'], r['type'])}] {clip(r['title'], 80)}\n"
                          for n, r in enumerate(listed, start=1))
                + f'For each day, "refs": the numbers of the 1-{MAX_PICKS_PER_DAY} resources that best teach '
                "that day's subject, best first. Only when none of them covers it: \"refs\": [] and \"search\": "
                "a 3-6 word web search for material on that day's subject.\n"
            )
            shape = '{"days": [{"title": "...", "objectives": ["...", "..."], "refs": [1], "search": ""}]}'
        else:
            resources = ("No study resources were found for this topic yet. For each day, \"search\": a 3-6 word "
                         "web search for material on that day's subject.\n")
            shape = '{"days": [{"title": "...", "objectives": ["...", "..."], "search": "..."}]}'
        prompt = (
            f'Plan days {start + 1}-{start + count} of {topic["days"]} for studying "{topic["name"]}" '
            f"({topic['effort']} priority) for the {role} role at {company or 'their target company'}.\n"
            + (f"The candidate already has some experience with this ({topic['evidence'] or 'listed on their resume'}): "
               "skip the beginner basics and start from applied, interview-level material.\n"
               if topic.get("status") == "partial" else "")
            + f"Key concepts of the topic: {json.dumps(topic['concepts'])}\n"
            f"Role focus (context for what matters most on the job): {focus or 'not available'}\n"
            f"Days already planned for this topic (do not repeat them): {json.dumps(covered)}\n"
            + (f"Other topics of this plan have their own days; do not plan days about them: {json.dumps(others)}\n"
               if others else "")
            +             "Order: fundamentals first, hands-on practice later"
            + ("; the final day is a review plus a small project.\n" if last_chunk else ".\n")
            + "Each day has a short title (at most 8 words) and 2-3 concrete, checkable objectives.\n"
            + resources
            + f"Return ONLY a JSON object, no prose, no markdown, with EXACTLY {count} days: {shape}"
        )
        try:
            response = await asyncio.wait_for(
                self.llm.ainvoke(prompt, config=INTERNAL_LLM_CONFIG), timeout=NARRATIVE_TIMEOUT_SECONDS
            )
        except Exception as exc:
            log_failure(logger, f"Planner wording for {topic['name']!r} days {start + 1}-{start + count} "
                                "failed; using concept-based wording", exc)
            return None
        try:
            raw_days = parse_json_object(str(response.content)).get("days")
        except ValueError:
            forget_response(response)  # don't replay an unparseable answer from the cache
            logger.warning("Planner wording for %r days %d-%d was not JSON; using concept-based wording",
                           topic["name"], start + 1, start + count)
            return None
        days = []
        for entry in raw_days if isinstance(raw_days, list) else []:
            try:
                day = DayNarrative.model_validate(entry)
            except ValidationError:
                continue
            if day.title.strip() and any(o.strip() for o in day.objectives):
                days.append(_with_picks(day, listed))
        if len(days) < count:
            forget_response(response)
            return None
        return days[:count]

    async def _gap_search(self, topic: dict[str, Any], query: str) -> list[dict[str, Any]]:
        """Up to GAP_SEARCH_RESULTS references for one day's subject from
        one web search, or [] (a failure never affects the plan)."""
        try:
            result, _ = await invoke_tool_with_events(
                search_technical_docs, {"query": f"{query} {NOT_LEARNING_TERMS}", "limit": 6},
                agent=AGENT_NAME, timeout=settings.research_tool_timeout_seconds,
            )
        except Exception as exc:
            # optional material: one line, no traceback
            logger.warning("Planner search for %r day subject %r failed: %s", topic["name"], query,
                           str(exc) or type(exc).__name__)
            return []
        if result.get("source") != "serpapi":
            return []  # offline/mock results are search links, not material
        useful = [
            item for item in result.get("results") or []
            if relevance(query, item.get("title", ""), item.get("snippet", "")) >= MATCH_THRESHOLD
            and not not_learning_material(item.get("url", ""), item.get("title", ""), item.get("snippet", ""))
        ]
        return references(useful)[:GAP_SEARCH_RESULTS]


def pickable(topic: dict[str, Any]) -> list[dict[str, Any]]:
    """The references the model may pick per day. A topic's books and
    papers are not among them: they are companions for the whole topic,
    on its first day (one model put the same book on 7 of 8 days)."""
    return [ref for ref in topic["references"]
            if ref["type"] != "book" and ref["url"] not in topic.get("paper_urls", set())][:MAX_PROMPT_REFERENCES]


def day_subject(title: str, topic_name: str) -> str:
    """What a day is about: its title's words minus the topic's own and
    the words that only say what kind of day it is ("review", "project")."""
    shared = set(topic_terms(topic_name)) | GENERIC_DAY_WORDS
    return " ".join(term for term in topic_terms(title) if term not in shared)


def check_picks(topic: dict[str, Any], day: dict[str, Any], used: set[str]) -> None:
    """Check the model's picks for one day, in day order. A reference an
    earlier day already picked stays only if it is about this day's
    subject: the model would otherwise put the same overview video on
    "Proof of History", "Tower BFT" and "Sealevel". A day left with no
    pick (and no search of the model's own) asks for a search on its
    subject; a day with no subject of its own (a review day) does not."""
    subject = day_subject(day["title"], topic["name"])
    day["refs"] = [
        ref for ref in day.get("refs") or []
        if canonical_url(ref["url"]) not in used or not subject
        or relevance(subject, ref.get("title", ""), ref.get("description", "")) > 0
    ]
    if not day["refs"] and not day.get("search") and subject:
        day["search"] = clip(f"{topic['name']} {subject}", 100)
    if day["refs"]:
        day["search"] = ""
    used.update(canonical_url(ref["url"]) for ref in day["refs"])


def _with_picks(day: DayNarrative, listed: list[dict[str, Any]]) -> dict[str, Any]:
    """A day's wording with its picks resolved to the listed references
    (numbers outside the list are ignored) and its search request kept
    only when it picked nothing."""
    picks = [listed[n - 1] for n in dict.fromkeys(day.refs) if 1 <= n <= len(listed)][:MAX_PICKS_PER_DAY]
    return {"title": day.title, "objectives": day.objectives, "refs": picks,
            "search": "" if picks else day.search}
