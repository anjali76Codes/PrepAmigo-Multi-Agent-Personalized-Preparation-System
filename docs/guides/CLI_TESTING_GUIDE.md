# PrepAmigo CLI Testing Guide

The CLI (`src/scripts/cli.py`) provides three isolated testing modes. Each bypasses different parts of the stack so you can test specific agent layers without running everything.

---

## Modes at a Glance

| Mode | Command | What it tests |
|---|---|---|
| **REPL** | `uv run python src/scripts/cli.py` | Full multi-agent system (supervisor → routing → specialists) |
| **Company Research** | `uv run python src/scripts/cli.py --company "..."` | CompanyResearchAgent in isolation |
| **Full Pipeline** | `uv run python src/scripts/cli.py --prep --company "..." --role "..."` | Orchestrator chain end-to-end |

---

## Mode 1 — REPL (Default)

Starts an interactive chat loop. The supervisor routes each message to the appropriate specialist agent.

```powershell
uv run python src/scripts/cli.py
uv run python src/scripts/cli.py --user yourname
uv run python src/scripts/cli.py --user yourname --stream       # stream tokens as generated (default if STREAM_RESPONSES=true)
uv run python src/scripts/cli.py --user yourname --no-stream    # wait for full reply then print
```

**What to test here:**
- Supervisor routing (e.g., does "research Stripe for backend" go to company_research or research?)
- Chat agent general conversations
- Research agent learning module generation
- Interview intelligence briefs
- Long-term memory recall across turns (keyed by `--user`)

**Example inputs:**
```
You: research Stripe for a backend engineer interview
You: find me resources to learn system design
You: who are you and what can you help me with?
You: prepare me for an ML engineer role at Anthropic in San Francisco
```

> **Note:** The last example triggers the `interview_prep` workflow inside the REPL, but it requires the supervisor to route it first. Use `--prep` mode (Mode 3) for a direct, faster pipeline test.

---

## Mode 2 — Company Research Agent (Isolated)

Directly invokes the `CompanyResearchAgent` in a minimal 2-node graph, bypassing the supervisor and full orchestrator. Shows SSE step events as they fire and the full company dossier at the end.

```powershell
uv run python src/scripts/cli.py --company "Stripe"
uv run python src/scripts/cli.py --company "Anthropic" --role "ML Engineer"
uv run python src/scripts/cli.py --company "Datadog" --role "Backend Engineer"
```

**What to test here:**
- SerpApi fixture data (`SERPAPI_ENABLED=false`) — confirms fixture file is loaded correctly
- Company profile extraction (KG, organic results, news)
- Role-tailored dossier output when `--role` is provided
- SSE event emission sequence (each `RESEARCHING` step printed)

**Output structure:**
```
[SSE: RESEARCHING - RUNNING] Searching company facts for Stripe...
[SSE: RESEARCHING - COMPLETED] ...
[SSE: STRUCTURING - RUNNING] ...
...

════════ Company Research Agent ════════
(streamed markdown dossier)

Company : Stripe
Industry: Financial Technology
Website : https://stripe.com
Evidence: 5 tech/culture sources, 8 news articles.
```

**With `SERPAPI_ENABLED=false`** (set in `agents-service/.env`), searches read the file configured by `SERPAPI_DUMMY_DATA_PATH`. For example, set it to `docs/serpapi_fixtures.example.json` or `docs/serpapi_fixtures.pipeline.json` from the `agents-service/` directory. Fixture mode avoids SerpApi requests, but does not disable model calls or other non-SerpApi sources.

---

## Mode 3 — Full Pipeline (`--prep`)

Runs the interview-preparation orchestration chain **silently** (no intermediate SSE spam). All state passes internally between agents. Displays the final research output passed to the planning step.

```powershell
# Minimum required: --prep, --company, --role
uv run python src/scripts/cli.py --prep --company "Stripe" --role "Backend Engineer"

# With explicit location
uv run python src/scripts/cli.py --prep --company "Stripe" --role "Backend Engineer" --location "San Francisco"

# With a resume file (plain text, .txt recommended)
uv run python src/scripts/cli.py --prep --company "Anthropic" --role "ML Engineer" --location "Remote" --resume-file path/to/resume.txt

# With inline resume text
uv run python src/scripts/cli.py --prep --company "Google" --role "SRE" --resume-text "Python developer 3 years, Kubernetes, GCP"
```

