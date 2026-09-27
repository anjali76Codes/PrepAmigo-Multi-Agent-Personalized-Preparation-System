"""
User Knowledge Graph: what each candidate knows, is weak in, is studying
and has mastered, plus how learning nodes depend on each other.

Schema
  Nodes:  User, Topic, Concept, Skill, Technology, Resource
  Edges:  User     -KNOWS{proficiency 0.0-1.0}-> learning node
          User     -WEAK_IN->                    learning node
          User     -STUDYING{resource_ids}->     learning node
          User     -MASTERED->                   learning node
          learning -REQUIRES->                   learning node  (prerequisite)
          Resource -COVERS->                     learning node

Learning nodes (Topic/Concept/Skill/Technology) are keyed by normalised
name, so "System Design" and "system design" are one node whatever its type.

Agents talk to UserKnowledgeGraph only. Storage goes through
BaseGraphStore, whose primitives map 1:1 onto Cypher MERGE / MATCH, so a
Neo4j or Memgraph store can replace InMemoryGraphStore without changing
anything above it.
"""
import json
import threading
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any

from typing_extensions import TypedDict

from config import settings


class NodeType(str, Enum):
    USER = "User"
    TOPIC = "Topic"
    CONCEPT = "Concept"
    SKILL = "Skill"
    TECHNOLOGY = "Technology"
    RESOURCE = "Resource"


class EdgeType(str, Enum):
    KNOWS = "KNOWS"
    WEAK_IN = "WEAK_IN"
    STUDYING = "STUDYING"
    MASTERED = "MASTERED"
    REQUIRES = "REQUIRES"
    COVERS = "COVERS"


LEARNING_NODE_TYPES = {NodeType.TOPIC, NodeType.CONCEPT, NodeType.SKILL, NodeType.TECHNOLOGY}

# proficiency bands; a node counts as a gap until it reaches PROFICIENT_AT
WEAK_BELOW = 0.4
PROFICIENT_AT = 0.7
MASTERED_AT = 0.85


class GraphNode(TypedDict):
    id: str
    type: str
    properties: dict[str, Any]


class GraphEdge(TypedDict):
    source: str
    relation: str
    target: str
    properties: dict[str, Any]


# --------------------------------------------------------------------------
# Storage
# --------------------------------------------------------------------------


class BaseGraphStore(ABC):
    """Minimal property-graph store. At most one edge exists per
    (source, relation, target); upserts merge properties."""

    @abstractmethod
    def upsert_node(self, node_id: str, node_type: str, properties: dict[str, Any] | None = None) -> GraphNode:
        ...

    @abstractmethod
    def get_node(self, node_id: str) -> GraphNode | None:
        ...

    @abstractmethod
    def upsert_edge(
        self, source: str, relation: str, target: str, properties: dict[str, Any] | None = None
    ) -> GraphEdge:
        """Raises ValueError if either endpoint does not exist."""

    @abstractmethod
    def delete_edge(self, source: str, relation: str, target: str) -> bool:
        ...

    @abstractmethod
    def get_edges(
        self, source: str | None = None, relation: str | None = None, target: str | None = None
    ) -> list[GraphEdge]:
        """Edges matching every filter that is not None."""


class InMemoryGraphStore(BaseGraphStore):
    """Adjacency held in dicts, optionally mirrored to a JSON file."""

    def __init__(self, path: str | Path | None = None):
        self._path = Path(path) if path else None
        self._lock = threading.RLock()
        self._nodes: dict[str, GraphNode] = {}
        self._edges: dict[tuple[str, str, str], GraphEdge] = {}
        self._load()

    def upsert_node(self, node_id: str, node_type: str, properties: dict[str, Any] | None = None) -> GraphNode:
        with self._lock:
            node = self._nodes.get(node_id)
            if node is None:
                node = {"id": node_id, "type": node_type, "properties": {}}
                self._nodes[node_id] = node
            node["type"] = node_type
            node["properties"].update(properties or {})
            self._save()
            return _copy(node)

    def get_node(self, node_id: str) -> GraphNode | None:
        with self._lock:
            node = self._nodes.get(node_id)
            return _copy(node) if node else None

    def upsert_edge(
        self, source: str, relation: str, target: str, properties: dict[str, Any] | None = None
    ) -> GraphEdge:
        with self._lock:
            missing = [n for n in (source, target) if n not in self._nodes]
            if missing:
                raise ValueError(f"Cannot create {relation} edge; unknown node(s): {missing}")
            key = (source, relation, target)
            edge = self._edges.get(key)
            if edge is None:
                edge = {"source": source, "relation": relation, "target": target, "properties": {}}
                self._edges[key] = edge
            edge["properties"].update(properties or {})
            self._save()
            return _copy(edge)

    def delete_edge(self, source: str, relation: str, target: str) -> bool:
        with self._lock:
            removed = self._edges.pop((source, relation, target), None) is not None
            if removed:
                self._save()
            return removed

    def get_edges(
        self, source: str | None = None, relation: str | None = None, target: str | None = None
    ) -> list[GraphEdge]:
        with self._lock:
            return [
                _copy(edge)
                for (s, r, t), edge in self._edges.items()
                if (source is None or s == source)
                and (relation is None or r == relation)
                and (target is None or t == target)
            ]

    def _load(self) -> None:
        if not self._path or not self._path.exists():
            return
        data = json.loads(self._path.read_text(encoding="utf-8"))
        self._nodes = {node["id"]: node for node in data.get("nodes", [])}
        self._edges = {(e["source"], e["relation"], e["target"]): e for e in data.get("edges", [])}

    def _save(self) -> None:
        """Caller must hold self._lock."""
        if not self._path:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        payload = {"nodes": list(self._nodes.values()), "edges": list(self._edges.values())}
        tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        tmp.replace(self._path)


