# Environment Configuration

This guide explains the environment files and switches that affect service startup, authentication, streaming, external requests, and cost.

## Environment Files and Secrets

- `agents-service/.env.example`, `backend/.env.example`, and `frontend/.env.example` are committed templates. Keep credentials blank in these files; do not put real keys, passwords, JWT secrets, or database URIs in them.
- Copy the appropriate template to `.env` for local use and set private values there. `.env` files are ignored by Git.
- The variable names in `agents-service/.env` and `agents-service/.env.example` should stay in sync. Values may differ: the local file can contain developer credentials and local overrides, while the example contains only safe defaults/placeholders.
- Do not paste or commit `.env` contents into tickets, chat, logs, or example files.

## Python Agent Service

The template is `agents-service/.env.example`. Important variables:

| Variable                                                                                          | What it controls                                                     | Cost or behavior impact                                                                                             |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `LLM_PROVIDER`                                                                                    | Selects the primary Python agent provider; currently `ollama`         | LLM calls still occur in fixture mode; provider choice determines model cost                                        |
| `OLLAMA_MODEL`, `OLLAMA_BASE_URL`                                                                 | Local model and Ollama URL                                           | Local model calls do not use OpenAI API billing                                                                     |
| `FAST_LLM_BASE_URL`, `FAST_LLM_MODEL`, `FAST_LLM_API_KEY`                                        | Optional OpenAI-compatible fast model endpoint for selected agent calls | Calls routed to this endpoint may incur provider charges                                                         |
| `SERPAPI_ENABLED`                                                                                 | Enables or disables live SerpApi requests across Python search tools | `false` prevents those SerpApi requests and uses local fixture JSON instead                                         |
| `SERPAPI_API_KEY`                                                                                 | Credential for live SerpApi requests                                 | Required only when `SERPAPI_ENABLED=true`                                                                           |
| `SERPAPI_DUMMY_DATA_PATH`                                                                         | Provider-shaped fixture JSON used when SerpApi is disabled           | Defaults to `.data/serpapi_fixtures.json` relative to `agents-service/`                                               |
| `USE_DUMMY_STREAM`                                                                                | Selects the scripted SSE demo instead of the ordinary real graph     | `true` saves graph/LLM/search work for ordinary demo runs; structured interview-prep explicitly runs the real graph |
| `STREAM_RESPONSES`                                                                                | Enables token streaming where supported                              | Changes streaming behavior, not the selected agent/provider                                                         |
| `RESEARCH_CACHE_ENABLED`                                                                          | Enables local file cache for eligible research-provider results      | Cache hits avoid repeated live SerpApi calls; cache is bypassed in fixture mode                                     |
| `RESEARCH_CACHE_TTL_SECONDS`                                                                      | Lifetime of cached research responses                                | `0` means no expiry                                                                                                 |
| `MEMORY_PROVIDER`                                                                                 | `local`, `mem0`, or `mem0_oss` long-term memory backend              | Mem0 modes may call configured model/embedding services; local mode avoids hosted Mem0                              |
| `MEMORY_STORE_PATH`                                                                               | Optional persistence file for local memory                           | Empty means local in-process memory                                                                                 |
| `MEM0_API_KEY`, `MEM0_HOST`                                                                       | Hosted Mem0 Platform configuration                                   | Used only for `MEMORY_PROVIDER=mem0`                                                                                |
| `MEM0_DATA_DIR`, `MEM0_QDRANT_URL`, `MEM0_QDRANT_API_KEY`                                         | Self-hosted Mem0 storage configuration                               | Used only for `MEMORY_PROVIDER=mem0_oss`                                                                            |
| `OLLAMA_EMBED_MODEL`, `OPENAI_EMBED_MODEL`                                                        | Embedding models used by Mem0                                        | Choose a model supported by the selected embedding provider                                                         |
| `REDIS_URL`                                                                                       | Redis connection used by the SSE event publisher                     | Required for background SSE delivery/replay                                                                         |
| `JWT_SECRET`                                                                                      | Secret consumed by `src/core/auth.py` when `ENABLE_AUTH=true`        | Keep private; must match the backend signing secret when agent-service auth is enabled                              |
| `ENABLE_AUTH`                                                                                     | Enables JWT verification for agent-service endpoints                 | `true` requires a bearer token; `false` or unset bypasses auth in every environment                                 |
| `LOG_LEVEL`, `LOG_FILE`, `LOG_FILE_MAX_BYTES`                                                     | Logging verbosity and optional rotating file output                  | Set `LOG_FILE=` to disable file logging                                                                             |
| `RESEARCH_TIMEOUT_SECONDS`, `RESEARCH_SYNTHESIS_TIMEOUT_SECONDS`, `RESEARCH_TOOL_TIMEOUT_SECONDS` | Content Research workflow budgets                                    | Lower values limit work time; too-low values cause partial/failing research                                         |
| `KNOWLEDGE_GRAPH_PATH`                                                                            | Optional JSON persistence for the knowledge graph                    | Empty means in-process storage                                                                                      |

