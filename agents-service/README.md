# PrepAmigo Agents

This folder contains the Python FastAPI service and its LangGraph agent runtime.

## Setup

```shell
cd agents-service
uv sync --dev
```

Create a `.env` file in this folder (copy from `.env.example`). The supported primary provider is Ollama:

```dotenv
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.1
OLLAMA_BASE_URL=http://localhost:11434
SERPAPI_API_KEY=your-serpapi-key
```

The value of `OLLAMA_MODEL` must match a model installed in your Ollama instance. Check available models with `ollama list`, install the documented default with `ollama pull llama3.1`, or set `OLLAMA_MODEL` to an existing model name.

`SERPAPI_API_KEY` powers live search. Set `SERPAPI_ENABLED=false` to disable live SerpApi calls across Company Research, Job Intelligence, Content Research, and Interview Intelligence. Tools then read provider-shaped engine responses from `SERPAPI_DUMMY_DATA_PATH` (defaults to `serpapi_fixtures.example.json`); missing engines fall back to empty built-in fixtures. `USE_DUMMY_STREAM` is separate (defaults to `false` = runs real agents; set `true` only for scripted dummy SSE UI testing).

Optional fast tier: configure `FAST_LLM_BASE_URL`, `FAST_LLM_MODEL`, and `FAST_LLM_API_KEY` to route small, latency-sensitive calls to any OpenAI-compatible provider (e.g. Groq).

`POST /internal/agent/execute` and `GET /api/agent/stream/{run_id}` need Redis (`REDIS_URL`, default `redis://localhost:6379`); run one with Docker: `docker run -d --name redis -p 6379:6379 redis:alpine`.

## Run

```shell
uv run uvicorn --app-dir src main:app --reload
```

For the local interactive CLI:
```shell
# Full multi-agent interactive REPL with live streaming
uv run python src/scripts/cli.py --user <your-id>

# Run full interview-prep pipeline test with live terminal SSE telemetry
uv run python src/scripts/cli.py --prep --company "Stripe" --role "Backend Engineer"
```

The service exposes:

- `GET /health` for liveness information.
- `GET /api/agent/stream/{run_id}` — direct Server-Sent Events (SSE) stream for client frontend connection (no Node.js relay required). Replays event history and streams live events with 15s keep-alive pings and 35s silence watchdog.
- `POST /api/chat` for agent requests; waits for the full reply and returns it as JSON. Good for scripts/tests; no step-by-step progress.
- `POST /internal/agent/execute` — the decoupled trigger for the Redis-backed SSE pipeline: accepts `{runId, query, thread_id?, user_id?}` for chat, or `workflow_mode: "interview_prep"` with `workflow_input` for structured orchestration.
- `POST /api/agents/job-intelligence` and `/raw-search` — job search and intelligence extraction endpoints.
- `POST /api/agents/skill-gap` — resume parsing and skill gap evaluation endpoint.

Example request:

```json
{
  "message": "I am weak in dynamic programming. How should I start?",
  "thread_id": "demo-1",
  "user_id": "subhaan"
}
```

`thread_id` keeps short-term conversation context. `user_id` is optional and turns on long-term memory: each turn recalls that user's relevant memories and saves the new message, and mem0 decides which facts to keep. Memories persist across threads and restarts when `MEMORY_PROVIDER=mem0`. Without `user_id`, the turn neither reads nor writes memory.

Each chat turn runs `load_memory` and `supervisor` in parallel, then a specialist, then `save_memory`. `interview_prep` is a bounded multi-node workflow: it validates company, role, and location, runs Company Research and Job Intelligence concurrently into separate result fields, and joins them through one ReAct evaluator. If required inputs are missing or the evaluator detects a genuine ambiguity, LangGraph pauses with a clarification; the same `thread_id` resumes from the checkpoint, preserves supplied context, and re-runs both branches. Clarification is capped at three rounds. Agent failures return partial data when possible; the evaluator never automatically retries an agent. Intermediate profiles stay in the checkpoint/task context and are not independently added to Mem0. The save happens in the background, so it doesn't delay the reply. Agents see the last 20 messages of the thread, and older context comes from user-scoped long-term memory.

