"""schemas.study_plan mirrors the backend's Zod limits and adds the
cross-field checks an LLM-written plan gets wrong but Zod can't see."""
import copy

import pytest
from pydantic import ValidationError

from schemas.study_plan import StudyPlan


def day(n, date, refs=None):
    return {
        "day_number": n, "scheduled_date": date, "topic_title": f"Day {n}",
        "objectives": ["Learn it"], "estimated_minutes": 60, "references": refs or [],
    }


VALID = {
    "plan_name": "Acme SWE Plan", "company": "Acme", "role": "SWE", "total_days": 3,
    "start_date": "2026-01-01", "end_date": "2026-01-03",
    "sprints": [
        {"sprint_number": 1, "sprint_name": "Arrays", "start_date": "2026-01-01", "end_date": "2026-01-02",
         "total_days": 2, "sprint_days": [day(1, "2026-01-01"), day(2, "2026-01-02")]},
        {"sprint_number": 2, "sprint_name": "Graphs", "start_date": "2026-01-03", "end_date": "2026-01-03",
         "total_days": 1, "sprint_days": [day(3, "2026-01-03")]},
    ],
}


def mutated(fn):
    data = copy.deepcopy(VALID)
    fn(data)
    return data


def test_valid_plan_passes():
    StudyPlan.model_validate(VALID)


@pytest.mark.parametrize("breakage", [
    # the exact defect in output/complete_plan.json: a sprint carrying the
    # whole plan's dates/day count while holding only a week of days
    lambda d: d["sprints"][1].update(start_date="2026-01-01", total_days=3),
    lambda d: d.update(total_days=4),                                         # plan total != sum of sprints
    lambda d: d["sprints"][1]["sprint_days"][0].update(day_number=5),         # numbering gap
    lambda d: d["sprints"][0]["sprint_days"][1].update(scheduled_date="2026-02-01"),  # day outside sprint
    lambda d: d["sprints"][0].update(sprint_number=2),                        # sprint numbering
    lambda d: d.update(end_date="2025-12-31"),                                # end before start
])
def test_arithmetic_errors_are_rejected(breakage):
    with pytest.raises(ValidationError):
        StudyPlan.model_validate(mutated(breakage))


@pytest.mark.parametrize("breakage", [
    lambda d: d.update(extra_field="x"),                                      # backend bodies are .strict()
    lambda d: d["sprints"][0]["sprint_days"][0].update(
        references=[{"type": "paper", "title": "t", "url": "https://x.test"}]),  # not in the enum
    lambda d: d["sprints"][0]["sprint_days"][0].update(
        references=[{"type": "article", "title": "t", "url": "javascript:alert(1)"}]),
    lambda d: d.update(plan_name="x" * 121),                                  # Zod max(120)
    lambda d: d["sprints"][0]["sprint_days"][0].update(estimated_minutes=2000),  # Zod max(1440)
])
def test_backend_field_rules_are_enforced(breakage):
    with pytest.raises(ValidationError):
        StudyPlan.model_validate(mutated(breakage))
