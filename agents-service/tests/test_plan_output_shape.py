import asyncio
import json
from datetime import date
from agents.planner_agent import PlannerAgent
from schemas.study_plan import PlanEntity, SprintEntity, SprintDayEntity, SeparatedStudyPlan, StudyPlan


def test_planner_generates_independent_entities_matching_db_schema():
    modules = [{
        "topic": "System Design",
        "depth": "foundational",
        "content_markdown": "## Overview\nDistributed Systems\n\n## Key Concepts\n- **Sharding**: DB partitioning\n- **Caching**: Redis\n- **Load Balancing**: Nginx\n",
        "resources": [
            {
                "title": "System Design Primer",
                "url": "https://github.com/donnemartin/system-design-primer",
                "snippet": "Learn system design",
                "source": "GitHub",
                "resource_type": "documentation",
            },
            {
                "title": "Distributed Systems Video",
                "url": "https://youtube.com/watch?v=sample123",
                "snippet": "Video on distributed systems",
                "source": "YouTube",
                "resource_type": "video",
            }
        ],
    }]
    gaps = [{"skill": "System Design", "status": "missing", "effort": "High"}]

    output = asyncio.run(PlannerAgent().build_plan(
        modules=modules,
        priority_gaps=gaps,
        role="Backend Engineer",
        company="Google",
        start_date=date(2026, 10, 4),
        total_days=3,
    ))

    # 1. Verify "plan" is an independent entity matching Plan schema
    assert "plan" in output
    plan_data = output["plan"]
    assert plan_data["plan_name"] == "Google Backend Engineer Preparation Plan"
    assert plan_data["company"] == "Google"
    assert plan_data["role"] == "Backend Engineer"
    assert plan_data["total_days"] == 3
    assert plan_data["start_date"] == "2026-10-04"
    assert plan_data["end_date"] == "2026-10-06"
    assert plan_data["completion_percent"] == 0
    assert plan_data["status"] == "pending"
    # Verify it validates strictly as PlanEntity
    PlanEntity.model_validate(plan_data)

    # 2. Verify "sprints" contains independent Sprint entities matching Sprint schema
    assert "sprints" in output
    sprints_data = output["sprints"]
    assert len(sprints_data) >= 1
    for s in sprints_data:
        assert "sprint_number" in s
        assert "sprint_name" in s
        assert "start_date" in s
        assert "end_date" in s
        assert "total_days" in s
        assert "sprint_days" not in s  # independent, not nested!
        SprintEntity.model_validate(s)

    # 3. Verify "sprint_days" contains independent SprintDay entities matching SprintDay schema
    assert "sprint_days" in output
    days_data = output["sprint_days"]
    assert len(days_data) == 3
    for d in days_data:
        assert "day_number" in d
        assert "scheduled_date" in d
        assert "topic_title" in d
        assert "objectives" in d
        assert "references" in d
        for r in d["references"]:
            assert "type" in r
            assert "title" in r
            assert "url" in r
            assert "is_required" in r
        SprintDayEntity.model_validate(d)

    # 4. Verify SeparatedStudyPlan validates the overall structure
    SeparatedStudyPlan.model_validate({
        "plan": plan_data,
        "sprints": sprints_data,
        "sprint_days": days_data,
    })

    print("\n--- GENERATED PLAN OUTPUT MATCHING DB SCHEMA ---")
    print(json.dumps({
        "plan": output["plan"],
        "sprints": output["sprints"],
        "sprint_days": output["sprint_days"],
    }, indent=2))
