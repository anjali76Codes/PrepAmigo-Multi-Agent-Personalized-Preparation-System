"""
Company Research Tools
----------------------
SerpApi-backed tools used exclusively by the Company Research Agent.
Restricted to exactly 2 data sources:
  1. Google Search API (engine=google) — Primary source for company facts,
     products, tech stack, engineering culture, and discussions.
  2. Google News API (engine=google_news) — Recent developments, product launches,
     funding, and strategic announcements.

Documented in:
  docs/api-docs/Company-Research-Agent-API-Reference.md
"""

import json
import logging
from typing import Any, Optional

from langchain_core.tools import tool

from config import settings
from graph.events import emit_to_graph_stream, make_event
from tools.serpapi_client import serpapi_search, using_dummy_data

logger = logging.getLogger(__name__)


def _serpapi_search(params: dict) -> dict:
    """
    Shared SerpApi request helper.
    Injects the api_key and returns the parsed JSON response dict.
    Fails gracefully by returning an error dictionary if the request fails
    or if SerpApi reports an error, ensuring the graph node does not crash.
    """
    if settings.serpapi_enabled and not settings.serpapi_api_key:
        logger.error("[CompanyResearchTools] SERPAPI_API_KEY is not configured.")
        return {
            "search_metadata": {"status": "Error"},
            "error": "SERPAPI_API_KEY is not configured in environment.",
        }

    try:
        result = serpapi_search(params)
    except Exception as exc:
        logger.error("[CompanyResearchTools] SerpApi request exception: %s", exc)
        return {
            "search_metadata": {"status": "Error"},
            "error": f"SerpApi request failed: {exc}",
        }

    # Verify search metadata status
    metadata = result.get("search_metadata", {})
    status = metadata.get("status")

    err = result.get("error")
    if err or status == "Error":
        err_msg = str(err or metadata.get("error") or "Unknown SerpApi error")
        logger.warning("[CompanyResearchTools] SerpApi response error: %s", err_msg)
        return {
            "search_metadata": {"status": "Error"},
            "error": err_msg,
        }

    if using_dummy_data():
        result.setdefault("search_metadata", {})["source"] = "dummy"
    return result


# ---------------------------------------------------------------------------
# Tool 1 — Google Search (Primary: facts, tech stack, culture, discussions)
# ---------------------------------------------------------------------------

