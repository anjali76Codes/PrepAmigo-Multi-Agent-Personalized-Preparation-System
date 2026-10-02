# PrepAmigo Organization Chore — Change Reference

> **Branch:** `rijhan-agent`  
> **Date:** 2026-10-02  
> **Base commit:** `f9b5f09` (merge: frontend + orchestration workflow)  
> **HEAD after chore:** `439e3d2`

This document is the authoritative record of every file that was **moved, created, deleted, or updated** during the repo-wide organization chore. Use it to resolve merge conflicts: if a file appears in a conflict, look it up here to see whether it was renamed/moved and what the canonical new path is.

---

## Commits (in order)

| SHA | Message |
|---|---|
| `ec57772` | chore(agents-service): move scratch/doc files out of root |
| `df0cfb0` | chore(agents-service): move dummy_md/ and output/ into .data/ |
| `a7c340b` | chore(agents-service): move parser_agent.py into src/scripts/ |
| `4c41d1e` | chore(agents-service): organize src root into core/, routers/, scripts/ |
| `b4f15d9` | chore(agents-service): expand .env.example with all flags and comments |
| `a20dfdc` | chore(frontend): move scripts to scripts/, useAuth to hooks/, utils to utils/ |
| `7d6e168` | chore(frontend): add feature-flag env vars to .env.example |
| `59d0e04` | chore(frontend): add featureFlags config module |
| `47e2820` | docs: update PrepAmigo.md with current architecture |
| `439e3d2` | docs: add agent architecture flow diagram and plan output to PrepAmigo.md |

---

## agents-service

### Files Moved

| Old Path | New Path | Reason | Import/Ref fixes |
|---|---|---|---|
| `agents-service/resume.txt` | `agents-service/.data/scratch/resume.txt` | Scratch artifact — gitignored | None (not imported) |
| `agents-service/Resume_2_0.pdf` | `agents-service/.data/scratch/Resume_2_0.pdf` | Scratch artifact — gitignored | None |
| `agents-service/schemas.txt` | `agents-service/.data/scratch/schemas.txt` | Scratch artifact — gitignored | `docs/agents/PARSER_AGENT_GUIDE.md` reference updated |
| `agents-service/serpapi_fixtures.example.json` | `agents-service/docs/serpapi_fixtures.example.json` | Example fixture belongs in docs | `agents-service/.env.example` path updated |
| `agents-service/ollama_setup_guide.md` | `agents-service/docs/ollama_setup_guide.md` | Guide doc belongs in docs | `agents-service/.env.example` cli path updated |
| `agents-service/dummy_md/` (entire dir) | `agents-service/.data/dummy_md/` | Dev-only fixture data — gitignored | `parser_agent.py` INPUT_DIR constant |
| `agents-service/output/` (entire dir) | `agents-service/.data/output/` | Generated output — gitignored | `parser_agent.py` OUTPUT_DIR constant |
| `agents-service/parser_agent.py` | `agents-service/src/scripts/parser_agent.py` | Utility script belongs in src/scripts/ | `BASE_DIR` updated (`.parent` → `.parent.parent.parent`); `from src.config import` → `from src.core.config import`; `docs/agents/PARSER_AGENT_GUIDE.md` run command updated |
| `agents-service/src/auth.py` | `agents-service/src/core/auth.py` | Cross-cutting core concern | 2 call sites in main.py, routers |
| `agents-service/src/config.py` | `agents-service/src/core/config.py` | Cross-cutting core concern | 19 src files + 6 test files |
| `agents-service/src/job_intelligence_router.py` | `agents-service/src/routers/job_intelligence_router.py` | FastAPI router convention | main.py import updated |
| `agents-service/src/skill_gap_router.py` | `agents-service/src/routers/skill_gap_router.py` | FastAPI router convention | main.py import updated |
| `agents-service/src/cli.py` | `agents-service/src/scripts/cli.py` | Developer utility belongs in scripts/ | docs/guides/CLI_TESTING_GUIDE.md, agents-service/README.md, docs/ollama_setup_guide.md updated |

### Files Created

| Path | Reason |
|---|---|
| `agents-service/.data/scratch/` | Container for scratch artifacts (gitignored) |
| `agents-service/docs/` | Container for service-level docs |
| `agents-service/src/core/__init__.py` | Marks `core/` as a Python package |
| `agents-service/src/routers/__init__.py` | Marks `routers/` as a Python package |
| `agents-service/src/scripts/__init__.py` | Marks `scripts/` as a Python package |

### Import Changes — agents-service Python files

All 25 files below had `from config import` replaced with `from core.config import`:

