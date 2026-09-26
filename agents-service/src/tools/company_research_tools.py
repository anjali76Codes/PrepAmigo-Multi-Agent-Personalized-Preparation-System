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

logger = logging.getLogger(__name__)


def _serpapi_search(params: dict) -> dict:
    """
    Shared SerpApi request helper.
    Injects the api_key and returns the parsed JSON response dict.
    Fails gracefully by returning an error dictionary if the request fails
    or if SerpApi reports an error, ensuring the graph node does not crash.
    """
    if not settings.serpapi_api_key:
        logger.error("[CompanyResearchTools] SERPAPI_API_KEY is not configured.")
        return {
            "search_metadata": {"status": "Error"},
            "error": "SERPAPI_API_KEY is not configured in environment.",
        }

    try:
        from serpapi import GoogleSearch  # type: ignore

        params["api_key"] = settings.serpapi_api_key
        result = GoogleSearch(params).get_dict()
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

    return result


# ---------------------------------------------------------------------------
# Tool 1 — Google Search (Primary: facts, tech stack, culture, discussions)
# ---------------------------------------------------------------------------

@tool
def search_company_overview(company_name: str, query: Optional[str] = None) -> str:
    """
    Search for a company's products, engineering culture, technology stack,
    facts, related questions, and community forum discussions using Google Search API.

    Returns a JSON string containing knowledge_graph, organic_results,
    related_questions, and discussions_and_forums.

    Args:
        company_name: The name of the company to research (e.g. 'Stripe', 'Datadog').
        query: Optional custom search query. If omitted, defaults to
               '{company_name} engineering blog tech stack culture overview'.
    """
    search_q = query or f"{company_name} engineering blog tech stack culture overview"
    logger.info("[CompanyResearchTools] google_search: %s (q='%s')", company_name, search_q)

    result = _serpapi_search({
        "engine": "google",
        "q": search_q,
        "num": 10,
        "hl": "en",
        "gl": "us",
    })

    metadata = result.get("search_metadata", {})
    if metadata.get("status") == "Error" or "error" in result:
        return json.dumps({
            "status": "error",
            "search_metadata": metadata,
            "message": result.get("error", "Failed to retrieve Google Search results"),
            "knowledge_graph": {},
            "organic_results": [],
            "related_questions": [],
            "discussions_and_forums": [],
        })

    # 1. Structured facts from knowledge_graph
    kg_raw = result.get("knowledge_graph", {})
    knowledge_graph = {}
    if kg_raw:
        knowledge_graph = {
            "title": kg_raw.get("title", company_name),
            "type": kg_raw.get("type") or kg_raw.get("entity_type", ""),
            "industry": kg_raw.get("type") or kg_raw.get("industry", ""),
            "founded": kg_raw.get("founded", ""),
            "headquarters": kg_raw.get("headquarters", ""),
            "description": kg_raw.get("description", ""),
            "website": kg_raw.get("website", ""),
            "ceo": kg_raw.get("ceo", ""),
        }

    # 2. Organic results (tech stack, engineering blogs, documentation)
    organic_results = [
        {
            "position": r.get("position", idx + 1),
            "title": r.get("title", ""),
            "link": r.get("link", ""),
            "snippet": r.get("snippet", ""),
        }
        for idx, r in enumerate(result.get("organic_results", [])[:10])
    ]

    # 3. Related questions (candidate expectations, culture signals)
    related_questions = [
        {
            "question": q.get("question", ""),
            "snippet": q.get("snippet", ""),
        }
        for q in result.get("related_questions", [])[:5]
    ]

    # 4. Discussions and forums (Reddit/Blind-style chatter)
    discussions_and_forums = [
        {
            "title": d.get("title", ""),
            "link": d.get("link", ""),
            "source": d.get("source", "Forum"),
        }
        for d in result.get("discussions_and_forums", [])[:5]
    ]

    return json.dumps({
        "status": "success",
        "search_metadata": metadata,
        "query": search_q,
        "knowledge_graph": knowledge_graph,
        "organic_results": organic_results,
        "related_questions": related_questions,
        "discussions_and_forums": discussions_and_forums,
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

    Returns a JSON string with recent news_results.

    Args:
        company_name: The name of the company to get news for.
        query: Optional custom news query. Defaults to company_name.
    """
    news_q = query or company_name
    logger.info("[CompanyResearchTools] google_news: %s (q='%s')", company_name, news_q)

    result = _serpapi_search({
        "engine": "google_news",
        "q": news_q,
        "gl": "us",
        "hl": "en",
    })

    metadata = result.get("search_metadata", {})
    if metadata.get("status") == "Error" or "error" in result:
        return json.dumps({
            "status": "error",
            "search_metadata": metadata,
            "message": result.get("error", "Failed to retrieve Google News results"),
            "news_results": [],
        })

    news_results = []
    for idx, item in enumerate(result.get("news_results", [])[:10]):
        source = item.get("source")
        source_name = source.get("name") if isinstance(source, dict) else str(source or "")
        news_results.append({
            "position": item.get("position", idx + 1),
            "title": item.get("title", ""),
            "link": item.get("link", ""),
            "source": source_name,
            "date": item.get("iso_date") or item.get("date", ""),
            "snippet": item.get("snippet", ""),
        })

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

    Maps:
      - knowledge_graph -> company profile structured fields
      - organic_results, related_questions, discussions_and_forums -> context_snippets
      - news_results -> recent_developments
    """
    search_data = search_data or {}
    news_data = news_data or {}

    kg = search_data.get("knowledge_graph", {})
    organic = search_data.get("organic_results", [])
    questions = search_data.get("related_questions", [])
    forums = search_data.get("discussions_and_forums", [])
    news = news_data.get("news_results", [])

    return {
        "name": kg.get("title") or company_name,
        "industry": kg.get("industry") or kg.get("type", ""),
        "type": kg.get("type", ""),
        "founded": kg.get("founded", ""),
        "headquarters": kg.get("headquarters", ""),
        "description": kg.get("description", ""),
        "website": kg.get("website", ""),
        "ceo": kg.get("ceo", ""),
        "knowledge_graph": kg,
        "context_snippets": {
            "organic_results": organic,
            "related_questions": questions,
            "discussions_and_forums": forums,
        },
        "organic_results": organic,
        "related_questions": questions,
        "discussions_and_forums": forums,
        "recent_developments": news,
        "news_results": news,
    }


# ---------------------------------------------------------------------------
# Exported tool list used by CompanyResearchAgent (exactly 2 data sources)
# ---------------------------------------------------------------------------

COMPANY_RESEARCH_TOOLS = [
    search_company_overview,  # 1. Google Search API (facts, tech stack, culture, forums)
    search_company_news,      # 2. Google News API (recent developments)
]