@tool
def search_company_overview(company_name: str, query: Optional[str] = None) -> str:
    """
    Search for a company's products, engineering culture, technology stack,
    facts, related questions, and community forum discussions using Google Search API.

    Returns a JSON string containing knowledge_graph (with structured company facts
    including employees, revenue, sitelinks), organic_results, related_questions,
    discussions_and_forums, and sitelinks.

    Args:
        company_name: The name of the company to research (e.g. 'Stripe', 'Anthropic').
        query: Optional custom search query. If omitted, defaults to
               '{company_name} company engineering tech stack'.
               NEVER include the word 'overview' — it causes Google to return
               results about the word itself instead of the company.
    """
    search_q = query or f"{company_name} company engineering tech stack"
    logger.info("[CompanyResearchTools] google_search: %s (q='%s')", company_name, search_q)
    emit_to_graph_stream(
        make_event(
            "company_research",
            "search_company_overview",
            "running",
            {
                "tool": "search_company_overview",
                "company": company_name,
                "message": f"Searching company facts, tech stack, and engineering culture for {company_name}...",
            },
        )
    )

    result = _serpapi_search({
        "engine": "google",
        "q": search_q,
        "num": 10,
        "hl": "en",
        "gl": "us",
    })

    metadata = result.get("search_metadata", {})
    if metadata.get("status") == "Error" or "error" in result:
        err_msg = str(result.get("error") or "Failed to retrieve Google Search results")
        emit_to_graph_stream(
            make_event(
                "company_research",
                "search_company_overview",
                "failed",
                {
                    "tool": "search_company_overview",
                    "company": company_name,
                    "error": err_msg,
                    "message": f"Google Search for {company_name} encountered an issue: {err_msg}",
                },
            )
        )
        return json.dumps({
            "status": "error",
            "search_metadata": metadata,
            "message": err_msg,
            "knowledge_graph": {},
            "organic_results": [],
            "related_questions": [],
            "discussions_and_forums": [],
            "sitelinks": [],
        })

    # 1. Knowledge graph — structured company facts
    kg_raw = result.get("knowledge_graph", {})
    knowledge_graph = {}
    if kg_raw:
        # Sitelinks inside KG (official site sections: Engineering, Blog, Careers, etc.)
        kg_sitelinks = [
            {"text": sl.get("text", ""), "link": sl.get("link", "")}
            for sl in (kg_raw.get("sitelinks") or [])
            if sl.get("link")
        ]
        knowledge_graph = {
            "title": kg_raw.get("title", company_name),
            "type": kg_raw.get("type") or kg_raw.get("entity_type", ""),
            "industry": kg_raw.get("type") or kg_raw.get("industry", ""),
            "founded": kg_raw.get("founded", ""),
            "headquarters": kg_raw.get("headquarters", ""),
            "description": kg_raw.get("description", ""),
            "website": kg_raw.get("website", ""),
            "ceo": kg_raw.get("ceo", ""),
            # Richer fields — present for larger companies
            "employees": kg_raw.get("number_of_employees") or kg_raw.get("employees", ""),
            "revenue": kg_raw.get("revenue", ""),
            "parent_organization": kg_raw.get("parent_organization", ""),
            "subsidiaries": kg_raw.get("subsidiaries", ""),
            "stock_ticker": kg_raw.get("stock") or kg_raw.get("traded_as", ""),
            "sitelinks": kg_sitelinks,
        }

    # 2. Organic results — tech blogs, architecture docs, career pages, StackShare
    organic_results = [
        {
            "position": r.get("position", idx + 1),
            "title": r.get("title", ""),
            "link": r.get("link", ""),
            "displayed_link": r.get("displayed_link", ""),
            "snippet": r.get("snippet", ""),
        }
        for idx, r in enumerate(result.get("organic_results", [])[:10])
        if r.get("title") or r.get("snippet")
    ]

    # 3. Related questions — candidate expectations and culture signals (up to 8)
    related_questions = [
        {
            "question": q.get("question", ""),
            "snippet": q.get("snippet", ""),
        }
        for q in result.get("related_questions", [])[:8]
        if q.get("question")
    ]

    # 4. Discussions and forums — Reddit/Blind developer chatter (up to 8)
    discussions_and_forums = [
        {
            "title": d.get("title", ""),
            "link": d.get("link", ""),
            "source": d.get("source", "Forum"),
        }
        for d in result.get("discussions_and_forums", [])[:8]
        if d.get("title")
    ]

    # 5. Top-level sitelinks (inline site section links beneath the first organic result)
    sitelinks: list[dict] = []
    raw_sitelinks = result.get("sitelinks") or {}
    if isinstance(raw_sitelinks, dict):
        for sl_list in raw_sitelinks.values():
            if isinstance(sl_list, list):
                for sl in sl_list[:6]:
                    if sl.get("link"):
                        sitelinks.append({"title": sl.get("title", ""), "link": sl.get("link", "")})
    elif isinstance(raw_sitelinks, list):
        for sl in raw_sitelinks[:6]:
            if sl.get("link"):
                sitelinks.append({"title": sl.get("title", ""), "link": sl.get("link", "")})

    emit_to_graph_stream(
        make_event(
            "company_research",
            "search_company_overview",
            "completed",
            {
                "tool": "search_company_overview",
                "company": company_name,
                "status": "success",
                "message": f"Retrieved overview and tech stack data for {company_name}.",
                "has_knowledge_graph": bool(knowledge_graph),
                "organic_count": len(organic_results),
            },
        )
    )

    return json.dumps({
        "status": "success",
        "search_metadata": metadata,
        "query": search_q,
        "knowledge_graph": knowledge_graph,
        "organic_results": organic_results,
        "related_questions": related_questions,
        "discussions_and_forums": discussions_and_forums,
        "sitelinks": sitelinks,
    })


# Alias for explicit naming
search_company_info = search_company_overview


# ---------------------------------------------------------------------------
# Tool 2 — Google News (Recent developments: launches, funding, announcements)
# ---------------------------------------------------------------------------

