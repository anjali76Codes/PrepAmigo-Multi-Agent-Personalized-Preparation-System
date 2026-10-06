# PrepAmigo Agent Service — Maintenance & Operations Guide

> **Location:** `agents-service/MAINTENANCE.md`  
> **Service:** Python FastAPI + LangGraph Multi-Agent Runtime  
> **Python Version:** 3.11+  
> **Package Manager:** `uv` / `pip`  

---

## 1. Architecture Overview & Core Guarantees

The **`agents-service`** is the multi-agent orchestration engine of PrepAmigo. It executes specialized AI agents (Company Research, Job Intelligence, Skill Gap Analysis, Content Research, and Study Plan Generation) and streams step-by-step telemetry over Redis to the Express backend and React frontend.

### Core Architectural Guarantees
1. **100% Stateless & Database-Free**: The service maintains **no direct connection to MongoDB**. All persistence is handled by the Express backend gateway by listening to the Redis SSE stream. This eliminates connection pooling issues, schema divergence, and unauthenticated database writes.
2. **Deterministic Plan Construction**: The LLM **never produces raw plan JSON or schedule structure**. Structural calculations (day counts, sprint boundaries, dates, and resource references) are computed deterministically in [`tools/plan_builder.py`](file:///C:/project/PrepAmigo-Multi-Agent-Personalized-Preparation-System/agents-service/src/tools/plan_builder.py) and validated against [`schemas/study_plan.py`](file:///C:/project/PrepAmigo-Multi-Agent-Personalized-Preparation-System/agents-service/src/schemas/study_plan.py). The LLM is only queried for day titles and objective descriptions in bounded chunks.
3. **Bounded & Non-Blocking Execution**: Every agent branch, tool call, and LLM invocation has an explicit timeout and token cap. Parallel branches (Company Research and Job Intelligence) run with controlled concurrency.
4. **SSE Event Streaming Over Redis**: Every state transition and tool step emits structured `AgentEvent` envelopes to Redis (`agent:events:{runId}` pub/sub channel and `agent:history:{runId}` list for replay).

---

## 2. Directory Structure

```
agents-service/
├── docs/                      # Service guides and SerpApi fixtures
├── src/
│   ├── agents/                # Specialist agent implementations
│   │   ├── company_research_agent.py
│   │   ├── job_intelligence_agent.py
│   │   ├── skill_gap_agent.py
│   │   ├── research_agent.py
│   │   ├── planner_agent.py
│   │   ├── interview_prep_orchestrator.py  # LangGraph interview prep graph
│   │   ├── registry.py                     # Agent registry & supervisor routing
│   │   └── supervisor.py                   # Supervisor routing node
│   ├── core/                  # Core infrastructure (config, auth, LLM client)
│   │   ├── auth.py            # JWT verification & dev bypass
│   │   └── config.py          # Unified settings & model factory
│   ├── graph/                 # LangGraph assembly & shared state
│   │   ├── builder.py         # StateGraph assembly
│   │   ├── state.py           # AgentState definition
│   │   └── streaming.py       # Graph stream runner
│   ├── guardrails/            # Input/output safety validators
│   ├── memory/                # Mem0 long-term memory integration
│   ├── observability/         # Structured timing, logging & metrics
│   ├── routers/               # FastAPI route controllers
│   │   ├── job_intelligence_router.py
│   │   ├── skill_gap_router.py
│   │   └── stream_router.py   # Direct SSE endpoint
│   ├── schemas/               # Pydantic data contracts (StudyPlan, etc.)
│   ├── scripts/               # Developer CLIs (cli.py, parser_agent.py)
│   ├── storage/               # Local JSON store & LLM disk cache
│   ├── streaming/             # Redis publisher & LangGraph bridge
│   │   ├── langgraph_bridge.py
│   │   ├── models.py          # EventType taxonomy
│   │   ├── publisher.py       # Redis publisher
│   │   └── runner.py          # Asynchronous stream runner
│   ├── tools/                 # Deterministic utilities & search tools
│   │   ├── duration.py        # Natural-language plan duration extractor
│   │   ├── plan_builder.py    # Deterministic study plan assembler
│   │   └── serpapi_client.py  # Live & mock search client
│   └── main.py                # FastAPI entry point & lifespans
├── tests/                     # 417+ pytest test suite
├── pyproject.toml             # Project dependencies
└── requirements.txt
```

## 3. Deep-Dive: What Does What Inside agents-service

### 3.1. Specialist Agents (`src/agents/`)

| Agent / File | Primary Responsibility | Inputs | Outputs / Side Effects |
| :--- | :--- | :--- | :--- |
| **`supervisor.py`** | Natural-language intent classifier & router. Determines whether a general prompt routes to chat or starts an interview prep workflow. | `messages` list | `next_agent: str` in `AgentState`. |
| **`interview_prep_orchestrator.py`** | Central LangGraph coordinator for the 5-stage preparation pipeline. Validates required inputs (`company`, `role`, `location`), handles ReAct clarification pauses, executes parallel branches, and joins results. | `interview_prep_input`, `workflow_text_input` | Coordinates execution across Company, Job, Skill Gap, Research, and Planner agents. |
| **`company_research_agent.py`** & **`company_research_node.py`** | Gathers company engineering culture, tech stack, business overview, and recent news. Uses tool-calling loop with guardrails. | Company name, location | `company_profile` dict (`overview`, `culture`, `tech_stack`, `news`) in state. |
| **`job_intelligence_agent.py`** | Analyzes live market job postings via Google Jobs / LinkedIn tools. Extracts required skills, nice-to-have skills, role seniority, and domain requirements. | Role title, location, company | `job_intelligence` dict (`role`, `skills_required`, `skills_preferred`) in state. |
| **`skill_gap_agent.py`** | Compares candidate's resume text against target job requirements. Categorizes every skill into High effort (missing), Medium effort (partial), or Met, citing candidate evidence. | `candidate_resume_text`, required skills list | `skill_gaps` list and readiness score in state. |
| **`research_agent.py`** | Deep content curator. For each identified skill gap, executes parallel queries across YouTube, documentation, companion books, and research papers; downloads video transcripts for high-signal videos. | Skill gap topic, candidate experience depth | `researched_materials` list of curated learning modules with URLs and metadata. |
| **`planner_agent.py`** | Turns learning modules and skill gaps into a structured schedule. Computes topic weights and queries the LLM in small concurrent chunks (max 10 days/call) for daily titles and objectives. | `researched_materials`, `skill_gaps`, `total_days` | Calls `plan_builder.assemble_plan` to produce the finalized `StudyPlan`. |
| **`assessment_agent.py`** & **`flashcard_agent.py`** | Generates multiple-choice quiz questions and flashcard decks across sprint topics with LLM JSON retry logic. | Sprint topics, study modules | Sprint-level assessment and flashcard datasets. |
| **`registry.py`** | Single source of truth for specialist registration, descriptions, and factory instantiation. | N/A | Used by `supervisor.py` and `graph/builder.py` for routing. |

### 3.2. Core Infrastructure & Graph Pipeline (`src/core/`, `src/graph/`)

| Module | Purpose |
| :--- | :--- |
| **`graph/builder.py`** | Assembles the complete LangGraph `StateGraph`. Configures nodes, parallel forks (`company_research` + `job_intelligence`), conditional clarification edges, and checkpointer. |
| **`graph/state.py`** | Defines `AgentState` TypedDict—the single source of truth for state flowing between nodes (`messages`, `task_context`, `plan_total_days`, `study_plan`, etc.). |
| **`graph/streaming.py`** | Wraps graph turns to yield normalized progress steps (`route`, `step`, `token`, `final`). |
| **`core/config.py`** | Unified Pydantic settings loading `.env`, configuring provider clients (Ollama, OpenAI, Groq), concurrency limits, and default stage timeouts. |
| **`core/auth.py`** | Verifies HMAC JWT tokens forwarded from Express gateway; supports dev bypass when auth is disabled. |

### 3.3. Streaming & Event Delivery (`src/streaming/`)

| Module | Purpose |
| :--- | :--- |
| **`streaming/runner.py`** | Background task executor for `/internal/agent/execute`. Unpacks request, resolves custom durations, and runs the LangGraph bridge. |
| **`streaming/langgraph_bridge.py`** | Intercepts LangGraph custom events and transforms them into standardized SSE events (`thinking`, `calling_agent`, `researching`, `processing`, `structuring`, `completed`). |
| **`streaming/publisher.py`** | Handles Redis operations: publishes events to `agent:events:{runId}` channel and pushes frames to `agent:history:{runId}` list for client reconnection replay. |
| **`streaming/models.py`** | Defines `EventType` enum and event payload contracts. |

### 3.4. Tools & Deterministic Logic (`src/tools/`)

| Module | Purpose |
| :--- | :--- |
| **`tools/duration.py`** | Natural language duration parser. Extracts custom timeline lengths (e.g., 90 days, 3 months, 6 weeks) from prompts and messages. |
| **`tools/plan_builder.py`** | Deterministic plan builder. Distributes days by priority weight, divides days into balanced 7-day sprints, places companion books/papers on day 1, and validates against `StudyPlan` contract. |
| **`tools/serpapi_client.py`** | Unified search client. Manages live SerpApi queries, retries, rate limits, and fallback to dummy fixtures (`docs/serpapi_fixtures.example.json`) when offline. |
| **`tools/text_sanitize.py`** | Sanitizes LLM outputs by removing emoji, unprintable control characters, and typography artifacts before schema validation. |

---

## 4. Environment & Configuration Reference

Configure `agents-service/.env` (copy from `.env.example`). Key configuration groups:

### 3.1. LLM Provider Setup
```dotenv
# Primary provider: 'ollama' (default) or 'openai'
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.1
OLLAMA_BASE_URL=http://localhost:11434

# Optional: Fast secondary tier for routing and small JSON extractions (e.g. Groq / DeepSeek)
FAST_LLM_BASE_URL=https://api.groq.com/openai/v1
FAST_LLM_MODEL=llama-3.1-8b-instant
FAST_LLM_API_KEY=gsk_...
FAST_LLM_MAX_CONCURRENCY=4
```

### 3.2. Per-Agent Model Routing
Each agent can run on a tailored model profile:
- `PLANNER_LLM`: `default` or `fast` (routes day wording chunks)
- `PLANNER_MODEL`: Model override on primary provider (e.g. `llama3.2:3b` for fast JSON)
- `RESEARCH_MODEL`: Model override for learning module synthesis
- `SKILL_GAP_LLM`: `default` or `fast` for comparing resumes to job skills

### 3.3. Search Tools & SerpApi
```dotenv
SERPAPI_API_KEY=your_serpapi_key
# Set to 'false' to run offline using dummy fixture data:
SERPAPI_ENABLED=true
SERPAPI_DUMMY_DATA_PATH=docs/serpapi_fixtures.example.json
```

### 3.4. Redis & Streaming
```dotenv
REDIS_URL=redis://localhost:6379
REDIS_EVENT_TTL_SECONDS=3600
SSE_PING_INTERVAL_SECONDS=15
SSE_WATCHDOG_TIMEOUT_SECONDS=35
# UI dev dummy stream: set 'false' for production multi-agent runs
USE_DUMMY_STREAM=false
```

### 3.5. Study Plan Tuning
```dotenv
PLAN_TOTAL_DAYS=45                # Fallback duration if unspecified
PLAN_MAX_TOPICS=6                 # Maximum skill gaps planned
PLAN_MIN_DAYS_PER_TOPIC=3         # Minimum days allocated per scheduled topic
PLAN_SPRINT_MAX_DAYS=7            # Maximum days in a sprint
PLANNER_DAYS_PER_CALL=10          # Days generated per LLM call chunk
```

---

## 5. Maintenance Runbooks & Common Operations

### Runbook 1: Adding a New Specialist Agent
1. **Implement Agent**: Create `src/agents/my_specialist_agent.py` subclassing `BaseAgent`.
2. **Register Factory**: Add to `src/agents/registry.py`:
   ```python
   Specialist(
       name="my_specialist",
       description="Specialist description for supervisor routing prompt",
       factory=lambda: MySpecialistAgent(),
   )
   ```
3. **Supervisor Routing**: `src/graph/builder.py` automatically wires auto-wired specialists from registry to `save_memory`.
4. **Custom Tool Loops**: If the agent requires a cyclic tool execution loop (like `company_research`), register with `factory=None` and manually configure conditional edges in `src/graph/builder.py`.

### Runbook 2: Adjusting Study Plan Duration & Sprint Distribution
- Duration extraction is governed by [`src/tools/duration.py`](file:///C:/project/PrepAmigo-Multi-Agent-Personalized-Preparation-System/agents-service/src/tools/duration.py).
- To support additional duration formats (e.g., quarters, semesters), update `extract_duration_days()` with corresponding regex matches.
- In [`src/tools/plan_builder.py`](file:///C:/project/PrepAmigo-Multi-Agent-Personalized-Preparation-System/agents-service/src/tools/plan_builder.py), `assemble_plan` uses:
  ```python
  parts = split_evenly(list(range(len(all_days))), -(-len(all_days) // 7))
  ```
  This automatically balances days across 7-day sprints for any plan length (e.g. 45 days $\rightarrow$ 7 sprints; 90 days $\rightarrow$ 13 sprints).

### Runbook 3: Maintaining Database Independence
> [!CAUTION]
> **DO NOT connect `agents-service` directly to MongoDB.**
> 
> If a developer attempts to add `pymongo` or direct database models here:
> - It violates the decoupled gateway architecture.
> - Background agent runs will fail when running in isolated Docker containers or serverless environments.
> - The Express backend gateway already subscribes to Redis `completed` events and handles atomic persistence into `plans`, `sprints`, and `sprint_days` collections.

### Runbook 4: Debugging Stream Watchdog Timeouts
If the client receives an SSE timeout error (`Worker timed out` or silence watchdog):
1. Check `LOG_FILE` (`.data/logs/agents-service.log`) or console output.
2. Inspect step timing lines (`agent=interview_prep step=... elapsed=...`).
3. If an LLM call exceeds `interview_prep_branch_timeout_seconds` (default 90s), consider:
   - Increasing the branch timeout in `.env`.
   - Routing that agent to a faster model via `*_LLM=fast` or `FAST_LLM_*`.
   - Reducing `research_compact_max_output_tokens` or `planner_days_per_call`.

---

## 6. Development & Testing Commands

### Running the Service Locally
```bash
# Navigate to service directory
cd agents-service

# Install dependencies
uv sync --dev

# Launch FastAPI development server
uv run uvicorn --app-dir src main:app --host 0.0.0.0 --port 8000 --reload
```

### Running the Interactive CLI
```bash
# Interactive chat REPL with streaming:
uv run python src/scripts/cli.py --user dev-user

# Automated pipeline dry-run with live terminal SSE telemetry:
uv run python src/scripts/cli.py --prep --company "Stripe" --role "Backend Engineer" --location "San Francisco"
```

### Running the Automated Test Suite
```bash
# Run all tests:
python -m pytest tests

# Run specific test modules:
python -m pytest tests/test_duration.py
python -m pytest tests/test_planner_agent.py
python -m pytest tests/test_interview_prep_orchestrator.py

# Run with verbose output:
python -m pytest tests -v
```

---

## 7. Key Invariants Checklist for PRs & Updates

Before merging changes into `agents-service`, verify that:
- [ ] `python -m pytest tests` passes with **417/417 tests green**.
- [ ] No MongoDB connection code (`motor`, `pymongo`, `mongo_uri`) has been reintroduced into `src/`.
- [ ] Any new state keys are declared in `src/graph/state.py` within `AgentState`.
- [ ] LLM day generation continues to use bounded `ChunkLLM` / `_chunk` calls without requiring the LLM to output full plan schemas.
- [ ] All SSE events emitted comply with the `EventType` enum in `src/streaming/models.py`.
