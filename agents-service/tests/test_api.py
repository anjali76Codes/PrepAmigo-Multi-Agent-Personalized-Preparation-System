import pytest
from fastapi.testclient import TestClient
from types import SimpleNamespace

import main


class FakeGraph:
    def __init__(self):
        self.payloads = []

    async def ainvoke(self, payload, config):
        from langchain_core.messages import AIMessage

        self.payloads.append(payload)
        assert payload["messages"][0].content == "How should I prepare for DP?"
        assert config["configurable"]["thread_id"] == "thread-1"
        return {"messages": [AIMessage(content="Start with recursion and memoization.")]}


def test_health_contract():
    response = TestClient(main.app).get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "UP"


def test_chat_contract(monkeypatch):
    with TestClient(main.app) as client:
        main.app.state.graph = FakeGraph()
        response = client.post(
            "/api/chat",
            json={"message": "How should I prepare for DP?", "thread_id": "thread-1"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "thread_id": "thread-1",
        "message": "Start with recursion and memoization.",
    }


def test_chat_passes_user_id_for_memory():
    graph = FakeGraph()
    with TestClient(main.app) as client:
        main.app.state.graph = graph
        response = client.post(
            "/api/chat",
            json={"message": "How should I prepare for DP?", "thread_id": "thread-1", "user_id": "subhaan"},
        )

    assert response.status_code == 200
    assert graph.payloads[0]["user_id"] == "subhaan"


def test_chat_rejects_empty_message():
    with TestClient(main.app) as client:
        response = client.post("/api/chat", json={"message": ""})

    assert response.status_code == 422


def test_chat_resumes_an_interview_prep_interrupt_on_the_same_thread():
    from langchain_core.messages import AIMessage
    from langgraph.types import Command

    class PausedGraph:
        def __init__(self):
            self.resume = None

        async def aget_state(self, _config):
            return SimpleNamespace(next=("interview_prep_pause",))

        async def ainvoke(self, payload, config):
            self.resume = payload
            assert isinstance(payload, Command)
            assert config["configurable"]["thread_id"] == "prep-thread"
            return {"messages": [AIMessage(content="Research is complete.")]}

    graph = PausedGraph()
    with TestClient(main.app) as client:
        main.app.state.graph = graph
        response = client.post(
            "/api/chat",
            json={"message": "Backend Engineer in Seattle", "thread_id": "prep-thread"},
        )

    assert response.status_code == 200
    assert response.json()["message"] == "Research is complete."
    assert graph.resume.resume == {"answer": "Backend Engineer in Seattle"}


def test_internal_execute_contract_accepts_workflow_and_requires_thread_to_resume():
    request = main.ExecuteAgentRequest(
        runId="run-1",
        query="",
        workflow_mode="interview_prep",
        workflow_input={"company": "Acme"},
    )
    assert request.workflow_mode == "interview_prep"

    with pytest.raises(ValueError, match="thread_id is required"):
        main.ExecuteAgentRequest(
            runId="run-2",
            query="",
            workflow_mode="interview_prep",
            resume_input={"role": "Engineer"},
        )


def test_interview_prep_fields_api_exposes_agent_routing_schema():
    with TestClient(main.app) as client:
        response = client.get("/api/interview-prep/fields")

    assert response.status_code == 200
    by_name = {field["name"]: field for field in response.json()["fields"]}
    assert by_name["company"]["recipients"] == ["company_research", "job_intelligence"]
    assert by_name["location"]["recipients"] == ["job_intelligence"]


def test_memory_user_id_uses_verified_claims_when_authentication_is_enabled():
    assert main._resolve_user_id({"sub": "verified-user"}, "untrusted-user") == "verified-user"
    assert main._resolve_user_id(True, "local-user") == "local-user"


def test_authenticated_chat_threads_are_scoped_to_the_claimed_user():
    first = main._scope_thread_id({"sub": "user-a"}, "user-a", "shared-thread")
    second = main._scope_thread_id({"sub": "user-b"}, "user-b", "shared-thread")

    assert first != second
    assert main._scope_thread_id({"sub": "user-a"}, "user-a", first) == first


def test_job_intelligence_endpoint_success_envelope(monkeypatch):
    import routers.job_intelligence_router as jir

    async def fake_profile(req):
        return {
            "company": req.company,
            "role": req.role,
            "location": req.location,
            "skills": [{"name": "Python", "frequency": 5}],
        }

    monkeypatch.setattr(jir, "get_job_intelligence_profile", fake_profile)

    with TestClient(main.app) as client:
        res = client.post(
            "/api/agents/job-intelligence",
            json={"company": "Google", "role": "Backend Engineer", "location": "Remote"},
        )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["data"]["company"] == "Google"
    assert data["data"]["skills"][0]["name"] == "Python"


def test_job_intelligence_raw_search_success_envelope(monkeypatch):
    import routers.job_intelligence_router as jir

    def fake_search(query, location):
        return [{"title": "Software Engineer", "company_name": "Google"}]

    monkeypatch.setattr(jir, "fetch_google_jobs", fake_search)

    with TestClient(main.app) as client:
        res = client.post(
            "/api/agents/job-intelligence/raw-search",
            json={"company": "Google", "role": "SWE", "location": "Remote"},
        )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["data"]) == 1
    assert data["data"][0]["title"] == "Software Engineer"


def test_skill_gap_endpoint_success_envelope(monkeypatch):
    import json
    import routers.skill_gap_router as sgr

    monkeypatch.setattr(sgr, "parse_resume", lambda file, content: "Resume: Python, Docker")

    async def fake_build_profile(text):
        return {"skills": ["Python", "Docker"]}

    async def fake_evaluate_gaps(profile, required):
        return {
            "skill_evaluations": [
                {"skill": "Python", "status": "matched", "reason": "Present in resume"}
            ],
            "extra_skills": ["Docker"],
        }

    monkeypatch.setattr(sgr, "build_candidate_profile", fake_build_profile)
    monkeypatch.setattr(sgr, "evaluate_gaps", fake_evaluate_gaps)

    job_intel = json.dumps({"skills": [{"name": "Python", "frequency": 4}], "coverage": "high"})

    with TestClient(main.app) as client:
        res = client.post(
            "/api/agents/skill-gap",
            data={"job_intelligence_data": job_intel},
            files={"resume": ("resume.txt", b"Python Docker resume content", "text/plain")},
        )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "matched_skills" in data["data"]
    assert "priority_gaps" in data["data"]


def test_stream_endpoint_contract(monkeypatch):
    import json
    from unittest.mock import AsyncMock
    import routers.stream_router as sr

    mock_redis = AsyncMock()
    mock_redis.lrange = AsyncMock(
        return_value=[
            json.dumps({"type": "thinking", "runId": "run-test", "payload": {"message": "Starting"}}),
            json.dumps({"type": "completed", "runId": "run-test", "payload": {"status": "complete"}}),
        ]
    )
    mock_redis.aclose = AsyncMock()
    monkeypatch.setattr(sr.aioredis, "from_url", lambda *args, **kwargs: mock_redis)

    with TestClient(main.app) as client:
        res = client.get("/api/agent/stream/run-test")

    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    assert "no-cache" in res.headers["cache-control"]
    lines = [line for line in res.text.splitlines() if line.startswith("data: ")]
    assert len(lines) == 2
    assert "thinking" in lines[0]
    assert "completed" in lines[1]