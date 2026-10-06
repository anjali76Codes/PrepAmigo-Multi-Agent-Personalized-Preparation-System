"""POST /internal/study-material and /internal/knowledge/attempt: the
backend sends the days and the results; this service keeps no state."""
import pytest
from fastapi.testclient import TestClient

import graph.knowledge_graph as kg
import routers.study_material_router as api
from agents.study_material import ChunkMaterial, StudyCard, StudyQuestion
from graph.knowledge_graph import InMemoryGraphStore, UserKnowledgeGraph
from main import app

DAY = {"day_number": 1, "topic_title": "Hash maps", "topic_description": "Hashing.",
       "objectives": ["Explain collisions"], "references": [{"title": "Guide", "url": "https://x.example"}],
       "concepts": ["Hash maps", "Collisions"]}


@pytest.fixture
def client():
    for name in ("graph", "publisher"):
        if not hasattr(app.state, name):
            setattr(app.state, name, None)
    return TestClient(app)


@pytest.fixture
def graph(monkeypatch):
    graph = UserKnowledgeGraph(InMemoryGraphStore())
    monkeypatch.setattr(api, "get_knowledge_graph", lambda: graph)
    return graph


def test_study_material_returns_a_chunk_per_3_to_4_days_personalised_by_the_graph(client, graph, monkeypatch):
    graph.record_attempt("u1", [{"concept": "Collisions", "correct": False}])
    seen = {}

    async def fake_generate(days, user_context=None, llm=None):
        seen.update(days=days, context=user_context)
        question = StudyQuestion(question="What resolves collisions?", options=["Chaining", "Sorting", "Paging", "Caching"],
                                 answer="A", explanation="Chaining keeps a list per bucket.", concept="Collisions")
        return [ChunkMaterial(day_numbers=[1], status="ok", questions=[question],
                              cards=[StudyCard(front="Load factor", back="Entries / buckets")])]

    monkeypatch.setattr(api, "generate_for_sprint", fake_generate)
    response = client.post("/internal/study-material", json={"user_id": "u1", "days": [DAY]})

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["personalised"] is True and seen["context"]["weak"] == ["Collisions"]
    assert seen["days"][0]["concepts"] == ["Hash maps", "Collisions"]
    [chunk] = data["chunks"]
    assert chunk["status"] == "ok" and chunk["questions"][0]["answer"] == "A"


def test_study_material_still_works_without_a_graph(client, monkeypatch):
    async def broken():
        return None

    monkeypatch.setattr(api, "_graph", broken)

    async def fake_generate(days, user_context=None, llm=None):
        assert user_context is None
        return [ChunkMaterial(day_numbers=[1], status="failed", error="model down")]

    monkeypatch.setattr(api, "generate_for_sprint", fake_generate)
    response = client.post("/internal/study-material", json={"user_id": "u1", "days": [DAY]})
    assert response.status_code == 200 and response.json()["data"]["chunks"][0]["status"] == "failed"


@pytest.mark.parametrize("body", [{"days": []}, {"days": [{"day_number": 0, "topic_title": "x"}]},
                                  {"days": [{**DAY, "day_number": n} for n in range(1, 16)]}])
def test_study_material_rejects_bad_input(client, body):
    assert client.post("/internal/study-material", json=body).status_code == 422


def test_attempt_results_update_the_users_concept_proficiency(client, graph):
    response = client.post("/internal/knowledge/attempt", json={"user_id": "u1", "results": [
        {"concept": "Collisions", "correct": True}, {"concept": "Collisions", "correct": False},
        {"concept": "Hash maps", "score": 1.0}]})
    assert response.status_code == 200
    assert response.json()["data"]["updated"] == {"Collisions": 0.5, "Hash maps": 1.0}
    assert graph.study_context("u1")["mastered"] == ["hash maps"]


def test_attempts_without_a_user_change_nothing(client, graph):
    response = client.post("/internal/knowledge/attempt", json={"results": [{"concept": "X", "correct": True}]})
    assert response.status_code == 200 and response.json()["data"]["updated"] == {}
