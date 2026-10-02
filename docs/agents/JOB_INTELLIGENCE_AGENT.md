# Job Intelligence Agent Documentation

The **Job Intelligence Agent** is a core service in the PrepAmigo platform. It fetches live job market data via SerpApi's Google Jobs API, normalizes and deduplicates raw job postings, extracts structured requirements and experience signals using an LLM (with schema validation and rule-based fallbacks), and persists a normalized profile in MongoDB for consumption by downstream agents (such as the Skill Gap Agent and Planner Agent).

---

## Key Features

1. **Live Google Jobs Integration**: Queries Google Jobs using official `serpapi` client with `engine: "google_jobs"`.
2. **MongoDB Caching Layer (TTL ~7 Days)**: Caches normalized profiles to conserve SerpApi credits on duplicate or repeat searches across users.
3. **Sparse-Data Fallback**: Automatically falls back to a broader role-based query if zero postings match a target company+role combination, marking `isFallback: true` with explanatory reasons.
4. **LLM Extraction & Zod Schema Validation**: Extracts skills, categories, frequencies, experience signals, responsibilities, and qualifications using **Google Gemini** (`gemini-2.5-flash` via `@google/genai`) with strict JSON output mode. Retries once on validation failure before resorting to a safe heuristic extraction fallback.
5. **Skill Normalization & Prioritization**: Normalizes naming variations (e.g., `React.js` -> `React`, `GCP` -> `Google Cloud Platform`) and prioritizes skills into `must-have` vs `nice-to-have`.
6. **Posting Deduplication**: Deduplicates postings by `job_id`, link, or composite signature before running frequency calculations.
7. **Seniority Analysis**: Calculates seniority distributions (`junior`, `mid`, `senior`, `lead`, `executive`, `unspecified`) and data confidence ratings (`high`, `medium`, `low`, `insufficient_data`).
8. **Per-User Rate Limiting**: Implements sliding window rate limits for live external SerpApi calls while keeping cached profiles freely accessible.
9. **Raw Response Archiving**: Archives raw SerpApi responses in `job_postings_raw` for auditing and offline training/analysis.

---

## Architecture & Data Flow

```
[Client Request: company, role, location]
                   │
                   ▼
       [Check MongoDB Cache (7-day TTL)]
        │                           │
   (Cache Hit)                 (Cache Miss)
        │                           │
        ▼                           ▼
[Return Cached Profile]   [Enforce User Rate Limit]
                            │
                            ▼
                  [SerpApi Google Jobs API]
                            │
                    (0 Postings Found?) ──► [Sparse-Data Fallback Query]
                            │                         │
                            ▼                         ▼
                  [Raw Data Persistence in `job_postings_raw`]
                            │
                            ▼
                  [Posting Deduplication]
                            │
                            ▼
              [LLM Extraction + Zod Validation]
                │                       │
         (Schema Error)           (Success)
                │                       │
                ▼                       │
         [Retry 1 Time]                 │
         │           │                  │
      (Success)  (Failure)              │
         │           │                  │
         └───────────┼──────────────────┘
                     ▼
          [Skill Normalization]
                     │
                     ▼
          [Seniority Analysis]
                     │
                     ▼
  [Store Profile in `job_intelligence_profiles`]
                     │
                     ▼
            [Return Normalized JSON]
```

---

## API Endpoint Usage

### `POST /api/agents/job-intelligence`

**Headers:**

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**

```json
{
  "company": "Google",
  "role": "Software Engineer",
  "location": "Mountain View, CA"
}
```

**Response (`200 OK`):**

```json
{
  "success": true,
  "data": {
    "normalizedQueryKey": "google|software engineer|mountain view, ca",
    "company": "Google",
    "role": "Software Engineer",
    "location": "Mountain View, CA",
    "isFallback": false,
    "coverage": "high",
    "postingsCount": 10,
    "analyzedPostingsCount": 8,
    "skills": [
      {
        "name": "React",
        "normalizedName": "React",
        "category": "Frameworks & Libraries",
        "frequency": 6,
        "percentage": 75,
        "priority": "must-have"
      },
      {
        "name": "Python",
        "normalizedName": "Python",
        "category": "Languages",
        "frequency": 5,
        "percentage": 63,
        "priority": "must-have"
      },
      {
        "name": "Docker",
        "normalizedName": "Docker",
        "category": "Cloud & DevOps",
        "frequency": 3,
        "percentage": 38,
        "priority": "nice-to-have"
      }
    ],
    "seniorityDistribution": {
      "junior": 1,
      "mid": 4,
      "senior": 3,
      "lead": 0,
      "executive": 0,
      "unspecified": 0,
      "confidence": "high"
    },
    "employmentTypes": ["Full-time"],
    "commonResponsibilities": [
      "Design, develop, test, deploy, maintain and improve software.",
      "Manage individual project priorities, deadlines and deliverables."
    ],
    "commonQualifications": [
      "Bachelor's degree in Computer Science or equivalent practical experience.",
      "Experience with data structures or algorithms."
    ],
    "fetchedAt": "2026-09-26T16:00:00.000Z",
    "expiresAt": "2026-10-03T16:00:00.000Z"
  }
}
```

