from fastapi.testclient import TestClient

import main


class FakeGraph:
    def invoke(self, payload, config):
        from langchain_core.messages import AIMessage

        assert payload["messages"][0].content == "Find a flight"
        assert config["configurable"]["thread_id"] == "thread-1"
        return {"messages": [AIMessage(content="Here are the available flights.")]}


def test_health_contract():
    response = TestClient(main.app).get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "UP"


def test_chat_contract(monkeypatch):
    with TestClient(main.app) as client:
        main.app.state.graph = FakeGraph()
        response = client.post(
            "/api/chat",
            json={"message": "Find a flight", "thread_id": "thread-1"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "thread_id": "thread-1",
        "message": "Here are the available flights.",
    }


def test_chat_rejects_empty_message():
    with TestClient(main.app) as client:
        response = client.post("/api/chat", json={"message": ""})

    assert response.status_code == 422