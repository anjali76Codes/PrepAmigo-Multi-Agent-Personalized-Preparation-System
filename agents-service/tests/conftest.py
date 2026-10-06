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
    # never a live SerpApi request from a test: tests that exercise the
    # client set a fake key and a fake library themselves
    "SERPAPI_API_KEY": "",
    "SERPAPI_ASYNC": "true",
    "SERPAPI_RESULT_TIMEOUT_SECONDS": "15",
    "PLAN_GAP_SEARCHES": "auto",
    "LLM_RESCUE_SECONDS": "20",
    # test runs stay out of the developer's .data/logs/agents-service.log
    "LOG_FILE": "",
    # the fast model's rate budget: no day totals written under .data/
    "FAST_LLM_BUDGET_FILE": "",
    "PLANNER_LLM": "default",
    "PLANNER_MODEL": "",
    "JOB_INTELLIGENCE_LLM": "default",
    "JOB_INTELLIGENCE_MODEL": "",
    "RESEARCH_MODEL": "",
    "RESEARCH_LLM": "default",
    "FAST_LLM_KEY_POOL": "off",
    "FAST_LLM_API_KEYS": "",
    "RESEARCH_SCOPE_LLM": "off",
    "LLM_MAX_CONCURRENCY": "0",
    "RESEARCH_KINDS": "docs,videos,books,papers,repos",
    "EVALUATOR_LLM": "default",
    # the SerpApi-backed sources, which tests fake; the free catalogues
    # (Google Books, Open Library, arXiv) are real HTTP calls
    "BOOKS_SOURCE": "web",
    "PAPERS_SOURCE": "scholar",
})


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_model_health():
    """The slow-model circuit breaker is process-wide: no test inherits
    another's "degraded" verdict."""
    from core.rate_budget import reset_budgets
    from observability import llm_health
    from tools.serpapi_client import reset_account_state

    llm_health.reset()
    reset_budgets()
    reset_account_state()
    yield
    llm_health.reset()
    reset_budgets()
    reset_account_state()