---

## Error Handling & Status Codes

| Status Code                 | Reason / Description                                   | Response Format                                                  |
| --------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| `400 Bad Request`           | Missing required fields (`role` or `location`).        | `{"success": false, "error": "Missing required field..."}`       |
| `401 Unauthorized`          | Missing or invalid auth token / session cookie.        | `{"success": false, "error": "Authentication required"}`         |
| `429 Too Many Requests`     | Per-user rate limit exceeded or SerpApi quota reached. | `{"success": false, "error": "Rate limit exceeded..."}`          |
| `500 Internal Server Error` | Unrecoverable internal error (no stack trace leaked).  | `{"success": false, "error": "An unexpected error occurred..."}` |

---

## SerpApi Credit Considerations & Best Practices

1. **Conservative Query Strategy**: Every request checks MongoDB cache first. If a fresh profile exists, SerpApi is **not** called.
2. **Quota & Rate Limit Resilience**: SerpApi free tier quotas are guarded against gracefully. If quota is exceeded, the agent returns HTTP `429` with a friendly error message instead of crashing.
3. **No Unnecessary Pagination**: Fetches single targeted page results (up to 10 postings) to minimize API credit consumption while maintaining high analytical fidelity.

---

## Running the Runnable Test Script

To verify the agent locally:

```bash
cd backend
npm run test:job-intel
```

This runs a sample query (`Google`, `Software Engineer`, `Mountain View, CA`), displays the normalized output, and immediately re-runs the identical query to demonstrate **instant cache retrieval** without making extra SerpApi calls.

---

## Python LangGraph Integration

The Python Job Intelligence implementation is available as `agents.job_intelligence_agent.JobIntelligenceAgent`, a reusable graph node. It accepts a validated `{company, role, location}` request from the orchestration state, reuses the normalized-query MongoDB cache and existing SerpApi/LLM fallback behavior, and writes its result only to `job_intelligence_result`. The existing Python HTTP routes are compatibility adapters to the same service. The separate Express/TypeScript endpoint remains unchanged.

The `interview_prep` specialist runs this node alongside the Company Research tool-loop subgraph. Branch outputs are isolated until the join, where the ReAct evaluator returns `complete`, `partial`, or `failed`. One failed or timed-out branch does not discard the other branch's output. The evaluator makes one bounded decision and never retries agents automatically. If required input is missing, or the evaluator identifies an ambiguity that requires user input, LangGraph interrupts the current thread and resumes it after clarification; at most three clarification rounds are allowed.

Required workflow fields and their recipients are configured in `agents-service/src/agents/interview_prep_fields.py`. The same schema drives LLM extraction, clarification questions, the dynamic frontend form, and routing to each agent. Add a field definition there and list its recipient agents; update a specialist if it needs domain-specific interpretation of a new field.

To run SerpApi-backed Python tools offline, set `SERPAPI_ENABLED=false` and `SERPAPI_DUMMY_DATA_PATH` to a provider-shaped JSON file. `agents-service/serpapi_fixtures.example.json` demonstrates fixtures for Google Search/News/Jobs/Scholar, YouTube, Google AI Overview, and Google Flights. Outputs identify fixture data as dummy; `USE_DUMMY_STREAM` only controls the scripted SSE demo.

For an end-to-end frontend exercise, open `/app/interview-prep`. The Node gateway routes are `POST /api/agent/interview-prep` to start and `POST /api/agent/interview-prep/resume` to resume. Both require authentication and an idempotency key. Read progress and results from `GET /api/agent/stream/:runId`; a `waiting` SSE event carries `question` and `missing_fields` and closes that run's stream. Resume using the same `threadId` with the newly supplied fields or an `answer`. Completed events include both branch results and a `complete`/`partial` status. Checkpoints currently use process-local `MemorySaver`, so paused workflows cannot survive a Python process restart.
