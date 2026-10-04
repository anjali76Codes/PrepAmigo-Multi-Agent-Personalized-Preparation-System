import pytest
import httpx
from tools.plan_db_sync import PlanDBSyncClient, PlanDBSyncError


SAMPLE_OUTPUT = {
    "plan": {
        "plan_name": "Google SWE Preparation Plan",
        "company": "Google",
        "role": "SWE",
        "total_days": 3,
        "start_date": "2026-10-04",
        "end_date": "2026-10-06",
        "completion_percent": 0,
        "status": "pending",
    },
    "sprints": [
        {
            "sprint_number": 1,
            "sprint_name": "Foundations",
            "start_date": "2026-10-04",
            "end_date": "2026-10-05",
            "total_days": 2,
            "completion_percent": 0,
            "status": "pending",
        },
        {
            "sprint_number": 2,
            "sprint_name": "Advanced",
            "start_date": "2026-10-06",
            "end_date": "2026-10-06",
            "total_days": 1,
            "completion_percent": 0,
            "status": "pending",
        },
    ],
    "sprint_days": [
        {
            "sprint_number": 1,
            "day_number": 1,
            "scheduled_date": "2026-10-04",
            "topic_title": "Arrays & Hashing",
            "topic_description": "Foundations of array problems",
            "objectives": ["Understand hash maps", "Solve two sum"],
            "estimated_minutes": 60,
            "references": [
                {
                    "type": "article",
                    "title": "Arrays Tutorial",
                    "url": "https://example.com/arrays",
                    "source": "Example",
                    "description": "Tutorial",
                    "is_required": True,
                }
            ],
            "status": "pending",
        },
        {
            "sprint_number": 1,
            "day_number": 2,
            "scheduled_date": "2026-10-05",
            "topic_title": "Two Pointers",
            "topic_description": "Two pointer technique",
            "objectives": ["Understand 2-pointer patterns"],
            "estimated_minutes": 60,
            "references": [],
            "status": "pending",
        },
        {
            "sprint_number": 2,
            "day_number": 3,
            "scheduled_date": "2026-10-06",
            "topic_title": "Dynamic Programming",
            "topic_description": "DP patterns",
            "objectives": ["Solve 1D DP"],
            "estimated_minutes": 90,
            "references": [],
            "status": "pending",
        },
    ],
}


def test_sequential_sync_flow_calls_all_endpoints_in_order():
    async def _test():
        called_endpoints = []

        def handler(request: httpx.Request):
            called_endpoints.append((request.method, request.url.path))
            if request.url.path == "/api/plans":
                return httpx.Response(201, json={"success": True, "planId": "650000000000000000000001", "id": "650000000000000000000001"})
            elif request.url.path == "/api/sprints":
                s_id = "650000000000000000000002" if len([e for e in called_endpoints if e[1] == "/api/sprints"]) == 1 else "650000000000000000000003"
                return httpx.Response(201, json={"success": True, "sprintId": s_id, "id": s_id})
            elif request.url.path == "/api/sprint-days":
                return httpx.Response(201, json={"success": True, "ids": ["650000000000000000000010", "650000000000000000000011"]})
            return httpx.Response(404)

        transport = httpx.MockTransport(handler)
        client = PlanDBSyncClient(base_url="http://mockbackend")

        async with httpx.AsyncClient(transport=transport, base_url="http://mockbackend") as mock_http:
            # Step 1: Create Plan
            plan_id = await client.create_plan(SAMPLE_OUTPUT["plan"], client=mock_http)
            assert plan_id == "650000000000000000000001"

            # Step 2: Create Sprint 1
            sprint1_id = await client.create_sprint(plan_id, SAMPLE_OUTPUT["sprints"][0], client=mock_http)
            assert sprint1_id == "650000000000000000000002"

            # Step 3: Create Sprint 1 Days
            sprint1_days = [d for d in SAMPLE_OUTPUT["sprint_days"] if d["sprint_number"] == 1]
            day_ids = await client.create_sprint_days(sprint1_id, sprint1_days, client=mock_http)
            assert len(day_ids) == 2

        assert called_endpoints == [
            ("POST", "/api/plans"),
            ("POST", "/api/sprints"),
            ("POST", "/api/sprint-days"),
        ]

    import asyncio
    asyncio.run(_test())
