# Keep-alive jobs

The scheduled workflows in `.github/workflows/` are deliberately independent:

- `agents-service-keepalive.yml` requests the deployed FastAPI service's public `/health` endpoint every seven minutes.
- `backend-keepalive.yml` requests the deployed Express backend's public `/health` endpoint every seven minutes.
- `mongodb-atlas-keepalive.yml` runs a MongoDB `ping` on the 1st and 15th of each month.
- `neo4j-keepalive.yml` runs the read-only Cypher query `RETURN 1` daily.

## Configuration

The service health workflows are ready to run and target the current Render deployments. Configure the optional database workflows as repository Actions secrets:

| Workflow | Required secrets | Optional secret |
| --- | --- | --- |
| MongoDB Atlas | `MONGODB_URI` | — |
| Neo4j | `NEO4J_URI`, `NEO4J_PASSWORD` | `NEO4J_USERNAME` (defaults to `neo4j`), `NEO4J_DATABASE` |

Without the required secrets, the corresponding workflow logs a successful skip. Use **Actions → workflow → Run workflow** after adding secrets to verify each database connection.

## Why no keep-alive collection?

Atlas treats a successful connection as activity. Its Free clusters pause only after 30 days without activity, so an authenticated admin `ping` is sufficient and avoids adding permanent application data. The backend remains the sole owner of MongoDB writes.

Neo4j AuraDB Free pauses after three days of inactivity. `RETURN 1` is a read-only database operation, so it provides the needed activity without touching the knowledge graph.

GitHub Actions scheduled workflows use standard five-field POSIX cron syntax and run from the repository's default branch. They can be delayed during periods of high GitHub load; use an external uptime monitor if an exact seven-minute execution guarantee is operationally required.
