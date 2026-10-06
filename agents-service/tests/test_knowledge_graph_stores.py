"""The knowledge graph's batch writes and reads, on every store.

In-memory always runs. Neo4j runs only with KG_TEST_NEO4J=1 (credentials
from agents-service/.env), inside a namespace of its own: every id is
prefixed for the test and everything is deleted afterwards, so the real
graph (where learning nodes such as "learn:graphs" are shared by users) is
never touched.
"""
import asyncio
import logging
import os
import uuid
from pathlib import Path

import pytest

import graph.knowledge_graph as kg
from graph.knowledge_graph import EdgeType, InMemoryGraphStore, NodeType, UserKnowledgeGraph


def _neo4j_store():
    from dotenv import dotenv_values

    from graph.neo4j_store import Neo4jGraphStore

    env = dotenv_values(Path(__file__).resolve().parents[1] / ".env")
    prefix = f"kgtest-{uuid.uuid4().hex[:8]}:"

    class Namespaced(Neo4jGraphStore):
        """Every id lives under `prefix` for the length of one test."""
        def upsert_node(self, node_id, node_type, properties=None):
            node = super().upsert_node(prefix + node_id, node_type, properties)
            return {**node, "id": node["id"].removeprefix(prefix)}

        def get_node(self, node_id):
            node = super().get_node(prefix + node_id)
            return {**node, "id": node["id"].removeprefix(prefix)} if node else None

        def upsert_edge(self, source, relation, target, properties=None):
            edge = super().upsert_edge(prefix + source, relation, prefix + target, properties)
            return {**edge, "source": source, "target": target}

        def delete_edge(self, source, relation, target):
            return super().delete_edge(prefix + source, relation, prefix + target)

        def get_edges(self, source=None, relation=None, target=None):
            edges = super().get_edges(prefix + source if source else None, relation,
                                      prefix + target if target else None)
            return [{**e, "source": e["source"].removeprefix(prefix), "target": e["target"].removeprefix(prefix)}
                    for e in edges if e["source"].startswith(prefix)]

        def apply(self, nodes=(), edges=(), deletes=()):
            super().apply([(prefix + i, t, p) for i, t, p in nodes],
                          [(prefix + s, r, prefix + t, p) for s, r, t, p in edges],
                          [(prefix + s, r, prefix + t) for s, r, t in deletes])

        def cleanup(self):
            self._run("MATCH (n:KGNode) WHERE n.id STARTS WITH $p DETACH DELETE n", p=prefix)

    return Namespaced(env["NEO4J_URI"], env.get("NEO4J_USERNAME") or "neo4j", env["NEO4J_PASSWORD"],
                      env.get("NEO4J_DATABASE") or "")


STORES = ["memory"] + (["neo4j"] if os.getenv("KG_TEST_NEO4J") == "1" else [])


@pytest.fixture(params=STORES)
def graph(request):
    if request.param == "memory":
        yield UserKnowledgeGraph(InMemoryGraphStore())
        return
    store = _neo4j_store()
    try:
        yield UserKnowledgeGraph(store)
    finally:
        store.cleanup()
        store.close()


# ---- the store contract ----------------------------------------------------

def test_nodes_and_edges_round_trip(graph):
    store = graph.store
    store.upsert_node("user:a", NodeType.USER.value, {"user_id": "a"})
    store.upsert_node("resource:x", NodeType.RESOURCE.value, {"type": "video", "url": "https://x.example"})
    assert store.get_node("resource:x")["properties"]["type"] == "video"  # never confused with the node type
    assert store.get_node("resource:x")["type"] == "Resource"

    store.upsert_edge("user:a", "STUDYING", "resource:x", {"resource_ids": ["r1"]})
    store.upsert_edge("user:a", "STUDYING", "resource:x", {"last": "now"})  # properties merge
    [edge] = store.get_edges(source="user:a")
    assert edge["properties"] == {"resource_ids": ["r1"], "last": "now"}

    assert store.delete_edge("user:a", "STUDYING", "resource:x") is True
    assert store.get_edges(source="user:a") == []
    with pytest.raises(ValueError):
        store.upsert_edge("user:a", "KNOWS", "learn:missing")


def test_a_batch_creates_missing_nodes_only_and_applies_edges_then_deletes(graph):
    store = graph.store
    store.upsert_node("learn:graphs", NodeType.SKILL.value, {"name": "Graphs"})
    store.apply(
        nodes=[("user:a", "User", {}), ("learn:graphs", "Topic", {"name": "other"})],
        edges=[("user:a", "KNOWS", "learn:graphs", {"proficiency": 0.3}),
               ("user:a", "WEAK_IN", "learn:graphs", {})],
        deletes=[("user:a", "WEAK_IN", "learn:graphs")],
    )
    node = store.get_node("learn:graphs")
    assert node["type"] == "Skill" and node["properties"]["name"] == "Graphs"  # existing node untouched
    assert [e["relation"] for e in store.get_edges(source="user:a")] == ["KNOWS"]


# ---- the domain writes and reads ------------------------------------------------

def test_scores_set_weak_and_mastered_in_one_batch(graph):
    graph.record_scores("u1", {"Hash maps": 0.2, "Recursion": 0.9, "Sorting": 0.6})
    context = graph.study_context("u1")
    assert context == {"weak": ["hash maps"], "mastered": ["recursion"]}
    graph.record_scores("u1", {"Hash maps": 0.5})
    assert graph.study_context("u1", ["Hash maps"])["weak"] == []