### `SERPAPI_ENABLED` vs `USE_DUMMY_STREAM`

These switches are separate:

- `SERPAPI_ENABLED=false` means the real LangGraph may still run, but every Python tool using the shared SerpApi client reads fixture JSON instead of calling SerpApi.
- `USE_DUMMY_STREAM=true` means an ordinary background chat request emits a scripted demo stream instead of running the full graph. It does not select fixture data. The interview-prep workflow forces real graph execution so its orchestration can be exercised.

Fixture mode does not disable LLM calls. It also does not disable YouTube transcript retrieval performed by Content Research when a fixture returns a video ID; that transcript client is separate from SerpApi. Mark fixture results as test data, not live evidence.

Fixture files may be a top-level engine map or use `{ "engines": { ... } }`. Engine names include `google`, `google_news`, `google_jobs`, `google_scholar`, `youtube`, `google_ai_overview`, and `google_flights`. Each engine can provide a `default` response and optional `by_query` fixtures. See [`agents-service/docs/serpapi_fixtures.example.json`](../../agents-service/docs/serpapi_fixtures.example.json) and [`agents-service/docs/serpapi_fixtures.pipeline.json`](../../agents-service/docs/serpapi_fixtures.pipeline.json).

## Node.js Backend

The template is `backend/.env.example`.

- `MONGODB_URI` is required and must point to the intended MongoDB database.
- `REDIS_URL` must point to the Redis instance shared with the Python event publisher.
- `AGENTS_SERVICE_URL` must point to the Python service, normally `http://localhost:8000` in local development.
- `PORT` controls the Express server port; the frontend's default API URL expects port `3000`.
- `FRONTEND_URL` must exactly match the deployed frontend origin (for example, `https://prep-amigo.vercel.app`). The backend allows credentialed CORS requests from this origin. Production session cookies use `SameSite=None; Secure` so browsers can send them from the separately hosted Vercel frontend to the Render API; local development uses `SameSite=Lax`.
- `JWT_SECRET` must be private and consistent with the secret used to sign backend sessions. In production, Node auth requires a valid token. The local development middleware accepts requests without a token only when `NODE_ENV` is not `production`.
- `GOOGLE_CLIENT_ID` is needed for Google sign-in. Leave optional provider keys blank when not using those providers.
- `SERPAPI_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `LLM_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL`, and `OPENAI_BASE_URL` control the Node-side Job Intelligence/LLM providers.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `ENABLE_DAILY_DIGEST`, and `DAILY_DIGEST_HOUR` configure the morning digest email. Email is off while `SMTP_HOST` is blank. See [EMAIL_NOTIFICATIONS_SETUP.md](EMAIL_NOTIFICATIONS_SETUP.md) for where to get credentials.

The backend starts MongoDB connection initialization in `src/index.ts` through `src/config/db.ts`. Planning models are registered through `src/models/index.ts` before the connection is used. MongoDB must be available before the backend can serve data-backed requests.

### Planning model references

- `User.plans` references `Plan` documents.
- `Plan.user_id` references its owner; `Plan.sprints` references `Sprint` documents.
- `Sprint.plan_id` references its parent plan; `Sprint.sprint_days` references `SprintDay` documents.
- `SprintDay.sprint_id` references its parent sprint. Learning references are embedded subdocuments without their own ObjectIds.

The backend waits for `connectDB()` to complete before opening its HTTP listener. The configured URI must identify an accessible MongoDB deployment and database; connection errors are logged and stop startup rather than leaving a server accepting database-dependent requests.

## Frontend

`frontend/.env.example` contains:

- `VITE_API_URL`: Node backend base URL, normally `http://localhost:3000`.
- `VITE_GOOGLE_CLIENT_ID`: Google OAuth client ID used by the frontend sign-in flow.

Vite exposes `VITE_*` variables to browser code. Never put private API keys or JWT signing secrets in frontend variables.

### Render backend build

Set the Render backend service root directory to `backend`, its build command to `npm run render:build`, and its start command to `npm start`. The Render-specific build command uses `npm ci --include=dev` so TypeScript and the Express ecosystem declaration packages are installed for compilation even when `NODE_ENV=production`; runtime start continues to use the compiled output.

## Local Service Checklist

1. Start MongoDB and Redis.
2. Configure private values in local `.env` files; use `SERPAPI_ENABLED=false` to run Python search tools from fixtures without SerpApi credits.
3. Start Python with `uv run uvicorn --app-dir src main:app --reload --port 8000` from `agents-service`.
4. Start Node with `npm run dev` from `backend`.
5. Start Vite with `npm run dev` from `frontend` and open `/app/interview-prep`.
6. For actual provider research, set `SERPAPI_ENABLED=true` and configure a valid SerpApi key. For fixture-based runs, remember that the LLM is still used to extract/synthesize responses.
