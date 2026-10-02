# Interview-prep pipeline: guide and handoff

How the `interview_prep` workflow turns a company, a role and a resume into a validated study plan, what was changed to make it fast and dependable, and where to look when you need to change it. Settings are described in `.env.example`; deeper notes per feature are in `README.md`.

## What it does

```
company research ─┐
                  ├─> skill gap ─> research (one module per gap) ─> planner ─> evaluate
job intelligence ─┘                                                    │
                                                                       └─> .data/plans/<id>.json
```

| Stage | Input | Output | Model calls |
|---|---|---|---|
| Company research | company name | profile + short brief (products, tech stack, focus) | 1 |
| Job intelligence | company, role | required skills | 1 |
| Skill gap | resume, required skills | gaps ranked by priority | 1 |
| Research | each gap | resources + a short note (overview, key concepts, practice) | 1 per gap, plus 2 optional small ones |
| Planner | gaps, notes, resources | `plan -> sprints -> days`, validated | 1 per ~10 days of a topic |
| Evaluate | stage results | status and summary | 0 or 1 |

Run it:

```
cd agents-service
uv run python src/cli.py --prep --company "Google" --role "Software Development Engineer" --resume-file resume.txt --days 45
```

Add `--no-cache` to make every API and model call live. The run ends with a per-agent table of time, tokens and cache use.

## The design decisions that matter

1. **Code owns structure, the model owns wording.** Day counts, sprints, dates, numbering and references are computed in `tools/plan_builder.py` and validated against the backend's schema. The model writes only titles, objectives and short notes. A weak answer changes wording, never the shape, and each piece has a non-model fallback.
2. **One small call per job.** Each agent makes one bounded call with a capped output instead of a tool loop or a long generation. Company research went from 3-4 calls to 1; skill gap from 2 calls and ~2,800 output tokens to 1 call and ~400; a research write-up from ~1,000 output tokens to ~350.
3. **Evidence is filtered before it is trusted.** Job postings count only if the target company published them. Search results that are job adverts or sales pages are dropped. Books come from a catalogue and must be established; papers must match the whole topic. Links the model cites are checked against what search returned.
4. **Nothing waits that does not have to.** Each topic is written up as soon as its own searches finish. Memory is recalled once per run. Slow searches are cut off at 8s and retried once; at most 4 SerpApi requests run at a time.
5. **Every external call is cached, and every failure degrades.** API responses and model answers are cached with per-kind lifetimes. A timeout, rate limit or unusable answer falls back (to the main model, to resume-text matching, to concept-based wording) instead of failing the run, and is listed in the metrics table.
6. **Each agent's model is a setting.** A fast endpoint (Groq) for the small calls, a small Ollama model for the planner, the large one only where it helps. A rate-limited fast call falls back to the main model automatically.

## Where things are

| Area | File |
|---|---|
| Stage wiring, timeouts, company module | `src/agents/interview_prep_orchestrator.py` |
| Company research (direct mode, brief) | `src/agents/company_brief.py` |
| Job intelligence (posting filter, extraction) | `src/agents/job_intelligence_agent.py` |
| Skill gap | `src/agents/skill_gap_agent.py` |
| Research (queries, filters, judge, notes) | `src/agents/research_agent.py`, `src/prompts/research_prompts.py` |
| Search tools, books, papers | `src/tools/research_tools.py`, `src/tools/serpapi_client.py` |
| Result filters | `src/tools/relevance.py` |
| Plan structure and validation | `src/tools/plan_builder.py`, `src/schemas/study_plan.py` |
| Planner wording | `src/agents/planner_agent.py` |
| Caches | `src/tools/cache.py`, `src/storage/llm_cache.py` |
| Run metrics | `src/observability/metrics.py` |
| Text cleaning | `src/tools/text_sanitize.py` |
| Model routing, all settings | `src/config.py` |

## Settings you will actually touch

| To change | Setting |
|---|---|
| Plan length and depth | `--days`, `PLAN_MAX_TOPICS`, `PLAN_MIN_DAYS_PER_TOPIC` |
| Which model an agent uses | `*_LLM=default\|fast`, `*_MODEL=<model>` |
| Company research style | `COMPANY_RESEARCH_MODE=direct\|agent` |
| Company-platform module | `COMPANY_MODULE=on\|off` |
| What gets searched | `RESEARCH_KINDS`, `RESEARCH_SCOPE_LLM`, `RESEARCH_JUDGE_LLM` |
| Search speed and retries | `SERPAPI_ATTEMPT_TIMEOUT_SECONDS`, `SERPAPI_MAX_CONCURRENCY`, `RESEARCH_TOOL_TIMEOUT_SECONDS` |
| Caching | `RESEARCH_CACHE_ENABLED`, `LLM_CACHE_ENABLED`, `--no-cache` |

## Measured on real runs (2 October)

Same resume and role class, 45-day plans, live SerpApi, Ollama Cloud models. Model and network speed varied a lot between runs, so read these as before/after of specific runs, not benchmarks.

| | Before | After |
|---|---|---|
| Whole run | 286s (and 703s on a slow day) | 76s |
| Company research | 90s, 3-4 calls | 1.8s, 1 call |
| Skill gap | 90s, timed out with no gaps | 1.1s |
| Planner | 76s | 11s |
| Research output tokens | 4,892 | 1,975 |
| Tokens per run | 26.7k | 19.1k |

## How to debug a bad run

1. Read the metrics table: which agent took the time, and any `FAILED` lines.
2. Wrong topics in the plan: look at Stage 1's required skills and the `[JobIntelligence]` log lines (were the postings from the company?).
3. Missing or odd references: look for `dropped off-topic or non-learning results` and `Research scope` in the log.
4. Generic day titles: `narrative_source` in the plan file is `partial` or `fallback`; the planner's calls failed or were rate limited.
5. Stale results: rerun with `--no-cache`, or delete `.data/research_cache/`.

## Known limits and next steps

- Most references are topic-level overviews, so a topic's closing practice and review days have none. One search per day would fix it at about 45 SerpApi credits per plan.
- Free Groq tier: 8,000 tokens and 1,000 output tokens a minute. It suits the company brief, skill gap, search scope and result check; not the planner or research notes.
- `SKILL_GAP_LLM=fast` sends the resume text to the fast provider.
- The cache is file-based. The storage layer is a three-method interface; moving it to Redis is described in `README.md` under "Caching".
- The company-platform module (`COMPANY_MODULE=on`) suits companies whose product is what the role works with; for others it returns marketing pages and is dropped.
- The new book and paper sources (Open Library, arXiv) and the last round of prompt changes have unit tests but only a few live runs behind them.