@tool
def search_company_news(company_name: str, query: Optional[str] = None) -> str:
    """
    Retrieve the latest company news, product launches, acquisitions,
    funding rounds, and leadership announcements using Google News API.

    Returns a JSON string with recent news_results, each optionally including
    related_stories for grouped news clusters.

    Args:
        company_name: The name of the company to get news for.
        query: Optional custom news query. Defaults to company_name.
    """
    news_q = query or company_name
    logger.info("[CompanyResearchTools] google_news: %s (q='%s')", company_name, news_q)
    emit_to_graph_stream(
        make_event(
            "company_research",
            "search_company_news",
            "running",
            {
                "tool": "search_company_news",
                "company": company_name,
                "message": f"Searching recent developments and news for {company_name}...",
            },
        )
    )

    result = _serpapi_search({
        "engine": "google_news",
        "q": news_q,
        "gl": "us",
        "hl": "en",
    })

    metadata = result.get("search_metadata", {})
    if metadata.get("status") == "Error" or "error" in result:
        err_msg = str(result.get("error") or "Failed to retrieve Google News results")
        emit_to_graph_stream(
            make_event(
                "company_research",
                "search_company_news",
                "failed",
                {
                    "tool": "search_company_news",
                    "company": company_name,
                    "error": err_msg,
                    "message": f"Google News search for {company_name} encountered an issue: {err_msg}",
                },
            )
        )
        return json.dumps({
            "status": "error",
            "search_metadata": metadata,
            "message": err_msg,
            "news_results": [],
        })

    news_results = []
    for idx, item in enumerate(result.get("news_results", [])[:10]):
        source = item.get("source")
        source_name = source.get("name") if isinstance(source, dict) else str(source or "")

        entry: dict[str, Any] = {
            "position": item.get("position", idx + 1),
            "title": item.get("title", ""),
            "link": item.get("link", ""),
            "source": source_name,
            "date": item.get("iso_date") or item.get("date", ""),
            "snippet": item.get("snippet", ""),
        }

        # Google News sometimes clusters related stories under a headline
        stories = item.get("stories", [])
        if stories:
            entry["related_stories"] = [
                {
                    "title": s.get("title", ""),
                    "link": s.get("link", ""),
                    "source": (s.get("source") or {}).get("name", "")
                    if isinstance(s.get("source"), dict)
                    else str(s.get("source", "")),
                    "date": s.get("iso_date") or s.get("date", ""),
                }
                for s in stories[:3]
                if s.get("title")
            ]

        news_results.append(entry)

    emit_to_graph_stream(
        make_event(
            "company_research",
            "search_company_news",
            "completed",
            {
                "tool": "search_company_news",
                "company": company_name,
                "status": "success",
                "message": f"Retrieved recent news and developments for {company_name}.",
                "news_count": len(news_results),
            },
        )
    )

    return json.dumps({
        "status": "success",
        "search_metadata": metadata,
        "query": news_q,
        "news_results": news_results,
    })


# ---------------------------------------------------------------------------
# Normalization Helper for Learning Context
# ---------------------------------------------------------------------------

def normalize_company_profile(
    company_name: str,
    search_data: Optional[dict] = None,
    news_data: Optional[dict] = None,
) -> dict[str, Any]:
    """
    Normalizes responses from Google Search and Google News into the
    canonical Learning Context schema for `task_context['company_profile']`.

    Output contract (do not rename keys — orchestrator and streaming bridge depend on them):
      - description, context_snippets    -> orchestrator success check
      - organic_results, recent_developments -> CLI display + downstream agents
      - knowledge_graph                  -> raw structured facts for LLM synthesis
    """
    search_data = search_data or {}
    news_data = news_data or {}

    kg = search_data.get("knowledge_graph", {})
    organic = search_data.get("organic_results", [])
    questions = search_data.get("related_questions", [])
    forums = search_data.get("discussions_and_forums", [])
    sitelinks = search_data.get("sitelinks", [])
    news = news_data.get("news_results", [])

    return {
        # Core identity — canonical keys read by orchestrator and downstream agents
        "name": kg.get("title") or company_name,
        "industry": kg.get("industry") or kg.get("type", ""),
        "type": kg.get("type", ""),
        "founded": kg.get("founded", ""),
        "headquarters": kg.get("headquarters", ""),
        "description": kg.get("description", ""),
        "website": kg.get("website", ""),
        "ceo": kg.get("ceo", ""),
        # Richer identity fields (present for larger / public companies)
        "employees": kg.get("employees", ""),
        "revenue": kg.get("revenue", ""),
        "parent_organization": kg.get("parent_organization", ""),
        "stock_ticker": kg.get("stock_ticker", ""),
        # Structured raw data for LLM synthesis
        "knowledge_graph": kg,
        "sitelinks": sitelinks,
        # Research evidence — top-level for LLM; also in context_snippets for orchestrator
        "organic_results": organic,
        "related_questions": questions,
        "discussions_and_forums": forums,
        "recent_developments": news,  # canonical key; avoids duplicate news_results key
        # Orchestrator reads context_snippets to determine success/partial status
        "context_snippets": {
            "organic_results": organic,
            "related_questions": questions,
            "discussions_and_forums": forums,
        },
    }


# ---------------------------------------------------------------------------
# Exported tool list used by CompanyResearchAgent (exactly 2 data sources)
# ---------------------------------------------------------------------------

COMPANY_RESEARCH_TOOLS = [
    search_company_overview,  # 1. Google Search API (facts, tech stack, culture, forums)
    search_company_news,      # 2. Google News API (recent developments)
]
