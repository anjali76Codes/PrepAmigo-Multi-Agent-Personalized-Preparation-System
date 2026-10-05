"""Tests never depend on the developer's .env: no real response/LLM
caches under .data/, and the default company-research mode and model.
config.Settings reads these at import time, and load_dotenv() does not
override variables that are already set."""
import os

os.environ.update({
    "ENABLE_AUTH": "false",
    "RESEARCH_CACHE_ENABLED": "false",
    "LLM_CACHE_ENABLED": "false",
    "COMPANY_RESEARCH_MODE": "agent",
    "COMPANY_RESEARCH_LLM": "default",
    "FAST_LLM_BASE_URL": "",
    "FAST_LLM_MODEL": "",
    "FAST_LLM_API_KEY": "",
    "CACHE_REPLAY_LATENCY": "false",
    "RESEARCH_JUDGE_LLM": "off",
    "SKILL_GAP_LLM": "default",
    "COMPANY_MODULE": "off",
    "SERPAPI_WEB_ENGINE": "google",
    "PLANNER_LLM": "default",
    "PLANNER_MODEL": "",
    "JOB_INTELLIGENCE_LLM": "default",
    "JOB_INTELLIGENCE_MODEL": "",
    "RESEARCH_MODEL": "",
    "RESEARCH_SCOPE_LLM": "off",
    "LLM_MAX_CONCURRENCY": "0",
    "RESEARCH_KINDS": "docs,videos,books,papers,repos",
    "EVALUATOR_LLM": "default",
    # the SerpApi-backed sources, which tests fake; the free catalogues
    # (Google Books, Open Library, arXiv) are real HTTP calls
    "BOOKS_SOURCE": "web",
    "PAPERS_SOURCE": "scholar",
})
