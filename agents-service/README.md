# TravelAmigo Agents

This folder contains the Python FastAPI service and its LangGraph agent runtime.

## Setup

```shell
cd agents-service
uv sync --dev
```

Create a `.env` file in this folder. The default local provider is Ollama:

```dotenv
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.1
OLLAMA_BASE_URL=http://localhost:11434
SERPAPI_API_KEY=your-serpapi-key
```

The value of `OLLAMA_MODEL` must match a model installed in your Ollama instance. Check available models with `ollama list`, install the documented default with `ollama pull llama3.1`, or set `OLLAMA_MODEL` to an existing model name.

`SERPAPI_API_KEY` powers the research tools. Without it they return labelled mock results.

For OpenAI, use `LLM_PROVIDER=openai` and provide `OPENAI_API_KEY` and `OPENAI_MODEL`.

`POST /internal/agent/execute` needs Redis (`REDIS_URL`, default `redis://localhost:6379`); run one locally with `redis-server` or `docker run -p 6379:6379 redis`. Set `USE_DUMMY_STREAM=false` to have it drive the real graph instead of the scripted demo used for frontend development.

## Run

```shell
uv run uvicorn --app-dir src main:app --reload
```

For the local interactive CLI, run `uv run python src/cli.py --user <your-id>`. The `--user` value keys long-term memory (default `demo-user`). The CLI streams the reply as it is generated and shows routing and research-step progress; `--no-stream` waits for the full reply instead. The default comes from `STREAM_RESPONSES` (on unless set to `false`).

The service exposes:

- `GET /health` for liveness information.
- `POST /api/chat` for agent requests; waits for the full reply and returns it as JSON. Good for scripts/tests; no step-by-step progress.
- `POST /internal/agent/execute` — the decoupled trigger for the Redis-backed SSE pipeline (`docs/SSE_STREAMING_GUIDE.md` at the repo root): accepts `{runId, query, thread_id?, user_id?}`, starts the turn in a background task, and returns `{"status": "accepted", "runId": ...}` immediately. Progress and the final reply are published to Redis on `agent:events:{runId}` for the Node.js gateway to relay over SSE to the frontend.

Example request:

```json
{
  "message": "I am weak in dynamic programming. How should I start?",
  "thread_id": "demo-1",
  "user_id": "subhaan"
}
```

`thread_id` keeps short-term conversation context. `user_id` is optional and turns on long-term memory: each turn recalls that user's relevant memories and saves the new message, and mem0 decides which facts to keep. Memories persist across threads and restarts when `MEMORY_PROVIDER=mem0`. Without `user_id`, the turn neither reads nor writes memory.

Each chat turn runs `load_memory` and `supervisor` in parallel, then one specialist (`chat`, `research`, or `company_research`), then `save_memory`. The save happens in the background, so it doesn't delay the reply. Agents see the last 20 messages of the thread, and older context comes from long-term memory. To add a simple (one node, then done) agent, register it in `src/agents/registry.py` with a factory; the supervisor prompt and routing edges are generated from that registry, and it shows up correctly on both `/api/chat` and the SSE pipeline without touching either. An agent that needs a tool-calling loop instead — `company_research` is the example — registers with `factory=None` (so it's still in the supervisor prompt and `SPECIALIST_NAMES`) and gets its extra nodes/edges wired explicitly in `src/graph/builder.py`, ending at `save_memory` like every other specialist.

Every specialist also appends a compact `AgentHandoff` (`src/graph/state.py`) to `state["handoffs"]` — `{agent, kind, summary, data}`, where `data` is small and structured (ids, urls, counts), not the full reply. That's the state-based handover contract: a downstream node or agent later in the turn reads a previous agent's structured output from `handoffs` instead of re-parsing its chat message. It's reset each turn like `execution_events`. Today every turn is single-hop (one specialist runs, then the turn ends), so `handoffs` mostly documents intent for now — but any new agent gets it for free by subclassing `BaseAgent`, or (for a fixed-pipeline agent like research) building one the same shape. `company_research` doesn't emit one yet (it predates the contract and overrides `__call__` directly).

