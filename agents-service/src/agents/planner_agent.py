"""
Planner Agent: turns the skill-gap report and the research modules into a
study plan in the backend's own shape (schemas/study_plan.py: plan ->
sprints -> sprint_days) of a target length (PLAN_TOTAL_DAYS, default 45,
or a per-run override).

Scaling to long plans (45-60 days):
  - Days are split across skill gaps by priority weight (a missing/High
    gap gets twice a partial/Medium one), so a longer plan means more days
    per gap, never more research: research stays one module per gap.
  - Each gap's days are cut into sprints of at most PLAN_SPRINT_MAX_DAYS.
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

Every gap that fits in the plan gets days, including ones whose research
failed (no module): those days carry no references and are listed under
coverage.unresearched. If the plan has fewer days than gaps, the lowest
priority gaps are listed under coverage.not_scheduled.
"""
import asyncio
import json
import logging
from datetime import date
from typing import Any

from pydantic import BaseModel, ValidationError

from core.config import get_llm, llm_concurrency, settings
from graph.events import INTERNAL_LLM_CONFIG
from observability.timing import log_failure
from storage.llm_cache import forget_response
from tools.plan_builder import (  # noqa: F401  (allocate_days etc. re-exported for callers/tests)
    allocate_days,
    assemble_plan,
    fallback_days,
    key_concepts,
    parse_json_object,
    plan_topics,
    schedule,
)

logger = logging.getLogger(__name__)

AGENT_NAME = "planner"
NARRATIVE_TIMEOUT_SECONDS = 45
# ~90 tokens per planned day x PLANNER_DAYS_PER_CALL (10), with headroom
PLANNER_MAX_TOKENS = 1400


class DayNarrative(BaseModel):
    title: str
    objectives: list[str]


class PlannerAgent:
    name = AGENT_NAME

    def __init__(self, llm: Any | None = None):
        self._llm = llm

    @property
    def llm(self):
        if self._llm is None:
            # PLANNER_LLM / PLANNER_MODEL: the day wording is short JSON, so
            # a smaller or faster model than the research one does it well
            self._llm = get_llm(temperature=0.2, max_tokens=PLANNER_MAX_TOKENS, profile=settings.planner_llm,
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

        wording, narrative_source = await self._narratives(topics, role, company, focus)

        return assemble_plan(
            topics, wording, modules=modules, role=role, company=company, start_date=start_date,
            sprint_max_days=settings.plan_sprint_max_days, narrative_source=narrative_source,
            not_scheduled=not_scheduled, user_id=user_id, max_books=settings.plan_max_books,
            max_papers=settings.plan_max_papers,
        )

    async def _narratives(
        self, topics: list[dict[str, Any]], role: str, company: str, focus: str = ""
    ) -> tuple[dict[str, list[dict[str, Any]]], str]:
        """Day wording for every topic, each topic in chunks of at most
        PLANNER_DAYS_PER_CALL days, topics concurrently up to the backend's
        LLM concurrency. Returns ({topic_key: days}, source) where source is
        "llm", "partial" or "fallback" (how many chunks the model wrote)."""
        semaphore = asyncio.Semaphore(llm_concurrency(settings, settings.planner_llm))
        chunk_results: list[bool] = []

        async def topic_days(topic: dict[str, Any]) -> list[dict[str, Any]]:
            fallback = fallback_days(topic["name"], topic["concepts"], topic["days"])
            days: list[dict[str, Any]] = []
            for start in range(0, topic["days"], settings.planner_days_per_call):
                count = min(settings.planner_days_per_call, topic["days"] - start)
                async with semaphore:
                    chunk = await self._chunk(topic, start, count, [d["title"] for d in days], role, company, focus)
                chunk_results.append(chunk is not None)
                days.extend(chunk or fallback[start:start + count])
            return days

        results = await asyncio.gather(*(topic_days(t) for t in topics))
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
        role: str, company: str, focus: str,
    ) -> list[dict[str, Any]] | None:
        """Wording for days start+1..start+count of one topic, or None when
        the model's answer is missing, late, unparseable or short."""
        last_chunk = start + count == topic["days"]
        prompt = (
            f'Plan days {start + 1}-{start + count} of {topic["days"]} for studying "{topic["name"]}" '
            f"({topic['effort']} priority) for the {role} role at {company or 'their target company'}.\n"
            + (f"The candidate already has some experience with this ({topic['evidence'] or 'listed on their resume'}): "
               "skip the beginner basics and start from applied, interview-level material.\n"
               if topic.get("status") == "partial" else "")
            + f"Key concepts of the topic: {json.dumps(topic['concepts'])}\n"
            f"Role focus (context for what matters most on the job): {focus or 'not available'}\n"
            f"Days already planned for this topic (do not repeat them): {json.dumps(covered)}\n"
            "Order: fundamentals first, hands-on practice later"
            + ("; the final day is a review plus a small project.\n" if last_chunk else ".\n")
            + "Each day has a short title (at most 8 words) and 2-3 concrete, checkable objectives.\n"
            f'Return ONLY a JSON object, no prose, no markdown, with EXACTLY {count} days: '
            '{"days": [{"title": "...", "objectives": ["...", "..."]}]}'
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
                days.append(day.model_dump())
        if len(days) < count:
            forget_response(response)
            return None
        return days[:count]
