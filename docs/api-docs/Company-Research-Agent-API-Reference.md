# Company Research Agent — API Reference

> Reference documentation for the 2 SerpApi endpoints used exclusively by the **Company Research Agent** in PrepAmigo: **Google Search API** and **Google News API**.

---

## Why Only 2 APIs?

The Company Research Agent previously referenced 8 separate Google APIs (Search, News, Finance, Finance Markets, Trends, Images, Forums, and AI Overview). Several did not exist as real developer APIs or added excessive latency, failure modes, and quota cost without proportional value for the agent's core task: producing a structured summary of a company's products, tech stack, engineering culture, and recent developments for downstream agents in the shared **Learning Context**.

The agent now uses **exactly 2 APIs**:
1. **Google Search API** already bundles:
   - `knowledge_graph` (structured company facts: name, type/industry, founded date, HQ, description)
   - `organic_results[]` (engineering blogs, tech stack documentation, career pages)
   - `related_questions[]` (candidate expectations, interview culture signals)
   - `discussions_and_forums[]` (candid developer chatter from Reddit and Blind)
2. **Google News API** covers:
   - `news_results[]` (recent product launches, acquisitions, funding rounds, strategic announcements)

Together, these 2 endpoints replace the need for separate Trends, Forums, Images, AI Overview, and Finance calls for this agent's scope.

---