**src/agents/**: `base.py`, `interview_intelligence_agent.py`, `interview_intelligence_node.py`, `interview_prep_orchestrator.py`, `job_intelligence_agent.py`, `research_agent.py`, `research_node.py`, `skill_gap_agent.py`, `supervisor.py`

**src/graph/**: `knowledge_graph.py`

**src/memory/**: `mem0_adapter.py`, `store.py`

**src/observability/**: `logging_config.py`

**src/scripts/**: `cli.py`, `parser_agent.py`

**src/tools/**: `cache.py`, `company_research_tools.py`, `research_tools.py`, `search_tools.py`, `serpapi_client.py`

**src/routers/**: `job_intelligence_router.py` (`from auth import` → `from core.auth import`), `skill_gap_router.py` (`from config import` + `from auth import` → `from core.config import` + `from core.auth import`)

**src/main.py**: `from auth import` → `from core.auth import`; `from job_intelligence_router import` → `from routers.job_intelligence_router import`; `from skill_gap_router import` → `from routers.skill_gap_router import`

**tests/**: `test_agent_runtime.py`, `test_cache.py`, `test_logging_config.py`, `test_memory_adapter.py`, `test_research_tools.py`, `test_serpapi_client.py` — all had `from config import` → `from core.config import`

### .env.example Changes

| Change | Detail |
|---|---|
| `SERPAPI_DUMMY_DATA_PATH` | Updated from `serpapi_fixtures.example.json` (old root) to `.data/serpapi_fixtures.json` (data dir); added note to copy from `docs/serpapi_fixtures.example.json` |
| Auth comment | Updated path reference from `src/auth.py` → `src/core/auth.py` |
| Added `ENVIRONMENT` | `development \| production` flag — was missing |
| Added `CORS_ORIGINS` | `http://localhost:5173` default — was missing |

---

## frontend

### Files Moved

| Old Path | New Path | Reason | Import/Ref fixes |
|---|---|---|---|
| `frontend/generate_ui.js` | `frontend/scripts/generate_ui.js` | One-off generator script already executed; belongs in scripts/ | None (not imported; inert file) |
| `frontend/update_chat.py` | `frontend/scripts/update_chat.py` | One-off generator script already executed; belongs in scripts/ | None (not imported) |
| `frontend/src/lib/useAuth.ts` | `frontend/src/hooks/useAuth.ts` | Auth hook follows hooks/ pattern | 1 file: `components/layout/AppLayout.tsx` |
| `frontend/src/lib/utils.ts` | `frontend/src/utils/utils.ts` | Utility belongs in utils/, not alongside agentStream/ | 21 files (see below) |

### Import Changes — frontend

**`useAuth` import path** (`../../lib/useAuth` → `../../hooks/useAuth`):
- `src/components/layout/AppLayout.tsx`

**`utils` import path** (`../../lib/utils` → `../../utils/utils`):
- `src/components/chat/AgentJourney.tsx`
- `src/components/chat/ChatInput.tsx`
- `src/components/preps/RoadmapDayCard.tsx`
- `src/components/ui/Avatar.tsx`
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/ErrorState.tsx`
- `src/components/ui/Icon.tsx`
- `src/components/ui/IconButton.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/Logo.tsx`
- `src/components/ui/PlatformLoader.tsx`
- `src/components/ui/SearchInput.tsx`
- `src/components/ui/Select.tsx`
- `src/components/ui/Skeleton.tsx`
- `src/components/ui/StatusBadge.tsx`
- `src/components/ui/Textarea.tsx`
- `src/components/ui/Toast.tsx`
- `src/components/ui/Tooltip.tsx`

**`utils` import path** (`../lib/utils` → `../utils/utils`):
- `src/pages/Calendar.tsx`
- `src/pages/Chat.tsx`
- `src/pages/Roadmap.tsx`

### Files Created

| Path | Reason |
|---|---|
| `frontend/src/utils/` | Directory for utility modules (previously empty `src/lib/` held utils.ts alongside unrelated agentStream/) |
| `frontend/src/config/featureFlags.ts` | Central feature-flag module; reads `VITE_ENABLE_AUTH` and `VITE_ENABLE_SERPAPI` so no other file calls `import.meta.env` for flags |

### .env.example Changes

| Change | Detail |
|---|---|
| Added `VITE_API_URL` | Was missing from `.env.example`; already used in `useAuth.ts` |
| Added `VITE_ENABLE_AUTH` | Feature flag (default `false`) |
| Added `VITE_ENABLE_SERPAPI` | Feature flag (default `false`) |
| Added comments | Grouped by concern with inline documentation |

---

## backend

**No file moves.** Structure was already well-organized.

| Check | Result |
|---|---|
| `.env.example` completeness | Verified against `src/config/env.ts` Zod schema — all vars present |
| File structure | No changes needed |

---

## docs/

### Files Updated

| File | What changed |
|---|---|
| `docs/PrepAmigo.md` | Added **Technical Architecture** section (three-service overview, directories, API endpoints, env vars, data models, integration status); added **Agent Architecture & Flow** section with Mermaid flowchart matching the product design, 5-stage pipeline table, Plan Output component table; added Data Parser Agent to Specialized Agents list; reordered agent list |
| `docs/agents/PARSER_AGENT_GUIDE.md` | Updated 5 path references: parser location (`agents-service/parser_agent.py` → `agents-service/src/scripts/parser_agent.py`), input dir (`agents-service/dummy_md/` → `agents-service/.data/dummy_md/`), output dir (`agents-service/output/` → `agents-service/.data/output/`), schemas path (`agents-service/schemas.txt` → `agents-service/.data/scratch/schemas.txt`), config path (`src/config.py` → `src/core/config.py`), run command (`python parser_agent.py` → `python src/scripts/parser_agent.py`) |
| `docs/guides/CLI_TESTING_GUIDE.md` | All `src/cli.py` → `src/scripts/cli.py` (10 occurrences) |
| `docs/guides/ENVIRONMENT_CONFIGURATION.md` | `src/auth.py` → `src/core/auth.py` (1 occurrence) |
| `agents-service/docs/ollama_setup_guide.md` | `src/cli.py` → `src/scripts/cli.py` (1 occurrence) |
| `agents-service/README.md` | `src/cli.py` → `src/scripts/cli.py` (2 occurrences) |

---

## Merge Conflict Resolution Guide

If you see a conflict on any of these files during a merge or rebase:

| Conflict file | What to know |
|---|---|
| `agents-service/src/core/auth.py` | **Renamed from** `agents-service/src/auth.py`. Accept new path. |
| `agents-service/src/core/config.py` | **Renamed from** `agents-service/src/config.py`. Accept new path. |
| `agents-service/src/routers/job_intelligence_router.py` | **Renamed from** `agents-service/src/job_intelligence_router.py`. |
| `agents-service/src/routers/skill_gap_router.py` | **Renamed from** `agents-service/src/skill_gap_router.py`. |
| `agents-service/src/scripts/cli.py` | **Renamed from** `agents-service/src/cli.py`. |
| `agents-service/src/scripts/parser_agent.py` | **Renamed from** `agents-service/parser_agent.py`. |
| Any `*.py` with `from config import` | Should be `from core.config import` — apply this substitution. |
| Any `*.py` with `from auth import` | Should be `from core.auth import` — apply this substitution. |
| Any `*.py` with `from job_intelligence_router import` | Should be `from routers.job_intelligence_router import`. |
| Any `*.py` with `from skill_gap_router import` | Should be `from routers.skill_gap_router import`. |
| `frontend/src/hooks/useAuth.ts` | **Renamed from** `frontend/src/lib/useAuth.ts`. |
| `frontend/src/utils/utils.ts` | **Renamed from** `frontend/src/lib/utils.ts`. |
| Any `*.tsx` with `lib/useAuth` | Should be `hooks/useAuth`. |
| Any `*.tsx` with `lib/utils` | Should be `utils/utils`. |
| `agents-service/.env.example` | Accept this branch's version — adds `ENVIRONMENT`, `CORS_ORIGINS`, fixes `SERPAPI_DUMMY_DATA_PATH`. |
| `frontend/.env.example` | Accept this branch's version — adds `VITE_API_URL`, `VITE_ENABLE_AUTH`, `VITE_ENABLE_SERPAPI`. |
| `docs/PrepAmigo.md` | Accept this branch's version — substantial additions (Technical Architecture + Agent Flow sections). If the other branch also edited product content, manually merge the other branch's edits into the preserved product sections. |

---

## What Was NOT Changed

- All application logic — zero changes to any function, class, or algorithm
- `agents-service/src/agents/` sub-packages — moved files only; no logic edits
- `agents-service/src/graph/`, `src/memory/`, `src/tools/`, `src/streaming/`, `src/prompts/`, `src/guardrails/`, `src/observability/` — import lines updated only where `from config import` appeared
- `frontend/src/data/mockData.ts` — content untouched
- `frontend/src/context/AppContext.tsx` — untouched
- `frontend/src/lib/agentStream/` — untouched (correctly placed already)
- `backend/src/` — zero changes (already well-organized)
- `prepamigo-apis-bruno/` — zero changes (already organized)
- `.gitignore` — not modified (`.data/` was already gitignored)