Requests for learning resources (for example "find me resources to learn dynamic programming for Google") go to the Content Research Agent, described below. A company name alongside interview prep (for example "research Datadog for a backend interview") goes to the Company Research Agent (`src/agents/company_research_agent.py`); test it standalone with `uv run python src/cli.py --company "Datadog"`. The flight-search agent is kept in `src/agents/flight_booking_agent.py` but is not wired into the graph.

Conversation checkpoints currently use process-local memory. They are suitable for local development only and are lost on restart; use a shared LangGraph checkpointer before deploying multiple workers. The same is true of the user knowledge graph's JSON file.

### Streaming internals

Two layers, for two different jobs:

- `src/graph/streaming.py` (`stream_turn`) runs one graph turn and yields normalized `route` / `step` / `token` / `final` items. It's what the CLI uses directly for its live token-by-token output (`--stream`, on by default; see `STREAM_RESPONSES`).
- `src/streaming/langgraph_bridge.py` (`bridge_graph_turn`) wraps `stream_turn` (with `tokens=False` — token-level events aren't part of the Redis contract) and maps its items onto the `EventType` taxonomy in `src/streaming/models.py`, so `/internal/agent/execute` → `streaming/runner.py::execute_agent_stream` can publish them to Redis. A step's event type is chosen from keywords in its name (`search`/`fetch` → `researching`, `synthesize` → `structuring`, ...; see `_STEP_KEYWORDS`), so a new agent's steps are mapped reasonably without editing the bridge.

Note: this only sees progress an agent explicitly reports via `graph.events.AgentEvent` (research does; `company_research` doesn't, since its ToolNode/guardrail loop predates that convention) — a company-research turn currently shows only `calling_agent` then `completed` on the wire, with no progress events while its tool loop runs. Making `stream_turn` also emit a generic step for any intermediate node (not just `AgentEvent`-emitting ones) would fix this for `company_research` and any future tool-calling agent; flagged here as a follow-up, not yet done.

Both read the same `graph.events.AgentEvent` stream (`{"agent", "step", "status", "payload", "timestamp"}`) that any agent emits; neither knows agent names ahead of time.

Every step and tool call is timed (`src/observability/timing.py`); a step's `completed`/`failed` event payload carries `duration_ms`, and `configure_logging()` (called once at process start in `main.py`/`cli.py`, level from `LOG_LEVEL`) makes those same numbers show up as structured `key=value` log lines — both on the console and in `LOG_FILE` (default `.data/logs/agents-service.log`, rotated at `LOG_FILE_MAX_BYTES`; gitignored). `tail -f .data/logs/agents-service.log` while testing to watch step/tool timings without terminal scrollback. Set `LOG_FILE=` (empty) for console-only output.

## Content Research Agent

`src/agents/research_agent.py` turns one skill gap into a curated learning module:

1. `fetch_user_context`: long-term memory only (not the knowledge graph — see below).
2. `identify_curation_scope`: depth (`foundational`, `intermediate`, `advanced`, `revision`) from an explicit `depth_hint` (parsed from the conversation by `research_node.py`, e.g. "I'm proficient in X" → `advanced`), defaulting to `foundational`.
3. `execute_searches`: docs, books, papers (Google Scholar, intermediate/advanced depth only) and YouTube, all in parallel, then transcripts for the top videos, also in parallel.
4. `synthesize_learning_module`: the LLM writes the explanation, examples and exercises. Curated links come only from tool results, never invented.

Steps 1–3 (the actual tool orchestration) share one clock: `RESEARCH_TIMEOUT_SECONDS` (default 30s). Step 4 has its own, larger budget (`RESEARCH_SYNTHESIS_TIMEOUT_SECONDS`, default 45s), because that time is set by the LLM's generation speed, not by how well the tools are orchestrated — charging both to one clock would let a slow model either eat the tool budget or get blamed on "research". A run that exceeds its step's budget fails that step with a clear `... exceeded its Xs budget` message; other skill gaps in the same turn are unaffected.

Each step emits `{"agent", "step", "status": "running|completed|failed", "payload", "timestamp"}` (see `src/graph/events.py`); `completed`/`failed` payloads include `duration_ms`, and `execute_searches`'s also includes `tool_timings_ms` per tool call. Consume events with `agent.astream(request)`, an `on_event` callback on `agent.run(...)`, or `graph.astream(..., stream_mode="custom")` when the agent is a graph node.

The module is a reference sheet, not a chat message: every section is a list (Overview is one sentence), grouped by resource type (Articles & Documentation / Books / Papers / Videos & Playlists / Practice / Study Plan), no code blocks and no narrated explanation or advice — see `RESEARCH_AGENT_PROMPT` in `src/prompts/research_prompts.py`. The chat reply is that markdown as-is (plus a one-line mock-mode notice when it applies) — nothing appended after it: the module's own resource sections already cite every source, so a second, appended list would just be unread duplicate text.

Resources fed to the synthesis prompt are grouped by type and each snippet is capped at `PROMPT_SNIPPET_CHARS` (220 chars); a transcript excerpt is capped at `TRANSCRIPT_EXCERPT_CHARS` (1500 chars). None of a cached SerpApi response's `search_metadata`/`pagination`/`ai_overview` noise reaches the LLM — only title/url/snippet per result ever leaves `tools/research_tools.py`; the full raw response is cache-file-only, for your own inspection. Results from a fixed list of social platforms (`facebook.com`, `linkedin.com`, `twitter.com`/`x.com`, `instagram.com`, `pinterest.com`, `tiktok.com`, `reddit.com`) are dropped before they become a Resource — Google ranks these alongside real documentation, and they were showing up as junk "curated resources". Note: `search_books` is a plain Google search framed as "best books to learn X", not a dedicated books database — SerpApi's `google` engine rejects `tbm=bks` (confirmed live: `Unsupported "bks" tbm parameter`), and SerpApi has no dedicated Google Books engine.

**Not connected to the user knowledge graph.** `src/graph/knowledge_graph.py` (schema, proficiency tracking, prerequisite gaps — all still in place and tested) is reserved for the skill-gap/assessment agents; the research agent no longer reads or writes it. `state["knowledge_graph_snapshot"]` stays in `AgentState` for whichever agent picks that up.

### Research tool cache

Every live SerpApi call and YouTube transcript fetch goes through `src/tools/cache.py` first — a generic, namespace-keyed, file-based cache (not SerpApi-specific; any tool's response can use it). A hit skips the network call entirely. Each entry is one pretty-printed JSON file under `RESEARCH_CACHE_DIR` (default `.data/research_cache/<namespace>/<hash>.json`), so it's inspectable and doubles as an offline fixture: run once against the live API, then iterate without spending SerpApi credits. Configure with `RESEARCH_CACHE_ENABLED` (default on), `RESEARCH_CACHE_DIR`, `RESEARCH_CACHE_TTL_SECONDS` (default 7 days; `0` never expires).

Research tools use `SERPAPI_API_KEY`. Without it they return results labelled `"source": "mock"` that link to real search pages.

Long-term memory is chosen by `MEMORY_PROVIDER`:

- `local` (default): an in-process store, optionally persisted to `MEMORY_STORE_PATH`. Search is keyword-based.
- `mem0`: the hosted [mem0 Platform](https://app.mem0.ai). Set `MEM0_API_KEY`. mem0 runs the LLM, embeddings and vector store, so nothing extra is installed or hosted. The Platform extracts memories in the background, so a new memory can take a few seconds to show up in search.
- `mem0_oss`: the self-hosted mem0 engine, using the configured LLM provider. Install an embedding model first (`ollama pull nomic-embed-text` for Ollama). Vectors and history are stored under `MEM0_DATA_DIR` unless `MEM0_QDRANT_URL` is set.

If a mem0 mode cannot start (missing or rejected key, unreachable model), the service logs a warning and uses `local`.

## Tests

```shell
uv run pytest
```
