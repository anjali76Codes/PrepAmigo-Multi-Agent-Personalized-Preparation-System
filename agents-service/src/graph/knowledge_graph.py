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
          Concept  -PART_OF->                    Topic

Learning nodes (Topic/Concept/Skill/Technology) are keyed by normalised
name, so "System Design" and "system design" are one node whatever its type.

Agents talk to UserKnowledgeGraph only. Storage goes through
BaseGraphStore, whose primitives map 1:1 onto Cypher MERGE / MATCH:
InMemoryGraphStore here, Neo4jGraphStore (graph/neo4j_store.py) when
NEO4J_URI is set. get_knowledge_graph() picks one; a Neo4j that can't be
reached falls back to memory with one warning.

Who writes and reads it (all best effort: a graph problem never fails a
run or a request):
  - skill gap      record_skill_gap: first evidence of each required skill
  - planner        record_plan: topics, their concepts and resources
  - quiz attempts  record_attempt (POST /internal/knowledge/attempt):
                   per-concept proficiency, a running average
  - study material study_context: the user's weak and mastered concepts
"""
import json
import logging
import threading
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any

from typing_extensions import TypedDict

from core.config import settings

logger = logging.getLogger(__name__)


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
    PART_OF = "PART_OF"


LEARNING_NODE_TYPES = {NodeType.TOPIC, NodeType.CONCEPT, NodeType.SKILL, NodeType.TECHNOLOGY}

# proficiency bands; a node counts as a gap until it reaches PROFICIENT_AT
WEAK_BELOW = 0.4
PROFICIENT_AT = 0.7
MASTERED_AT = 0.85
# what a skill-gap verdict says about a skill before any quiz evidence
SKILL_GAP_PROFICIENCY = {"strong": 0.8, "partial": 0.5, "missing": 0.1}
# weight of the newest quiz result in a concept's running average
ATTEMPT_WEIGHT = 0.5

NodeOp = tuple[str, str, dict[str, Any]]           # (id, type, properties) created if missing
EdgeOp = tuple[str, str, str, dict[str, Any]]      # (source, relation, target, properties) upserted
DeleteOp = tuple[str, str, str]                    # (source, relation, target) removed


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

    def apply(self, nodes: list[NodeOp] = (), edges: list[EdgeOp] = (), deletes: list[DeleteOp] = ()) -> None:
        """A batch of writes: nodes created when missing (an existing node
        keeps its type and properties), then edges upserted, then edges
        removed. A remote store does each group in one round trip."""
        for node_id, node_type, properties in nodes:
            if self.get_node(node_id) is None:
                self.upsert_node(node_id, node_type, properties)
        for source, relation, target, properties in edges:
            self.upsert_edge(source, relation, target, properties)
        for source, relation, target in deletes:
            self.delete_edge(source, relation, target)


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

    # ---- batch writes (one store round trip per group) -------------------

    def record_scores(self, user_id: str, scores: dict[str, float], node_type: NodeType = NodeType.CONCEPT) -> None:
        """update_proficiency for many nodes at once."""
        if not scores:
            return
        user, now = _user_id(user_id), _now()
        nodes: list[NodeOp] = [(user, NodeType.USER.value, {"user_id": user_id.strip()})]
        edges: list[EdgeOp] = []
        deletes: list[DeleteOp] = []
        for name, score in scores.items():
            score = min(1.0, max(0.0, float(score)))
            node = _learning_id(name)
            nodes.append((node, node_type.value, {"name": name.strip()}))
            edges.append((user, EdgeType.KNOWS.value, node, {"proficiency": round(score, 3), "updated_at": now}))
            if score < WEAK_BELOW:
                edges.append((user, EdgeType.WEAK_IN.value, node, {"since": now}))
            else:
                deletes.append((user, EdgeType.WEAK_IN.value, node))
            if score >= MASTERED_AT:
                edges.append((user, EdgeType.MASTERED.value, node, {"since": now}))
                deletes.append((user, EdgeType.STUDYING.value, node))
            else:
                deletes.append((user, EdgeType.MASTERED.value, node))
        self.store.apply(nodes, edges, deletes)

    def _proficiencies(self, user_id: str) -> dict[str, float]:
        """Node id -> the user's current proficiency (one store read)."""
        edges = self.store.get_edges(source=_user_id(user_id), relation=EdgeType.KNOWS.value)
        return {e["target"]: float(e["properties"].get("proficiency", 0.0)) for e in edges}

    def record_skill_gap(self, user_id: str, report: dict[str, Any]) -> int:
        """A skill-gap report as first evidence: strong 0.8, partial 0.5,
        missing 0.1 (WEAK_IN). A skill the user already has a proficiency
        for keeps it: quiz results are better evidence than a resume read."""
        known = self._proficiencies(user_id)
        scores: dict[str, float] = {}
        for key, status in (("matched_skills", "strong"), ("partial_skills", "partial"), ("missing_skills", "missing")):
            for item in report.get(key) or []:
                name = str(item.get("skill_name") or item.get("skill") or "").strip() if isinstance(item, dict) else ""
                if name and _learning_id(name) not in known:
                    scores[name] = SKILL_GAP_PROFICIENCY[status]
        self.record_scores(user_id, scores, NodeType.SKILL)
        return len(scores)

    def record_plan(self, user_id: str, topics: list[dict[str, Any]]) -> int:
        """A planned topic set: each topic, its key concepts (PART_OF), its
        resources (COVERS), and the user STUDYING it."""
        user, now = _user_id(user_id), _now()
        nodes: list[NodeOp] = [(user, NodeType.USER.value, {"user_id": user_id.strip()})]
        edges: list[EdgeOp] = []
        for topic in topics:
            name = str(topic.get("name") or "").strip()
            if not name:
                continue
            node = _learning_id(name)
            nodes.append((node, NodeType.TOPIC.value, {"name": name}))
            resource_ids = []
            for concept in topic.get("concepts") or []:
                if isinstance(concept, str) and concept.strip():
                    concept_id = _learning_id(concept)
                    nodes.append((concept_id, NodeType.CONCEPT.value, {"name": concept.strip()}))
                    edges.append((concept_id, EdgeType.PART_OF.value, node, {}))
            for ref in topic.get("references") or []:
                url = str(ref.get("url") or "").strip()
                if url:
                    resource_id = f"resource:{url}"
                    resource_ids.append(resource_id)
                    nodes.append((resource_id, NodeType.RESOURCE.value,
                                  {"title": str(ref.get("title") or "")[:300], "url": url,
                                   "kind": str(ref.get("type") or "")}))
                    edges.append((resource_id, EdgeType.COVERS.value, node, {}))
            edges.append((user, EdgeType.STUDYING.value, node,
                          {"resource_ids": list(dict.fromkeys(resource_ids)), "last_studied_at": now}))
        self.store.apply(nodes, edges)
        return len(nodes) - 1

    def record_attempt(self, user_id: str, results: list[dict[str, Any]]) -> dict[str, float]:
        """Quiz or flashcard results ({"concept", "correct": bool} or
        {"concept", "score": 0-1}) as per-concept proficiency: the share
        right this time, averaged with what was known (ATTEMPT_WEIGHT for
        the newest). Returns concept -> new proficiency."""
        totals: dict[str, list[float]] = {}
        for item in results:
            concept = str(item.get("concept") or "").strip()
            if not concept:
                continue
            value = item.get("score")
            if value is None:
                value = 1.0 if item.get("correct") else 0.0
            totals.setdefault(concept, []).append(min(1.0, max(0.0, float(value))))
        if not totals:
            return {}
        known = self._proficiencies(user_id)
        scores = {}
        for concept, values in totals.items():
            now = sum(values) / len(values)
            before = known.get(_learning_id(concept))
            scores[concept] = now if before is None else before * (1 - ATTEMPT_WEIGHT) + now * ATTEMPT_WEIGHT
        self.record_scores(user_id, scores, NodeType.CONCEPT)
        return {k: round(v, 3) for k, v in scores.items()}

    def study_context(self, user_id: str, concepts: list[str] | None = None, limit: int = 8) -> dict[str, list[str]]:
        """The user's weak and mastered concepts (one store read), limited
        to `concepts` when given: what a quiz should test more, or skip."""
        wanted = {_learning_id(c): c.strip() for c in concepts or [] if isinstance(c, str) and c.strip()}
        edges = self.store.get_edges(source=_user_id(user_id))
        found: dict[str, list[str]] = {"weak": [], "mastered": []}
        for edge in edges:
            key = {"WEAK_IN": "weak", "MASTERED": "mastered"}.get(edge["relation"])
            if key is None or (wanted and edge["target"] not in wanted):
                continue
            name = wanted.get(edge["target"]) or edge["target"].removeprefix("learn:")
            if name not in found[key]:
                found[key].append(name)
        return {key: names[:limit] for key, names in found.items()}

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
    """Process-wide knowledge graph: Neo4j when NEO4J_URI is set and
    reachable, else KNOWLEDGE_GRAPH_PATH (or process memory)."""
    if settings.neo4j_uri:
        try:
            from graph.neo4j_store import Neo4jGraphStore

            return UserKnowledgeGraph(Neo4jGraphStore(
                settings.neo4j_uri, settings.neo4j_username, settings.neo4j_password, settings.neo4j_database))
        except Exception as exc:
            logger.warning("Knowledge graph: Neo4j unavailable (%s); using in-memory storage for this process",
                           str(exc)[:200] or type(exc).__name__)
    return UserKnowledgeGraph(InMemoryGraphStore(settings.knowledge_graph_path or None))


async def best_effort(action: str, fn, *args, timeout: float = 15.0) -> Any:
    """Run a (blocking) graph call off the event loop; a graph problem is
    logged as one line and returns None, never fails the caller."""
    import asyncio

    try:
        return await asyncio.wait_for(asyncio.to_thread(fn, *args), timeout=timeout)
    except Exception as exc:
        logger.warning("Knowledge graph: %s skipped (%s)", action, str(exc)[:200] or type(exc).__name__)
        return None


_background: set[Any] = set()


def record_in_background(action: str, method_name: str, *args: Any) -> None:
    """Run get_knowledge_graph().<method_name>(*args) without the caller
    waiting (best effort, one line logged on failure). The task is kept
    referenced until it finishes."""
    import asyncio

    async def run() -> None:
        graph = await best_effort("opening the graph", get_knowledge_graph)
        if graph is not None:
            await best_effort(action, getattr(graph, method_name), *args)

    try:
        task = asyncio.get_running_loop().create_task(run())
    except RuntimeError:
        return  # no event loop: nothing to schedule on
    _background.add(task)
    task.add_done_callback(_background.discard)