The authenticated Node.js gateway exposes `POST /api/agent/interview-prep` with optional `{company, role, location, idempotencyKey}` fields and `POST /api/agent/interview-prep/resume` with `{threadId, company?, role?, location?, answer?, idempotencyKey}`. Both return `{success, runId, threadId}` with HTTP 202; each request needs a fresh idempotency key, and replaying the same key returns the original run without starting duplicate work. Consume progress/results from `GET /api/agent/stream/:runId`. A `waiting` event contains the clarification question and ends that run's stream; submit the answer to the resume route to start a new run on the same checkpoint thread. Terminal `completed` events include `status: "complete"` or `"partial"` and both agent results; `failed` contains a safe user-facing detail. Chat requests that the supervisor routes to `interview_prep` use the same checkpoint pause/resume flow, with the next message on that thread treated as the clarification.

The frontend test surface is `/app/interview-prep`. It exercises the structured start/resume flow, including blank-field clarification, streamed progress, and the two result profiles. Its fields are loaded from `/api/agent/interview-prep/fields`. The field schema and recipient routing live in `src/agents/interview_prep_fields.py`; that definition drives extraction, clarification, UI inputs, and per-agent payloads. Add a field there and configure its recipient agent to interpret it. The legacy Python `/api/agents/job-intelligence` route remains a compatibility adapter; the existing Express/TypeScript endpoint is unchanged.

