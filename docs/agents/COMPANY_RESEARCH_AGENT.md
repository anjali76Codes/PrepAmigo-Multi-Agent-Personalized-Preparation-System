# Company Research Agent

The **Company Research Agent** is a specialized intelligence-gathering agent in the PrepAmigo platform. Given a company name (and optionally a target role), it fetches authoritative data from two external APIs, normalizes it into a structured company profile, and synthesizes a factual markdown **Company Dossier** for interview candidates.

It operates both as a standalone agent (via CLI or direct API) and as a sub-agent invoked by the `InterviewPrepOrchestrator` in parallel with the Job Intelligence Agent.

---

## How It Works

The agent runs in a **two-turn LangGraph loop**:

```
Turn 1 ──► LLM calls both tools IN PARALLEL
              │
              ├─► search_company_overview (Google Search)
              └─► search_company_news     (Google News)
                        │
                  [cr_guardrails → cr_tools execute API calls]
                        │
Turn 2 ──► Agent parses ToolMessages, normalizes company profile,
           then LLM synthesizes the final dossier and streams it
```

The loop exits when the LLM produces a response with no further tool calls.

---

## System Prompt

Defined in [`agents-service/src/prompts/system_prompts.py`](../../agents-service/src/prompts/system_prompts.py) as `COMPANY_RESEARCH_PROMPT`.

Injected by `CompanyResearchAgent.__call__` as a `SystemMessage` prepended to the full conversation history on every turn. Key behavioral rules it enforces:

- Call both tools **in parallel on the first turn**
- Never include the word "overview" in a custom query (causes Google to return dictionary results)
- Never fabricate data — only report what the tools return
- If one tool fails, produce the dossier with `[Not available from current sources]` for that section
- If a target role is provided, tailor the tech stack and interview insights to that role
- Use `sitelinks`, `related_questions`, and `discussions_and_forums` as synthesis inputs, not just organic results

---

## The 2 External APIs

All data comes through [`tools/company_research_tools.py`](../../agents-service/src/tools/company_research_tools.py) via the shared `serpapi_client`.

### 1. Google Search API — `search_company_overview`
- **Engine:** `google`
- **Default query:** `{company_name} company engineering tech stack`
- **Fields extracted:**
  - `knowledge_graph` — name, industry, founded, HQ, description, CEO, **employees, revenue, stock ticker**
  - `sitelinks` — official site sections (Engineering blog, Careers, Docs, etc.)
  - `organic_results` — top 10 results (engineering blogs, StackShare, job pages)
  - `related_questions` — up to 8 "People Also Ask" entries (interview culture signals)
  - `discussions_and_forums` — up to 8 Reddit/Blind discussions (candid developer sentiment)

### 2. Google News API — `search_company_news`
- **Engine:** `google_news`
- **Default query:** `{company_name}`
- **Fields extracted:**
  - `news_results` — up to 10 stories with title, source, date, snippet
  - `related_stories` — nested story clusters within each headline (up to 3 per item)

> **Why only 2 APIs?** Google Search already bundles Knowledge Graph, Forums, and Related Questions in one call. Adding more endpoints adds latency and quota cost with no meaningful coverage gain.

---

## Data Normalization

After tools return, the agent calls `normalize_company_profile()` which maps raw API responses into the canonical `task_context["company_profile"]` schema:

```json
{
  "name": "Anthropic",
  "industry": "Artificial intelligence",
  "founded": "2021",
  "headquarters": "San Francisco, CA",
  "description": "...",
  "website": "https://anthropic.com",
  "ceo": "Dario Amodei",
  "employees": "~3,000",
  "revenue": "",
  "sitelinks": [{"title": "Research", "link": "..."}, ...],
  "organic_results": [...],
  "related_questions": [...],
  "discussions_and_forums": [...],
  "recent_developments": [...],
  "knowledge_graph": {...},
  "context_snippets": {
    "organic_results": [...],
    "related_questions": [...],
    "discussions_and_forums": [...]
  }
}
```

> `context_snippets` is kept for the `InterviewPrepOrchestrator`'s success check. `recent_developments` is the canonical news key (no duplicate `news_results` key).

**Company name resolution order** when the knowledge graph has no title (common for newer AI companies):
1. `knowledge_graph.title`
2. Existing `task_context["company_profile"]["name"]`
3. Company name parsed from orchestrator's JSON in the HumanMessage
4. `"the company"` (last resort — logged as a warning)

---

## SSE Streaming Events

| Step | Status | SSE Type |
|---|---|---|
| `identify_company_scope` | `running` | `THINKING` |
| `search_company_overview` | `running` / `completed` / `failed` | `RESEARCHING` |
| `search_company_news` | `running` / `completed` / `failed` | `RESEARCHING` |
| `structure_company_profile` | `completed` | `STRUCTURING` |
| `synthesize_company_dossier` | `running` / `completed` | `STRUCTURING` |
| Turn complete | — | `COMPLETED` (with `company_profile` payload) |

---

## Orchestrator Integration

`InterviewPrepOrchestrator` invokes the company branch via `asyncio.gather()` in parallel with Job Intelligence:

```python
# From interview_prep_orchestrator.py
company_input = {
    "messages": [HumanMessage(content=f"Prepare a company dossier...\n{json.dumps(company_fields)}")],
    "task_context": {},
    "guardrail_flags": {},
}
result = await self.company_graph.ainvoke(company_input, config={"recursion_limit": 12})

profile = (result.get("task_context") or {}).get("company_profile")
dossier = _message_text(result["messages"][-1])
```

The orchestrator determines success if `profile.get("description") or profile.get("context_snippets")` is non-empty. The return contract (`messages`, `task_context`) is never altered.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| SerpApi key missing | Returns error dict; agent notes gap in dossier |
| SerpApi returns `"error"` | Emits `failed` SSE event; tool returns empty JSON; agent continues with partial data |
| Only one tool succeeds | Dossier produced with available data; missing section marked clearly |
| Company has no Knowledge Graph | Name extracted from orchestrator JSON or input; dossier proceeds without structured facts |
| Orchestrator branch timeout (45s) | Branch returns `status: "failed"` with error message; rest of prep workflow continues |
| Offline / `SERPAPI_ENABLED=false` | Reads fixture JSON from `tests/fixtures/serpapi_fixtures.json` |

---

## Local Testing

```powershell
# Standalone — directly invokes CompanyResearchAgent (bypasses supervisor)
uv run python src/scripts/cli.py --company "Anthropic"
uv run python src/scripts/cli.py --company "Datadog" --role "Site Reliability Engineer"

# Multi-agent REPL — routes through supervisor
uv run python src/scripts/cli.py
# Then type: research Stripe for a backend engineer role
```
