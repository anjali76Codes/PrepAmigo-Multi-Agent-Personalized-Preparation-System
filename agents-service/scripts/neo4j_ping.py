"""Minimal read-only Neo4j liveness probe for the scheduled workflow."""

import os

from neo4j import GraphDatabase


def main() -> None:
    uri = os.environ["NEO4J_URI"].strip()
    username = os.environ.get("NEO4J_USERNAME", "neo4j").strip() or "neo4j"
    password = os.environ["NEO4J_PASSWORD"]
    database = os.environ.get("NEO4J_DATABASE", "").strip() or None

    with GraphDatabase.driver(uri, auth=(username, password), connection_timeout=10) as driver:
        driver.verify_connectivity()
        records, _, _ = driver.execute_query("RETURN 1 AS ok", database_=database)
        if records[0]["ok"] != 1:
            raise RuntimeError("Neo4j liveness query returned an unexpected result")

    print("Neo4j liveness query succeeded")


if __name__ == "__main__":
    main()