To add a simple (one node, then done) agent, register it in `src/agents/registry.py` with a factory; the supervisor prompt and routing edges are generated from that registry. An agent that needs a tool-calling loop instead — `company_research` is the example — registers with `factory=None` (so it's still in the supervisor prompt and `SPECIALIST_NAMES`) and gets its extra nodes/edges wired explicitly in `src/graph/builder.py`, ending at `save_memory` like every other specialist.

Every specialist also appends a compact `AgentHandoff` (`src/graph/state.py`) to `state["handoffs"]` — `{agent, kind, summary, data}`, where `data` is small and structured (ids, urls, counts), not the full reply. That's the state-based handover contract: a downstream node or agent later in the turn reads a previous agent's structured output from `handoffs` instead of re-parsing its chat message. It's reset each turn like `execution_events`. Today every turn is single-hop (one specialist runs, then the turn ends), so `handoffs` mostly documents intent for now — but any new agent gets it for free by subclassing `BaseAgent`, or (for a fixed-pipeline agent like research) building one the same shape. `company_research` doesn't emit one yet (it predates the contract and overrides `__call__` directly).

Requests for learning resources (for example "find me resources to learn dynamic programming for Google") go to the Content Research Agent, described below. A request for both company context and current role-market signals (for example "prepare me for a backend interview at Datadog in Seattle") goes to the parallel Interview Prep Orchestrator. A general company-dossier request goes to Company Research (`src/agents/company_research_agent.py`); test it standalone with `uv run python src/scripts/cli.py --company "Datadog"`. The deprecated flight-search agent is archived under `src/agents/_archived/`.

Requests about a company's specific interview rounds, role-based question patterns, candidate experiences, or reported hiring-process changes go to `src/agents/interview_intelligence_node.py`. It runs Google Search, Google Related Questions, Google News, and YouTube searches concurrently; immediately follows a fresh Search result token with Google AI Overview when available; fetches available transcripts for top matching videos; then synthesizes one source-linked brief. Candidate reports are treated as anecdotes, AI Overview claims are checked against references, and missing sources are reported as coverage gaps. Only the final `completed` SSE event carries the Markdown report, in its `message` field.

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

### Job requirements come from the company's own postings

A job search for "<company> <role>" also returns other employers' adverts that rank for those words. Job intelligence keeps only postings whose employer is the target company. If there are none, the others are discarded, not shown to the model even as background: used as requirements they made a Google SDE plan out of one consultancy's WebSphere and Axway stack, and as "background" they still turned it into Agile, Git and CI/CD. The requirements then come from what is known about the company and the role plus the company research brief (which is why direct company research always runs before job intelligence), core competencies first, and the profile is marked `isFallback`. Extraction runs at temperature 0 so the same company and role give the same skills.

### Compact research write-ups

Inside `interview_prep` a module is a short note: Overview, Key Concepts, Practice (`RESEARCH_COMPACT_MAX_OUTPUT_TOKENS`, ~350 tokens). The model returns it as JSON and `note_markdown` lays it out, so the sections and their order never depend on the model. No transcript is fetched for it. The plan takes its links from the search results and its schedule from the planner, so the full reference sheet (every link re-listed, plus a study plan) is only written for a chat reply. A gap the candidate partly has (skill-gap status `partial`) is researched at intermediate depth and planned past the beginner basics.

In the plan, each reference goes on the day whose subject it covers (`plan_builder.place_references`); general ones fill the emptiest days from the start of the topic, and days nothing was written about (usually the closing practice and review days) have none.

### What counts as a resource

- **Books** come from Open Library (`BOOKS_SOURCE=catalogue`; free, no key), and only established ones: at least `BOOK_MIN_EDITIONS` editions or `BOOK_MIN_READERS` readers who shelved it. A catalogue lists everything ever registered, so a new tool with no real book yet gets no book. **Papers** come from arXiv (`PAPERS_SOURCE=arxiv`), matched as a phrase, and must mention the whole topic. Neither uses a SerpApi credit; a topic costs two credits (docs, videos).
- `COMPANY_MODULE=on` adds one module on the target company's own platform, searched on its official site and GitHub (both taken from the company profile) plus arXiv for its research, and puts it first in the plan.
- All text in a plan is sanitized (`tools/text_sanitize.py`): emoji, invisible and control characters removed, typographic punctuation and odd spaces converted to plain ASCII, letters of any language kept, URLs never altered.
- Results that are job adverts or sales pages are dropped whatever their topic match (`tools/relevance.not_learning_material`), and the docs query excludes them at the source (`-jobs -vacancy -careers -pricing`).
- `RESEARCH_JUDGE_LLM=fast|default` adds one small model call per topic that rejects what word matching cannot: a consultancy page titled exactly like the topic, a news clip, a homonym. Off by default. If the call fails or rejects everything, nothing is dropped.
- A write-up must contain a `## Overview` section. Planning notes instead of a module are retried once, then that topic is reported as unresearched rather than stored.
- The plan places at most `PLAN_MAX_BOOKS` book and `PLAN_MAX_PAPERS` paper references (default 2 each), one per topic on its first day. The resource pack keeps all of them.

### Caching

Two caches share one store (`src/tools/cache.py`, entries under `RESEARCH_CACHE_DIR`, default `.data/research_cache/<namespace>/<hash>.json`, readable JSON):

| Layer | Where | Covers | Key | TTL |
|---|---|---|---|---|
| API responses | `tools/serpapi_client.serpapi_search` (the one SerpApi boundary) | every agent's SerpApi calls: company research, job intelligence, content research | exact request params | news/jobs `SERPAPI_FRESH_CACHE_TTL_SECONDS` (1 day), everything else `RESEARCH_CACHE_TTL_SECONDS` (7 days) |
| Transcripts | `tools/research_tools.fetch_youtube_transcript` | YouTube transcripts | video id | never expires |
| LLM responses | `storage/llm_cache.py`, attached to every model by `config.get_llm` | every agent's model calls | provider + model + temperature + token cap + reasoning flag + tool bindings + full prompt | `LLM_CACHE_TTL_SECONDS` (7 days) |

- A repeated run with unchanged inputs makes no SerpApi calls and no model calls. When an input changes (a different resume or role, a fresh news result), only the steps whose prompts change go back to the model.
- Not cached: SerpApi errors, `no_cache` calls (the short-lived AI Overview token), empty model replies, and model answers a caller rejected. The planner, skill gap, job intelligence and evaluator call `forget_response` when they can't parse an answer, so a bad answer isn't replayed for a week.
- Every entry stores how long the original call took (`latency_ms`). A hit returns in milliseconds, and the run metrics report it as a hit with that original time as "saved".
- To bypass for one run: `--no-cache` on the CLI (nothing is read from or written to any cache), or the settings `RESEARCH_CACHE_ENABLED=false` (both layers) and `LLM_CACHE_ENABLED=false` (model calls only). To clear: delete the directory (or just `llm/`).

**Moving to Redis (planned, not implemented).** Only the storage layer changes: `ResponseCache` talks to a `CacheBackend` with three methods (`read`, `write`, `delete`), and `FileCacheBackend` is the only one today. A `RedisCacheBackend` would:

1. Use the existing `REDIS_URL` connection (the SSE publisher already depends on Redis), with key `prepamigo:cache:<namespace>:<hash>` and the same JSON entry as the value.
2. `write` with `SET key value EX <ttl>`, so Redis expires entries itself (`0` → no `EX`). `read`/`delete` map to `GET`/`DEL`.
3. Be selected by a `CACHE_BACKEND=file|redis` setting in `get_response_cache()`.
4. Fall back to a miss on any Redis error, so the cache is never a hard dependency.

Because the cache is shared, all API workers then reuse each other's SerpApi and LLM results. The file backend stays the default for local development, where the JSON files double as offline fixtures. For `ResponseCache`, its callers and the metrics, nothing changes.

### Company research modes and the fast model

`COMPANY_RESEARCH_MODE` picks how `interview_prep` researches the company:

- `agent` (default): the tool-calling loop. The model picks each search, one per turn, then writes a dossier: 3-4 model calls that each resend the growing conversation.
- `direct` (`src/agents/company_brief.py`): both searches run at once, then one small model call writes a structured brief (summary, products, tech stack, engineering focus, recent developments). The evidence in the prompt and the answer are both capped, so a run costs roughly 2-3k tokens. The brief's stack and focus are added to the skill-gap, research and planner prompts. If the model call fails or is rate limited, the search-based profile is used without a brief.

`COMPANY_RESEARCH_LLM=fast` sends that one call to the `FAST_LLM_*` model, any OpenAI-compatible endpoint (for Groq: `FAST_LLM_BASE_URL=https://api.groq.com/openai/v1`). With `FAST_LLM_*` unset, or `COMPANY_RESEARCH_LLM=default`, the main model is used. The chat-mode company research agent is unchanged in both modes.

### Per-agent models

Each agent can use a different model, set in `.env`:

| Agent | Settings | Notes |
|---|---|---|
| Planner | `PLANNER_LLM=default\|fast`, `PLANNER_MODEL=<model>` | Short JSON per chunk, so a small quick model suits it. With `fast`, chunks run `FAST_LLM_MAX_CONCURRENCY` at a time; otherwise `LLM_MAX_CONCURRENCY` (1 on Ollama by default). |
| Job intelligence | `JOB_INTELLIGENCE_LLM`, `JOB_INTELLIGENCE_MODEL` | One extraction call, ~1.6k tokens. |
| Skill gap | `SKILL_GAP_LLM` | `fast` sends the resume text to that provider. |
| Company brief | `COMPANY_RESEARCH_LLM` | Needs `COMPANY_RESEARCH_MODE=direct`. |
| Research write-ups | `RESEARCH_MODEL=<model>` | Main provider only: ~14k tokens a run. |
| Result check, search scope, evaluator | `RESEARCH_JUDGE_LLM`, `RESEARCH_SCOPE_LLM`, `EVALUATOR_LLM` | `off` skips the call. |

`*_LLM=fast` uses the `FAST_LLM_*` endpoint; `*_MODEL` names another model on the main provider and is ignored when `*_LLM=fast`.

### Run metrics

`--prep` ends with a per-agent table (`src/observability/metrics.py`). API runs write the same data to the log as `Run <id> metrics {...}`.

- Wall, LLM and Tools time per agent. LLM and Tools count the time at least one call was in flight, so parallel calls are counted once. Other is the remainder: parsing, memory writes, and waiting for an LLM slot.
- LLM calls, input and output tokens actually spent (cache hits excluded), and peak context (the largest single prompt).
- API calls, the slowest live call, and the time saved by cache hits. `(Nc)` means N of the calls were served from the cache.
- The three slowest calls of the run.

LLM calls are recorded by a callback on every model from `get_llm`. API calls are recorded by `cached_fetch` and `track_tool`, and each one is attributed to the agent whose `agent_scope` it ran in.

Research tools use `SERPAPI_API_KEY`. Without it they return results labelled `"source": "mock"` that link to real search pages.

Long-term memory is chosen by `MEMORY_PROVIDER`:

- `local` (default): an in-process store, optionally persisted to `MEMORY_STORE_PATH`. Search is keyword-based.
- `mem0`: the hosted [mem0 Platform](https://app.mem0.ai). Set `MEM0_API_KEY`. mem0 runs the LLM, embeddings and vector store, so nothing extra is installed or hosted. The Platform extracts memories in the background, so a new memory can take a few seconds to show up in search.
- `mem0_oss`: the self-hosted mem0 engine, using the configured LLM provider. Install an embedding model first (`ollama pull nomic-embed-text` for Ollama). Vectors and history are stored under `MEM0_DATA_DIR` unless `MEM0_QDRANT_URL` is set.

If a mem0 mode cannot start (missing or rejected key, unreachable model), the service logs a warning and uses `local`.

## Planner Agent (study plan JSON)

The last stage of `interview_prep` (`src/agents/planner_agent.py`) turns the skill-gap report and research modules into a plan in the backend's own `plan → sprints → sprint_days` shape.

**Plan length and scaling.** A plan is `PLAN_TOTAL_DAYS` long (default 45), or whatever a run asks for (`--days` on the CLI, `plan_days` on `/internal/agent/execute`). The days are split across skill gaps by priority (a missing skill gets twice a partial one), and each gap's days are cut into sprints of at most `PLAN_SPRINT_MAX_DAYS`. Plan length never multiplies the expensive work:

- The plan goes deep rather than wide: at most `PLAN_MAX_TOPICS` gaps (default 6, highest priority first), and never more than fit with `PLAN_MIN_DAYS_PER_TOPIC` days each (default 3). The rest are listed under `coverage.not_scheduled`.
- Research stays one module per gap, for at most `RESEARCH_MAX_GAPS` gaps (highest priority first). A long gap reuses its module's resources across its days. Gaps past the cap are still planned, without references.
- Day wording comes from small LLM calls: one per chunk of up to `PLANNER_DAYS_PER_CALL` days of one topic. Each prompt holds only that topic's concepts plus the titles already planned for it. A failed chunk falls back on its own.
- Stages that fan out (research write-ups, planner chunks, company+job) run up to `LLM_MAX_CONCURRENCY` calls at once: 1 by default on Ollama, where parallel requests measured no faster.

**Where it's saved:** every run writes `agents-service/.data/plans/<plan id>.json` (`PLAN_OUTPUT_DIR`; gitignored, resolved against `agents-service/` regardless of where you run from). The CLI's `--prep` output prints the path. The same dict is in `state["study_plan"]` and `task_context["preparation_plan"]`. File layout:

- `plan`: the backend contract (`src/schemas/study_plan.py`, mirroring the Zod schemas in `backend/src/utils/planApi.ts` and parser_agent's `CompletePlan`). The backend creates it through three strict endpoints (`POST /plans`, `/plans/:id/sprints`, `/sprints/:id/days`), so the caller posts each level's own fields; ids, `user_id`, `status` and completion are set server-side.
- `resource_pack`: all curated resources grouped by type, deduped.
- `learning_modules`: each research module's markdown.
- `coverage`: days per topic; which gaps were researched (a gap whose research failed or was past the cap is still planned, with no references); `not_scheduled` lists gaps left out because the plan had fewer days than gaps.
- `narrative_source`: `llm`, `partial` or `fallback`, i.e. whose wording the days use.

**Reliability.** The LLM never produces the plan's structure. Sprint/day counts, dates, day numbering and references are computed in code, and the result is validated against `StudyPlan`, which checks the backend's field limits *and* the arithmetic (totals, date ranges, contiguous day numbers) that LLM-written JSON gets wrong while still passing type checks. The model only writes each day's title and objectives, grounded in the module's Key Concepts. That text is parsed per topic, and anything unusable falls back to concept-based wording for that topic alone. Swapping `OLLAMA_MODEL` can change the wording, never the shape. Ollama's schema-constrained output mode isn't relied on: on `nemotron-3-nano:30b-cloud` it was ignored outright.

**Code layout.** `src/tools/plan_builder.py` is the deterministic plan builder: topic selection, day allocation, fallback wording, sprint/date assembly and validation, with no LLM and no I/O. `src/agents/planner_agent.py` only asks the model for day wording and hands it to the builder, and the orchestrator saves the result (`src/storage/json_store.py`).

**Model speed.** Thinking models write a hidden reasoning trace before every answer. `OLLAMA_REASONING=false` (default) turns it off; on the research synthesis prompt that measured 12.9s / 4,005 tokens with it vs 3.4s / 938 without, with an equal or longer visible answer.

## Tests

```shell
uv run pytest
```