**If no `--resume-file` or `--resume-text` is given**, a built-in dummy resume is used. This is intentional — the dummy resume tests that the skill gap and research agents fire correctly, not the accuracy of results.

### Pipeline Stages (internal, not printed)

```
prepare (collect fields)
  ↓
run_parallel (Company Research + Job Intelligence — async)
  ↓
run_skill_gap (SkillGapAgent — extracts profile, evaluates gaps)
  ↓
run_research (ContentResearchAgent — researches each gap)
  ↓
evaluate (merge results into final state)
```

### Output Structure

```
══════════════════════════════════════════════════════════
  PrepAmigo — Full Pipeline Test
  Company  : Stripe  │  Role : Backend Engineer  │  Location : SF
══════════════════════════════════════════════════════════

  Running pipeline... All state passes internally between agents.

══════════════════════════════════════════════════════════
  RESEARCH OUTPUT → What the Planner Agent Would Receive
══════════════════════════════════════════════════════════

  STAGE 1 — COMPANY + JOB INTELLIGENCE
    ✓ Company Profile  : Stripe (Financial Technology)
    ✓ Required Skills  : 8 identified

  STAGE 2 — SKILL GAP ANALYSIS
    ✓ Readiness Score  : 45%  (medium coverage)
      Total gaps        : 3 (2 missing, 1 partial)
      Already strong    : Python, REST APIs

    Skill                        Status     Effort
    ──────────────────────────── ────────── ──────
    System Design                missing    High
    Kubernetes                   partial    Medium
    Go                           missing    High

  STAGE 3 — RESEARCH MODULES  (Planner builds roadmap from these)
    ✓ 2 learning module(s) produced

    Module 1: "System Design"
      Depth     : intermediate
      Resources : 8 total  (3 documentations, 2 videos, 2 books, 1 papers)
      Sources   : mock/fixture (SERPAPI_ENABLED=false)
      Preview   : System Design at intermediate depth for Backend Engineer...

  DATA FLOW STATUS  (did state pass between agents correctly?)
    ✓  Company Research  → Skill Gap  company_profile passed
    ✓  Job Intelligence  → Skill Gap  8 skills passed
    ✓  Skill Gap         → Research   3 gap(s) passed
    ✓  Research          → Planner [when built]  2 module(s) in state["researched_materials"]

  TOTAL PIPELINE TIME : 8.42s
```

**What to verify in the Data Flow Status section:**
- All four lines should show `✓`
- If a line shows `✗`, that agent hand-off is broken and the state key isn't being passed correctly

---

## Environment Setup

```ini
# .env — key settings for testing

# Offline mode: reads from the configured fixture file (no SerpApi requests)
SERPAPI_ENABLED=false
SERPAPI_DUMMY_DATA_PATH=docs/serpapi_fixtures.example.json

# Log level: set to DEBUG to see full agent reasoning
LOG_LEVEL=INFO

# Token streaming in REPL mode (Mode 1)
STREAM_RESPONSES=true
```

---

## Common Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| `Company Profile: not available` | Company not in fixture file | Add company to the configured fixture or set `SERPAPI_ENABLED=true` |
| `Job Intelligence: not available` | Role not in fixture, or `JobIntelligenceAgent` fallback hit | Check `SERPAPI_ENABLED`, check fixture coverage |
| `Skill Gap: Analysis failed` | LLM call failed or timed out | Check Ollama is reachable and `OLLAMA_MODEL` is available; review the configured LLM provider |
| `Readiness 0%, 0 gaps` | No skills in job intelligence data | Fixture data for that role may lack skill entries |
| Pipeline hangs at `run_research` | Research tools timing out | Set `RESEARCH_TIMEOUT_SECONDS=10` in `.env` for faster test cycles |
| REPL not routing to `interview_prep` | Supervisor prompt mismatch | Use `--prep` mode instead for direct pipeline testing |

---

## Adding a Company to Fixtures

To test a specific company in offline mode, copy `agents-service/docs/serpapi_fixtures.example.json` to a local fixture file and add an entry there. Set `SERPAPI_DUMMY_DATA_PATH` in `agents-service/.env` to that file's path relative to `agents-service/`:

```json
{
  "your_company_name": {
    "knowledge_graph": {
      "title": "Company Name",
      "type": "Software Company",
      "description": "...",
      "website": "https://example.com"
    },
    "organic_results": [...],
    "news_results": [...]
  }
}
```

The key is the lowercased company name (e.g., `"stripe"`, `"anthropic"`). The SerpApi client matches on this key.
