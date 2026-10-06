"""
Neo4j (e.g. Aura) storage for the user knowledge graph: the same
BaseGraphStore contract as InMemoryGraphStore (graph/knowledge_graph.py),
so nothing above the store changes.

Layout
  - every node is (:KGNode {id, kg_type, ...properties}) plus a label for
    its type (:User, :Topic, :Concept, ...) for browsing; `id` is unique
    (constraint kg_node_id). The type is kept in `kg_type` so a property
    called "type" (a resource's kind) never collides with it.
  - an edge is a relationship of its own type (:KNOWS, :WEAK_IN, ...)
    with its properties.

Node types and relation names come from the NodeType / EdgeType enums and
are checked against them before they reach a query (Cypher can't take
them as parameters); every value is a parameter.

apply() sends a batch as one transaction with one UNWIND query per node
type and per relation, so recording a plan or a quiz attempt costs a few
round trips to Aura, not hundreds.
"""
from collections import defaultdict
from typing import Any

from graph.knowledge_graph import (
    BaseGraphStore,
    DeleteOp,
    EdgeOp,
    EdgeType,
    GraphEdge,
    GraphNode,
    NodeOp,
    NodeType,
)

_NODE_TYPES = {t.value for t in NodeType}
_RELATIONS = {r.value for r in EdgeType}
_RESERVED = {"id", "kg_type"}


def _label(node_type: str) -> str:
    if node_type not in _NODE_TYPES:
        raise ValueError(f"unknown node type {node_type!r}")
    return node_type


def _relation(relation: str) -> str:
    if relation not in _RELATIONS:
        raise ValueError(f"unknown relation {relation!r}")
    return relation


def _props(properties: dict[str, Any] | None) -> dict[str, Any]:
    """Properties Neo4j can store (primitives and lists of them)."""
    return {k: v for k, v in (properties or {}).items()
            if k not in _RESERVED and (v is None or isinstance(v, (str, int, float, bool, list)))}


def _node(record_props: dict[str, Any]) -> GraphNode:
    props = dict(record_props)
    return {"id": props.pop("id"), "type": props.pop("kg_type", NodeType.TOPIC.value), "properties": props}


class Neo4jGraphStore(BaseGraphStore):
    def __init__(self, uri: str, username: str, password: str, database: str = "", driver: Any = None):
        if driver is None:
            from neo4j import GraphDatabase

            driver = GraphDatabase.driver(uri, auth=(username, password), connection_timeout=8,
                                          max_transaction_retry_time=8)
            driver.verify_connectivity()
        self._driver = driver
        self._database = database or None
        self._run("CREATE CONSTRAINT kg_node_id IF NOT EXISTS FOR (n:KGNode) REQUIRE n.id IS UNIQUE")

    def _run(self, query: str, **params: Any) -> list[Any]:
        records, _, _ = self._driver.execute_query(query, params, database_=self._database)
        return records

    # ---- BaseGraphStore ---------------------------------------------------

    def upsert_node(self, node_id: str, node_type: str, properties: dict[str, Any] | None = None) -> GraphNode:
        records = self._run(
            f"MERGE (n:KGNode {{id: $id}}) SET n.kg_type = $type, n += $props, n:{_label(node_type)} "
            "RETURN properties(n) AS p",
            id=node_id, type=node_type, props=_props(properties))
        return _node(records[0]["p"])

    def get_node(self, node_id: str) -> GraphNode | None:
        records = self._run("MATCH (n:KGNode {id: $id}) RETURN properties(n) AS p", id=node_id)
        return _node(records[0]["p"]) if records else None

    def upsert_edge(self, source: str, relation: str, target: str,
                    properties: dict[str, Any] | None = None) -> GraphEdge:
        records = self._run(
            f"MATCH (a:KGNode {{id: $s}}), (b:KGNode {{id: $t}}) MERGE (a)-[r:{_relation(relation)}]->(b) "
            "SET r += $props RETURN properties(r) AS p",
            s=source, t=target, props=_props(properties))
        if not records:
            raise ValueError(f"Cannot create {relation} edge; unknown node(s) among {[source, target]}")
        return {"source": source, "relation": relation, "target": target, "properties": dict(records[0]["p"])}

    def delete_edge(self, source: str, relation: str, target: str) -> bool:
        records = self._run(
            f"MATCH (:KGNode {{id: $s}})-[r:{_relation(relation)}]->(:KGNode {{id: $t}}) "
            "DELETE r RETURN count(r) AS n",
            s=source, t=target)
        return bool(records and records[0]["n"])

    def get_edges(self, source: str | None = None, relation: str | None = None,
                  target: str | None = None) -> list[GraphEdge]:
        rel = f":{_relation(relation)}" if relation else ""
        records = self._run(
            f"MATCH (a:KGNode)-[r{rel}]->(b:KGNode) "
            "WHERE ($s IS NULL OR a.id = $s) AND ($t IS NULL OR b.id = $t) "
            "RETURN a.id AS s, type(r) AS rel, b.id AS t, properties(r) AS p",
            s=source, t=target)
        return [{"source": r["s"], "relation": r["rel"], "target": r["t"], "properties": dict(r["p"])}
                for r in records]

    def apply(self, nodes: list[NodeOp] = (), edges: list[EdgeOp] = (), deletes: list[DeleteOp] = ()) -> None:
        node_rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for node_id, node_type, properties in nodes:
            node_rows[_label(node_type)].append({"id": node_id, "type": node_type, "props": _props(properties)})
        edge_rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for source, relation, target, properties in edges:
            edge_rows[_relation(relation)].append({"s": source, "t": target, "props": _props(properties)})
        delete_rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for source, relation, target in deletes:
            delete_rows[_relation(relation)].append({"s": source, "t": target})

        def work(tx: Any) -> None:
            # created when missing; an existing node keeps its type and properties
            for label, rows in node_rows.items():
                tx.run(f"UNWIND $rows AS row MERGE (n:KGNode {{id: row.id}}) "
                       f"ON CREATE SET n.kg_type = row.type, n += row.props, n:{label}", rows=rows).consume()
            for rel, rows in edge_rows.items():
                tx.run(f"UNWIND $rows AS row MATCH (a:KGNode {{id: row.s}}), (b:KGNode {{id: row.t}}) "
                       f"MERGE (a)-[r:{rel}]->(b) SET r += row.props", rows=rows).consume()
            for rel, rows in delete_rows.items():
                tx.run(f"UNWIND $rows AS row MATCH (:KGNode {{id: row.s}})-[r:{rel}]->(:KGNode {{id: row.t}}) "
                       "DELETE r", rows=rows).consume()

        if node_rows or edge_rows or delete_rows:
            with self._driver.session(database=self._database) as session:
                session.execute_write(work)

    def close(self) -> None:
        self._driver.close()
