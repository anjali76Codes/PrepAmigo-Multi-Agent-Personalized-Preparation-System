from fastapi.testclient import TestClient

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