def _copy(item: dict) -> Any:
    return {**item, "properties": dict(item["properties"])}


# --------------------------------------------------------------------------
# Domain API
# --------------------------------------------------------------------------


def normalise_name(name: str) -> str:
    if not isinstance(name, str) or not name.strip():
        raise ValueError("name must be a non-empty string")
    return " ".join(name.lower().split())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class UserKnowledgeGraph:
    def __init__(self, store: BaseGraphStore | None = None):
        self.store = store or InMemoryGraphStore()

    # ---- writes ----------------------------------------------------------

    def update_proficiency(
        self,
        user_id: str,
        topic: str,
        score: float,
        node_type: NodeType = NodeType.TOPIC,
    ) -> dict[str, Any]:
        """Record an assessed proficiency and re-derive the user's status
        for the topic: WEAK_IN below WEAK_BELOW, MASTERED at MASTERED_AT
        (which also ends STUDYING)."""
        if isinstance(score, bool) or not isinstance(score, (int, float)) or not 0.0 <= score <= 1.0:
            raise ValueError("score must be a number between 0.0 and 1.0")
        user = self._ensure_user(user_id)
        node = self._ensure_learning_node(topic, node_type)
        now = _now()
        score = float(score)

        self.store.upsert_edge(user, EdgeType.KNOWS.value, node, {"proficiency": score, "updated_at": now})
        if score < WEAK_BELOW:
            self.store.upsert_edge(user, EdgeType.WEAK_IN.value, node, {"since": now})
        else:
            self.store.delete_edge(user, EdgeType.WEAK_IN.value, node)
        if score >= MASTERED_AT:
            self.store.upsert_edge(user, EdgeType.MASTERED.value, node, {"since": now})
            self.store.delete_edge(user, EdgeType.STUDYING.value, node)
        else:
            self.store.delete_edge(user, EdgeType.MASTERED.value, node)
        return self._topic_state(user, node)

    def mark_studied(
        self,
        user_id: str,
        topic: str,
        resource_id: str,
        resource_properties: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Mark the user as STUDYING `topic` using `resource_id` (a curated
        link, a generated learning module, ...)."""
        user = self._ensure_user(user_id)
        node = self._ensure_learning_node(topic)
        resource = self.add_resource(topic, resource_id, resource_properties)

        existing = self.store.get_edges(user, EdgeType.STUDYING.value, node)
        resource_ids = existing[0]["properties"].get("resource_ids", []) if existing else []
        if resource["id"] not in resource_ids:
            resource_ids = [*resource_ids, resource["id"]]
        self.store.upsert_edge(
            user,
            EdgeType.STUDYING.value,
            node,
            {"resource_ids": resource_ids, "last_studied_at": _now()},
        )
        return self._topic_state(user, node)

    def add_resource(
        self, topic: str, resource_id: str, properties: dict[str, Any] | None = None
    ) -> GraphNode:
        """Register a resource that COVERS `topic` (user-independent)."""
        if not isinstance(resource_id, str) or not resource_id.strip():
            raise ValueError("resource_id must be a non-empty string")
        node = self._ensure_learning_node(topic)
        resource = self.store.upsert_node(
            f"resource:{resource_id.strip()}", NodeType.RESOURCE.value, properties
        )
        self.store.upsert_edge(resource["id"], EdgeType.COVERS.value, node)
        return resource

    def add_prerequisite(self, topic: str, prerequisite: str) -> None:
        """`topic` REQUIRES `prerequisite`; gap analysis surfaces unmet
        prerequisites ahead of the topic itself."""
        node = self._ensure_learning_node(topic)
        required = self._ensure_learning_node(prerequisite)
        if node == required:
            raise ValueError("a topic cannot require itself")
        self.store.upsert_edge(node, EdgeType.REQUIRES.value, required)

    # ---- reads -----------------------------------------------------------

    def get_proficiency(self, user_id: str, topic: str) -> float | None:
        edges = self.store.get_edges(
            _user_id(user_id), EdgeType.KNOWS.value, _learning_id(topic)
        )
        return edges[0]["properties"].get("proficiency") if edges else None

    def get_knowledge_state(self, user_id: str) -> dict[str, Any]:
        """Serializable snapshot of everything known about the user."""
        user = _user_id(user_id)
        topics: dict[str, dict[str, Any]] = {}
        for edge in self.store.get_edges(source=user):
            node = self.store.get_node(edge["target"])
            if node is None:
                continue
            topics.setdefault(node["properties"]["name"], self._topic_state(user, node["id"]))
        return {
            "user_id": user_id,
            "topics": topics,
            "mastered": sorted(n for n, t in topics.items() if t["mastered"]),
            "weak_in": sorted(n for n, t in topics.items() if t["weak"]),
            "studying": sorted(n for n, t in topics.items() if t["studying"]),
        }

    def get_unresolved_gaps(self, user_id: str, required_skills: list[str]) -> list[str]:
        """Required skills (and, before each, their unmet REQUIRES
        prerequisites) the user has neither mastered nor reached
        PROFICIENT_AT in. Order follows `required_skills`."""
        user = _user_id(user_id)
        gaps: list[str] = []
        seen: set[str] = set()

        def visit(node_id: str, display: str) -> None:
            if node_id in seen:
                return
            seen.add(node_id)
            for edge in self.store.get_edges(source=node_id, relation=EdgeType.REQUIRES.value):
                prereq = self.store.get_node(edge["target"])
                if prereq:
                    visit(prereq["id"], prereq["properties"]["name"])
            if self._is_unresolved(user, node_id):
                gaps.append(display)

        for skill in required_skills:
            visit(_learning_id(skill), skill.strip())
        return gaps

    # ---- internals -------------------------------------------------------

    def _is_unresolved(self, user: str, node: str) -> bool:
        if self.store.get_edges(user, EdgeType.MASTERED.value, node):
            return False
        known = self.store.get_edges(user, EdgeType.KNOWS.value, node)
        return not known or known[0]["properties"].get("proficiency", 0.0) < PROFICIENT_AT

    def _topic_state(self, user: str, node: str) -> dict[str, Any]:
        edges = {e["relation"]: e["properties"] for e in self.store.get_edges(source=user, target=node)}
        node_data = self.store.get_node(node) or {"type": NodeType.TOPIC.value, "properties": {}}
        studying = edges.get(EdgeType.STUDYING.value)
        return {
            "type": node_data["type"],
            "proficiency": edges.get(EdgeType.KNOWS.value, {}).get("proficiency"),
            "weak": EdgeType.WEAK_IN.value in edges,
            "mastered": EdgeType.MASTERED.value in edges,
            "studying": studying is not None,
            "resource_ids": list(studying.get("resource_ids", [])) if studying else [],
        }

    def _ensure_user(self, user_id: str) -> str:
        node_id = _user_id(user_id)
        if self.store.get_node(node_id) is None:
            self.store.upsert_node(node_id, NodeType.USER.value, {"user_id": user_id.strip()})
        return node_id

    def _ensure_learning_node(self, name: str, node_type: NodeType | None = None) -> str:
        if node_type is not None and node_type not in LEARNING_NODE_TYPES:
            raise ValueError(f"{node_type} is not a learning node type")
        node_id = _learning_id(name)
        existing = self.store.get_node(node_id)
        if existing is None:
            self.store.upsert_node(node_id, (node_type or NodeType.TOPIC).value, {"name": name.strip()})
        elif node_type is not None and existing["type"] != node_type.value:
            self.store.upsert_node(node_id, node_type.value)
        return node_id


def _user_id(user_id: str) -> str:
    if not isinstance(user_id, str) or not user_id.strip():
        raise ValueError("user_id must be a non-empty string")
    return f"user:{user_id.strip()}"


def _learning_id(name: str) -> str:
    return f"learn:{normalise_name(name)}"


@lru_cache(maxsize=1)
def get_knowledge_graph() -> UserKnowledgeGraph:
    """Process-wide knowledge graph backed by KNOWLEDGE_GRAPH_PATH (or
    process memory when unset)."""
    return UserKnowledgeGraph(InMemoryGraphStore(settings.knowledge_graph_path or None))