def test_skill_gap_is_first_evidence_and_never_overrides_quiz_results(graph):
    graph.record_scores("u1", {"Python": 0.95}, NodeType.SKILL)  # from quizzes
    report = {"matched_skills": [{"skill_name": "Go"}], "partial_skills": [{"skill_name": "Python"}],
              "missing_skills": [{"skill_name": "Kafka"}]}

    assert graph.record_skill_gap("u1", report) == 2
    assert graph.get_proficiency("u1", "Python") == 0.95
    assert graph.get_proficiency("u1", "Go") == 0.8 and graph.get_proficiency("u1", "Kafka") == 0.1
    assert graph.study_context("u1")["weak"] == ["kafka"]


def test_a_plan_records_topics_concepts_resources_and_studying(graph):
    graph.record_plan("u1", [{"name": "Java", "concepts": ["Streams", "Generics"],
                              "references": [{"url": "https://docs.example/java", "title": "Java docs", "type": "documentation"}]}])
    store = graph.store
    assert {e["source"] for e in store.get_edges(relation=EdgeType.PART_OF.value, target="learn:java")} == \
        {"learn:streams", "learn:generics"}
    assert store.get_edges(source="resource:https://docs.example/java", relation="COVERS")
    [studying] = store.get_edges(source="user:u1", relation="STUDYING")
    assert studying["target"] == "learn:java" and studying["properties"]["resource_ids"] == \
        ["resource:https://docs.example/java"]


def test_quiz_results_move_a_concepts_proficiency_as_a_running_average(graph):
    first = graph.record_attempt("u1", [{"concept": "Streams", "correct": True},
                                       {"concept": "Streams", "correct": False},
                                       {"concept": "Generics", "correct": False}])
    assert first == {"Streams": 0.5, "Generics": 0.0}
    assert graph.study_context("u1", ["Generics", "Streams"])["weak"] == ["Generics"]

    second = graph.record_attempt("u1", [{"concept": "Generics", "correct": True}, {"concept": "", "correct": True}])
    assert second == {"Generics": 0.5}  # half the old 0.0, half the new 1.0
    assert graph.study_context("u1", ["Generics"])["weak"] == []

    graph.record_attempt("u1", [{"concept": "Streams", "score": 1.0}] * 3)
    graph.record_attempt("u1", [{"concept": "Streams", "score": 1.0}])
    assert graph.study_context("u1", ["Streams"])["mastered"] == ["Streams"]


# ---- availability ------------------------------------------------------------

def test_an_unreachable_neo4j_falls_back_to_memory(monkeypatch, caplog):
    import dataclasses

    monkeypatch.setattr(kg, "settings", dataclasses.replace(
        kg.settings, neo4j_uri="neo4j://127.0.0.1:1", neo4j_password="x"))
    kg.get_knowledge_graph.cache_clear()
    try:
        with caplog.at_level(logging.WARNING):
            graph = kg.get_knowledge_graph()
        assert isinstance(graph.store, InMemoryGraphStore)
        assert "Neo4j unavailable" in caplog.text
    finally:
        kg.get_knowledge_graph.cache_clear()


def test_a_graph_problem_never_fails_the_caller(caplog):
    def broken():
        raise ConnectionError("Aura paused")

    with caplog.at_level(logging.WARNING):
        assert asyncio.run(kg.best_effort("recording a plan", broken)) is None
    assert "recording a plan skipped (Aura paused)" in caplog.text


def test_only_known_node_types_and_relations_reach_a_query():
    from graph.neo4j_store import Neo4jGraphStore

    class FakeDriver:
        def execute_query(self, *args, **kwargs):
            return [], None, None

    store = Neo4jGraphStore("", "", "", driver=FakeDriver())
    with pytest.raises(ValueError, match="unknown relation"):
        store.upsert_edge("a", "KNOWS]->(x) DETACH DELETE x //", "b")
    with pytest.raises(ValueError, match="unknown node type"):
        store.upsert_node("a", "User:Admin")


def test_a_finished_plan_becomes_graph_topics_with_concepts_and_resources():
    from datetime import date

    from agents.interview_prep_orchestrator import plan_graph_topics
    from agents.planner_agent import PlannerAgent
    from test_planner_agent import GAPS, MODULES, ChunkLLM

    output = asyncio.run(PlannerAgent(llm=ChunkLLM()).build_plan(
        MODULES, GAPS, "FDE", "Anthropic", start_date=date(2026, 1, 1), total_days=10))
    topics = {t["name"]: t for t in plan_graph_topics(output)}

    assert set(topics) == set(output["coverage"]["days_per_topic"])
    assert topics["Claude"]["concepts"][:2] == ["Prompt Engineering", "Tool Use"]
    assert "https://docs.example/claude" in {r["url"] for r in topics["Claude"]["references"]}

    graph = UserKnowledgeGraph(InMemoryGraphStore())
    graph.record_plan("u1", list(topics.values()))
    assert {e["target"] for e in graph.store.get_edges(source="user:u1", relation="STUDYING")} == \
        {"learn:claude", "learn:enterprise integration", "learn:salesforce"}


def test_a_replan_skips_gaps_the_user_has_mastered(monkeypatch):
    import agents.interview_prep_orchestrator as orchestrator

    graph = UserKnowledgeGraph(InMemoryGraphStore())
    graph.record_attempt("u1", [{"concept": "Kafka", "score": 1.0}])
    monkeypatch.setattr(orchestrator, "get_knowledge_graph", lambda: graph)
    report = {"priority_gaps": [{"skill": "Kafka", "status": "missing"}, {"skill": "Go", "status": "partial"}]}

    trimmed = asyncio.run(orchestrator.drop_mastered_gaps("u1", report))
    assert [g["skill"] for g in trimmed["priority_gaps"]] == ["Go"] and trimmed["mastered_in_graph"] == ["kafka"]
    assert asyncio.run(orchestrator.drop_mastered_gaps("someone-new", report)) == report
