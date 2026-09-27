import pytest

from graph.knowledge_graph import EdgeType, InMemoryGraphStore, NodeType, UserKnowledgeGraph


@pytest.fixture
def graph():
    return UserKnowledgeGraph(InMemoryGraphStore())


def test_proficiency_bands_drive_weak_and_mastered_edges(graph):
    weak = graph.update_proficiency("u1", "Dynamic Programming", 0.2)
    assert weak["weak"] and not weak["mastered"]

    middling = graph.update_proficiency("u1", "dynamic   programming", 0.6)
    assert not middling["weak"] and not middling["mastered"]
    assert middling["proficiency"] == 0.6

    mastered = graph.update_proficiency("u1", "Dynamic Programming", 0.9)
    assert mastered["mastered"] and not mastered["weak"]


@pytest.mark.parametrize("score", [-0.1, 1.5, True, "0.5"])
def test_update_proficiency_rejects_invalid_scores(graph, score):
    with pytest.raises(ValueError, match="score"):
        graph.update_proficiency("u1", "Graphs", score)


def test_mastery_ends_studying(graph):
    graph.mark_studied("u1", "Graphs", "module-1")
    assert graph.get_knowledge_state("u1")["studying"] == ["Graphs"]

    graph.update_proficiency("u1", "Graphs", 0.95)

    state = graph.get_knowledge_state("u1")
    assert state["studying"] == []
    assert state["mastered"] == ["Graphs"]


def test_mark_studied_accumulates_resources_without_duplicates(graph):
    graph.mark_studied("u1", "System Design", "module-1", {"title": "SD module"})
    graph.mark_studied("u1", "System Design", "https://example.com/sd")
    topic = graph.mark_studied("u1", "System Design", "module-1")

    assert topic["studying"]
    assert topic["resource_ids"] == ["resource:module-1", "resource:https://example.com/sd"]
    covers = graph.store.get_edges(relation=EdgeType.COVERS.value, target="learn:system design")
    assert len(covers) == 2


def test_knowledge_state_snapshot(graph):
    graph.update_proficiency("u1", "React", 0.9, NodeType.TECHNOLOGY)
    graph.update_proficiency("u1", "DSA", 0.3, NodeType.SKILL)
    graph.mark_studied("u1", "DSA", "module-1")
    graph.update_proficiency("u2", "Rust", 0.1)

    state = graph.get_knowledge_state("u1")

    assert state["user_id"] == "u1"
    assert set(state["topics"]) == {"React", "DSA"}
    assert state["topics"]["React"]["type"] == "Technology"
    assert state["mastered"] == ["React"]
    assert state["weak_in"] == ["DSA"]
    assert state["studying"] == ["DSA"]
    assert graph.get_knowledge_state("nobody")["topics"] == {}


def test_unresolved_gaps_skip_proficient_and_mastered_skills(graph):
    graph.update_proficiency("u1", "React", 0.9)
    graph.update_proficiency("u1", "Node.js", 0.75)
    graph.update_proficiency("u1", "DSA", 0.3)
    graph.update_proficiency("u1", "SQL", 0.65)

    gaps = graph.get_unresolved_gaps("u1", ["React", "Node.js", "DSA", "SQL", "System Design"])

    assert gaps == ["DSA", "SQL", "System Design"]


def test_unresolved_gaps_surface_prerequisites_first_and_survive_cycles(graph):
    graph.add_prerequisite("Dynamic Programming", "Recursion")
    graph.add_prerequisite("Recursion", "Big-O Notation")
    graph.add_prerequisite("Big-O Notation", "Dynamic Programming")  # cycle
    graph.update_proficiency("u1", "Big-O Notation", 0.8)

    gaps = graph.get_unresolved_gaps("u1", ["Dynamic Programming", "Recursion"])

    assert gaps == ["Recursion", "Dynamic Programming"]


def test_topic_cannot_require_itself(graph):
    with pytest.raises(ValueError):
        graph.add_prerequisite("Graphs", " graphs ")


def test_json_store_round_trip(tmp_path):
    path = tmp_path / "kg.json"
    graph = UserKnowledgeGraph(InMemoryGraphStore(path))
    graph.update_proficiency("u1", "Kafka", 0.5)
    graph.mark_studied("u1", "Kafka", "module-1")

    reloaded = UserKnowledgeGraph(InMemoryGraphStore(path))

    assert reloaded.get_proficiency("u1", "kafka") == 0.5
    assert reloaded.get_knowledge_state("u1")["studying"] == ["Kafka"]


def test_edges_require_existing_nodes():
    store = InMemoryGraphStore()
    with pytest.raises(ValueError, match="unknown node"):
        store.upsert_edge("user:u1", EdgeType.KNOWS.value, "learn:x")