## Table of Contents
1. [Google Search API](#1-google-search-api)
2. [Google News API](#2-google-news-api)
3. [Learning Context Schema Mapping](#3-learning-context-schema-mapping)
4. [Error Handling & Resilience](#4-error-handling--resilience)

---

## 1. Google Search API

**Purpose in PrepAmigo:** Primary data source for company facts, products, technology stack, engineering culture, and community forum chatter.

- **Endpoint:** `GET https://serpapi.com/search.json`
- **SerpApi Engine:** `google`
- **Docs:** https://serpapi.com/search-api

### Request Parameters

| Param | Type | Required? | Recommended / Default | Description |
|---|---|---|---|---|
| `engine` | string | **Required** | `google` | Must be `google` |
| `q` | string | **Required** | — | Search query, e.g. `{company} engineering blog tech stack` |
| `api_key` | string | **Required** | — | SerpApi private API key (from `SERPAPI_API_KEY`) |
| `num` | integer | Optional | `10` | Number of results to return (default 10) |
| `hl` | string | Optional | `en` | Host language |
| `gl` | string | Optional | `us` | Geolocation country code |

### Example Request

```http
GET https://serpapi.com/search.json?engine=google&q=Stripe+engineering+blog+tech+stack&api_key=API_KEY&num=10&hl=en&gl=us
```

### Response Fields Consumed & Stored in Learning Context

| Field | Type | Description |
|---|---|---|
| `knowledge_graph` | object | Structured facts: `title`, `type` / `industry`, `founded`, `headquarters`, `description` |
| `organic_results[]` | array | High-signal web results: `position`, `title`, `link`, `snippet` (engineering blogs, architecture, tech docs) |
| `related_questions[]` | array | People Also Ask entries: `question`, `snippet` (interview culture and role expectations) |
| `discussions_and_forums[]` | array | Community discussions: `title`, `link`, `source` (Reddit/Blind-style chatter) |

### Example Response Shape

```json
{
  "search_metadata": {
    "id": "64fe1b2c45d3...",
    "status": "Success",
    "json_endpoint": "https://serpapi.com/searches/...",
    "created_at": "2026-09-26 18:00:00 UTC"
  },
  "search_parameters": {
    "engine": "google",
    "q": "Stripe engineering blog tech stack",
    "gl": "us",
    "hl": "en",
    "num": 10
  },
  "knowledge_graph": {
    "title": "Stripe",
    "type": "Financial technology company",
    "founded": "2010",
    "headquarters": "South San Francisco, CA",
    "description": "Stripe is a multinational financial services and software as a service company..."
  },
  "organic_results": [
    {
      "position": 1,
      "title": "Stripe Engineering Blog",
      "link": "https://stripe.com/blog/engineering",
      "snippet": "Technical articles, architecture deep dives, and lessons learned building scalable payment systems at Stripe."
    },
    {
      "position": 2,
      "title": "Stripe Tech Stack — StackShare",
      "link": "https://stackshare.io/stripe/stripe",
      "snippet": "Stripe uses Ruby, Java, Go, React, Kafka, Kubernetes, and AWS as primary technologies."
    }
  ],
  "related_questions": [
    {
      "question": "What is Stripe's engineering culture like?",
      "snippet": "Stripe emphasizes written communication, rigorous code reviews, operational excellence, and developer velocity."
    }
  ],
  "discussions_and_forums": [
    {
      "title": "What's it actually like working as a Software Engineer at Stripe? : r/cscareerquestions",
      "link": "https://www.reddit.com/r/cscareerquestions/comments/...",
      "source": "Reddit"
    }
  ]
}
```

---

## 2. Google News API

**Purpose in PrepAmigo:** Track recent developments, product launches, acquisitions, leadership updates, and strategic announcements (last 6–12 months).

- **Endpoint:** `GET https://serpapi.com/search.json`
- **SerpApi Engine:** `google_news`
- **Docs:** https://serpapi.com/google-news-api

### Request Parameters

| Param | Type | Required? | Recommended / Default | Description |
|---|---|---|---|---|
| `engine` | string | **Required** | `google_news` | Must be `google_news` |
| `q` | string | **Required** | — | Search query (typically company name, e.g. `Stripe`) |
| `api_key` | string | **Required** | — | SerpApi private API key (from `SERPAPI_API_KEY`) |
| `gl` | string | Optional | `us` | Geolocation country code |
| `hl` | string | Optional | `en` | Host language |

### Example Request

```http
GET https://serpapi.com/search.json?engine=google_news&q=Stripe&api_key=API_KEY&gl=us&hl=en
```

### Response Fields Consumed & Stored in Learning Context

| Field | Type | Description |
|---|---|---|
| `news_results[]` | array | Recent news articles with `position`, `title`, `link`, `source` (`name`), `date` (`iso_date` or relative date), and `snippet` |

### Example Response Shape

```json
{
  "search_metadata": {
    "id": "64fe1b3e89a1...",
    "status": "Success",
    "json_endpoint": "https://serpapi.com/searches/...",
    "created_at": "2026-09-26 18:00:00 UTC"
  },
  "search_parameters": {
    "engine": "google_news",
    "q": "Stripe",
    "gl": "us",
    "hl": "en"
  },
  "news_results": [
    {
      "position": 1,
      "title": "Stripe launches new payments API and enhanced fraud prevention",
      "link": "https://techcrunch.com/...",
      "source": { "name": "TechCrunch" },
      "date": "2 days ago",
      "snippet": "Stripe today announced major upgrades to its flagship payments platform..."
    }
  ]
}
```

---

## 3. Learning Context Schema Mapping

Both responses are parsed and normalized into `task_context["company_profile"]` in the shared Learning Context:

```json
{
  "company_profile": {
    "name": "Stripe",
    "industry": "Financial technology company",
    "founded": "2010",
    "headquarters": "South San Francisco, CA",
    "description": "Stripe is a multinational financial services...",
    "knowledge_graph": {
      "title": "Stripe",
      "type": "Financial technology company",
      "founded": "2010",
      "headquarters": "South San Francisco, CA",
      "description": "..."
    },
    "context_snippets": {
      "organic_results": [
        { "title": "...", "link": "...", "snippet": "..." }
      ],
      "related_questions": [
        { "question": "...", "snippet": "..." }
      ],
      "discussions_and_forums": [
        { "title": "...", "link": "...", "source": "..." }
      ]
    },
    "recent_developments": [
      {
        "title": "...",
        "link": "...",
        "source": "...",
        "date": "...",
        "snippet": "..."
      }
    ]
  }
}
```

### Downstream Consumers

| Downstream Agent | Keys Consumed from `company_profile` | Purpose |
|---|---|---|
| **Skill Gap Agent** | `context_snippets.organic_results` (tech stack mentions) | Benchmark candidate skills against actual languages and frameworks used |
| **Planner Agent** | `recent_developments`, `knowledge_graph.description` | Tailor study sprints and case studies around current company initiatives |
| **Interview Intelligence Agent** | `context_snippets.discussions_and_forums`, `context_snippets.related_questions` | Cross-reference interview questions and candidate culture expectations |

---

## 4. Error Handling & Resilience

1. **Status Checking:** Before attempting to parse responses, the agent inspects `search_metadata.status`. If `status != "Success"`, or if `error` is present, the agent logs the incident and returns a graceful fallback structure rather than raising an unhandled exception.
2. **Partial State Preservation:** If the News API returns empty results or encounters an error, the agent preserves all valid facts retrieved from the Google Search API (and vice-versa).
3. **Environment Security:** `api_key` is always sourced dynamically from the environment (`SERPAPI_API_KEY` or `SERPAPI_KEY`) and is never hardcoded.
