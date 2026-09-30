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