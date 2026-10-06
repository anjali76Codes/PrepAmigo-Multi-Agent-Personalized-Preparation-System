"""Behaviour when the model or network is slow or down: no invented skill
gaps, partial company research kept, and one-line logs for expected
failures."""
import asyncio
import dataclasses
import logging

import agents.interview_prep_orchestrator as orchestrator_module
import agents.skill_gap_agent as skill_gap_module
from agents.interview_prep_orchestrator import InterviewPrepOrchestrator
from agents.skill_gap_agent import SkillGapAgent, _rank_and_score
from core.config import Settings
from observability.timing import log_failure

REQUIRED = [{"name": "Python"}, {"name": "REST APIs"}]


def test_no_job_requirements_means_no_gaps_and_no_model_calls(monkeypatch):
    """With an empty requirement list the model graded the resume's own
    skills, and the plan then taught what the candidate already knew."""
    async def forbidden(*_args, **_kwargs):
        raise AssertionError("the model must not be asked to grade against nothing")

    monkeypatch.setattr(skill_gap_module, "_call_llm_json", forbidden)

    report = asyncio.run(SkillGapAgent().analyze({}, {"skills": []}, "Python, Redis, Vue.js", "Acme", "SWE"))

    assert report["priority_gaps"] == [] and report["no_requirements"] is True


def test_only_required_skills_can_become_gaps():
    report = _rank_and_score({"skill_evaluations": [
        {"skill_name": "Python", "status": "strong"},
        {"skill_name": "REST API", "status": "missing"},   # reworded requirement: kept
        {"skill_name": "Vue.js", "status": "partial"},     # from the resume, not required: dropped
        {"skill_name": "python", "status": "missing"},     # duplicate: dropped
    ]}, REQUIRED)

    assert [g["skill"] for g in report["priority_gaps"]] == ["REST API"]
    assert report["readiness_score"] == 50


def test_company_research_timeout_keeps_the_profile_gathered_so_far(monkeypatch):
    monkeypatch.setattr(orchestrator_module, "settings",
                        Settings(interview_prep_branch_timeout_seconds=0.1, llm_max_concurrency=1))

    class SlowCompanyGraph:
        async def astream(self, _inputs, config, stream_mode):
            yield (
                "values",
                {"messages": [], "task_context": {"company_profile": {"name": "Acme", "description": "Makes anvils"}}},
            )
            await asyncio.sleep(5)  # the model's closing turn never arrives

    class JobAgent:
        async def __call__(self, _state):
            return {"job_intelligence_result": {"status": "success", "data": {"skills": REQUIRED}, "error": None}}

    node = InterviewPrepOrchestrator(company_graph=SlowCompanyGraph(), job_agent=JobAgent())
    result = asyncio.run(node.run_parallel(
        {"interview_prep_input": {"company": "Acme", "role": "SWE", "location": "Remote"}}))

    company = result["company_research_result"]
    assert company["status"] == "partial"
    assert company["data"]["profile"]["description"] == "Makes anvils"


def test_timeouts_log_one_line_and_bugs_keep_their_traceback(caplog):
    logger = logging.getLogger("test")
    with caplog.at_level(logging.WARNING):
        log_failure(logger, "step failed", asyncio.TimeoutError())
        log_failure(logger, "step failed", KeyError("days"))

    timeout, bug = caplog.records
    assert timeout.getMessage() == "step failed (timed out)" and timeout.exc_info is None
    assert bug.exc_info is not None


def test_a_slow_job_search_falls_back_to_standard_role_requirements(monkeypatch):
    """It used to fail the whole stage, which left the plan with nothing
    to compare the resume against."""
    import time

    import agents.job_intelligence_agent as job_module

    searches = []

    def slow_search(query, location):
        searches.append(query)
        time.sleep(0.5)
        return {"jobs_results": []}

    async def extraction(postings, role="", company="", **_kwargs):
        assert postings == []
        return {"skills": [{"name": "Python", "category": "Languages", "priority": "must_have"}],
                "coverage": "medium"}

    monkeypatch.setattr(job_module, "settings", Settings(research_tool_timeout_seconds=0.1))
    monkeypatch.setattr(job_module, "fetch_google_jobs", slow_search)
    monkeypatch.setattr(job_module, "extract_with_llm", extraction)
    monkeypatch.setattr(job_module, "get_db", lambda: None)

    result = asyncio.run(job_module.JobIntelligenceAgent()(
        {"job_intelligence_input": {"company": "Acme", "role": "SWE", "location": "Remote"}}))

    profile = result["job_intelligence_result"]["data"]
    assert [s["name"] for s in profile["skills"]] == ["Python"]
    assert profile["isFallback"] and "timed out" in profile["fallbackReason"]
    assert searches == ["Acme SWE"]  # no second search while the provider is slow


# ---- skill gap: one small call, with a resume-text fallback ---------------------

RESUME = "Built REST APIs in Python at Acme. Skills: Python, Docker, SQL."
JOB = {"skills": [
    {"name": "Kubernetes", "priority": "nice_to_have"},
    {"name": "Python", "priority": "must_have"},
    {"name": "REST APIs", "priority": "must_have"},
    {"name": "Terraform", "priority": "must_have"},
]}


def _analyze(monkeypatch, answer, job=JOB, **settings_overrides):
    prompts = []

    async def fake_call(prompt, fallback):
        prompts.append(prompt)
        return fallback if answer is None else answer

    monkeypatch.setattr(skill_gap_module, "_call_llm_json", fake_call)
    if settings_overrides:
        monkeypatch.setattr(skill_gap_module, "settings", Settings(**settings_overrides))
    report = asyncio.run(SkillGapAgent().analyze({}, job, RESUME, "Acme", "SWE"))
    return report, prompts


def test_skill_gap_is_one_model_call_that_asks_only_for_verdicts(monkeypatch):
    report, prompts = _analyze(monkeypatch, {"evaluations": [
        {"skill": "Python", "status": "strong", "evidence": "REST APIs in Python at Acme"},
        {"skill": "REST API", "status": "strong", "evidence": "built REST APIs"},      # reworded name
        {"skill": "Terraform", "status": "missing", "evidence": ""},
        {"skill": "Kubernetes", "status": "missing", "evidence": ""},
        {"skill": "Docker", "status": "partial", "evidence": "listed"},               # not required: ignored
    ]})

    assert len(prompts) == 1 and RESUME in prompts[0]
    # must-have skills are asked about (and ranked) before nice-to-have ones
    assert '["Python", "REST APIs", "Terraform", "Kubernetes"]' in prompts[0]
    assert [g["skill"] for g in report["priority_gaps"]] == ["Terraform", "Kubernetes"]
    assert report["readiness_score"] == 50 and report["evaluation_source"] == "llm"


def test_no_model_answer_falls_back_to_the_resume_text_instead_of_no_gaps(monkeypatch):
    """A slow model used to leave the run with zero gaps and no plan."""
    report, _ = _analyze(monkeypatch, None)

    assert report["evaluation_source"] == "resume_text"
    by_skill = {g["skill"]: g["status"] for g in report["priority_gaps"]}
    # named in the resume = partial (never "strong" without reading evidence)
    assert by_skill == {"Terraform": "missing", "Kubernetes": "missing", "Python": "partial", "REST APIs": "partial"}
    assert [g["skill"] for g in report["priority_gaps"]][:2] == ["Terraform", "Kubernetes"]


def test_skills_the_model_skipped_are_judged_from_the_resume_text(monkeypatch):
    report, _ = _analyze(monkeypatch, {"evaluations": [{"skill": "Python", "status": "strong", "evidence": "x"}]})

    assert report["evaluation_source"] == "llm+resume_text"
    assert {g["skill"] for g in report["priority_gaps"]} == {"REST APIs", "Terraform", "Kubernetes"}


def test_the_skills_compared_are_capped_must_have_first(monkeypatch):
    report, prompts = _analyze(monkeypatch, None, skill_gap_max_skills=2)

    assert '["Python", "REST APIs"]' in prompts[0]
    assert report["skills_evaluated"] == 2


def test_evaluator_can_be_switched_off(monkeypatch):
    def forbidden(*_args, **_kwargs):
        raise AssertionError("EVALUATOR_LLM=off must not call a model")

    monkeypatch.setattr(orchestrator_module, "get_llm", forbidden)
    monkeypatch.setattr(orchestrator_module, "settings", Settings(evaluator_llm="off"))
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object())

    result = asyncio.run(node.evaluate({
        "company_research_result": {"status": "success", "data": {"profile": {"name": "Acme"}}},
        "job_intelligence_result": {"status": "success", "data": {"skills": [{"name": "Python"}]}},
    }))

    assert result["workflow_status"] == "complete"
    assert result["interview_prep_result"]["summary"].startswith("Both company research")


# ---- rate limits, slow searches, switched-off resource kinds ----------------------

def test_a_rate_limited_fast_model_hands_the_call_to_the_main_model(monkeypatch):
    """Groq's free tier allows 1,000 output tokens a minute; the planner
    alone writes twice that. A 429 must cost speed, never the answer."""
    import dataclasses

    from core import config
    from langchain_core.language_models.fake_chat_models import FakeListChatModel

    monkeypatch.setattr(config, "settings", dataclasses.replace(
        config.settings, fast_llm_base_url="https://fast.example/v1", fast_llm_model="fast-model",
        fast_llm_api_key="k", llm_provider="ollama"))
    llm = config.get_llm(temperature=0, max_tokens=300, profile="fast", model="small-main-model")

    budgeted, (main,) = llm.runnable, llm.fallbacks
    fast = budgeted.chat_model  # inside the rate budget (core/rate_budget.py)
    assert (fast.model_name, fast.max_retries) == ("fast-model", 0)  # no backoff before falling back
    assert fast.include_response_headers  # x-ratelimit-* headers reach the budget
    assert main.model == "small-main-model"  # the agent's own *_MODEL, on the main provider

    class RateLimited(FakeListChatModel):
        async def _agenerate(self, *args, **kwargs):
            raise RuntimeError("429 rate limit reached: output tokens per minute")

    routed = RateLimited(responses=["x"]).with_fallbacks([FakeListChatModel(responses=["from the main model"])])
    assert asyncio.run(routed.ainvoke("plan days 1-5")).content == "from the main model"


def test_a_hanging_serpapi_search_is_cut_off_and_retried(monkeypatch):
    import sys
    import types

    import tools.serpapi_client as serpapi_client

    attempts = []

    class Search:
        def __init__(self, params):
            self.timeout = 60000

        def get_dict(self):
            attempts.append(self.timeout)
            if len(attempts) == 1:
                raise TimeoutError("HTTPSConnectionPool(host='serpapi.com'): Read timed out.")
            return {"organic_results": [{"title": "ok"}]}

    monkeypatch.setitem(sys.modules, "serpapi", types.SimpleNamespace(GoogleSearch=Search))
    monkeypatch.setattr(serpapi_client, "settings", Settings(
        serpapi_api_key="k", serpapi_enabled=True, serpapi_attempt_timeout_seconds=8, serpapi_max_attempts=2))
    monkeypatch.setattr(serpapi_client, "get_response_cache", lambda: None)

    result = serpapi_client.serpapi_search({"engine": "google", "q": "x"})

    assert result["organic_results"] == [{"title": "ok"}]
    assert attempts == [8, 8]  # each attempt bounded; the library's default is effectively no timeout


def test_a_search_that_keeps_hanging_fails_after_the_last_attempt(monkeypatch):
    import sys
    import types

    import pytest
    import tools.serpapi_client as serpapi_client

    class Search:
        def __init__(self, params):
            pass

        def get_dict(self):
            raise TimeoutError("Read timed out.")

    monkeypatch.setitem(sys.modules, "serpapi", types.SimpleNamespace(GoogleSearch=Search))
    monkeypatch.setattr(serpapi_client, "settings", Settings(serpapi_api_key="k", serpapi_enabled=True))
    monkeypatch.setattr(serpapi_client, "get_response_cache", lambda: None)

    with pytest.raises(RuntimeError, match="SerpApi request failed"):
        serpapi_client.serpapi_search({"engine": "google", "q": "x"})


def test_resource_kinds_can_be_switched_off_for_every_topic(monkeypatch):
    import agents.research_agent as research_module
    from agents.research_agent import ContentResearchAgent, ResearchRequest
    from memory.local_adapter import LocalMemoryProvider
    from test_research_agent import FakeLLM, fake_tools

    monkeypatch.setattr(research_module, "settings", Settings(research_kinds="docs,videos"))
    tools = fake_tools()
    agent = ContentResearchAgent(llm=FakeLLM(), memory=LocalMemoryProvider(), tools=tools)
    asyncio.run(agent.run(ResearchRequest(user_id="u1", target_role="SWE", target_company="Acme",
                                          topic_or_skill_gap="Dynamic Programming"), memories=[]))

    assert (len(tools["docs"].calls), len(tools["videos"].calls)) == (1, 1)
    assert tools["books"].calls == [] and tools["papers"].calls == []


def test_serpapi_requests_are_limited_to_a_few_at_a_time(monkeypatch):
    import sys
    import threading
    import time
    import types
    from concurrent.futures import ThreadPoolExecutor

    import tools.serpapi_client as serpapi_client

    state = {"active": 0, "peak": 0}
    lock = threading.Lock()

    class Search:
        def __init__(self, params):
            pass

        def get_dict(self):
            with lock:
                state["active"] += 1
                state["peak"] = max(state["peak"], state["active"])
            time.sleep(0.05)
            with lock:
                state["active"] -= 1
            return {"organic_results": []}

    monkeypatch.setitem(sys.modules, "serpapi", types.SimpleNamespace(GoogleSearch=Search))
    monkeypatch.setattr(serpapi_client, "settings", Settings(
        serpapi_api_key="k", serpapi_enabled=True, serpapi_max_concurrency=2))
    monkeypatch.setattr(serpapi_client, "get_response_cache", lambda: None)

    with ThreadPoolExecutor(8) as pool:
        list(pool.map(lambda i: serpapi_client.serpapi_search({"engine": "google", "q": f"q{i}"}), range(8)))

    assert state["peak"] == 2


class _AsyncSearch:
    """A SerpApi search submitted with async=true: the submit answers at once
    with an id; the archive says "Processing" `polls_needed` times, then has
    the result."""
    submitted: list[dict] = []
    polls: list[str] = []
    polls_needed = 2

    def __init__(self, params):
        self.params = dict(params)
        self.timeout = 60000

    def get_dict(self):
        type(self).submitted.append(self.params)
        assert self.params.get("async") == "true"
        return {"search_metadata": {"id": f"id-{len(type(self).submitted)}", "status": "Processing"}}

    def get_search_archive(self, search_id):
        type(self).polls.append(search_id)
        if len(type(self).polls) <= type(self).polls_needed:
            return {"search_metadata": {"id": search_id, "status": "Processing"}}
        return {"search_metadata": {"id": search_id, "status": "Success"}, "organic_results": [{"title": "ok"}]}


def _async_serpapi(monkeypatch, polls_needed=2, **overrides):
    import sys
    import types

    import tools.serpapi_client as serpapi_client

    search = type("Search", (_AsyncSearch,), {"submitted": [], "polls": [], "polls_needed": polls_needed})
    monkeypatch.setitem(sys.modules, "serpapi", types.SimpleNamespace(GoogleSearch=search))
    monkeypatch.setattr(serpapi_client, "settings", Settings(
        serpapi_api_key="k", serpapi_enabled=True, serpapi_async=True, **overrides))
    monkeypatch.setattr(serpapi_client, "get_response_cache", lambda: None)
    monkeypatch.setattr(serpapi_client, "POLL_FIRST_SECONDS", 0.01)
    monkeypatch.setattr(serpapi_client, "POLL_MIN_SECONDS", 0.01)
    monkeypatch.setattr(serpapi_client, "POLL_MAX_SECONDS", 0.01)
    # archive reads go through read_archive (only the key is sent)
    monkeypatch.setattr(serpapi_client, "read_archive",
                        lambda search_id, timeout: search({}).get_search_archive(search_id))
    return serpapi_client, search


def test_a_slow_search_is_waited_for_and_paid_for_once(monkeypatch):
    """A timed-out request was still run (and charged) by SerpApi, and the
    retry was a second paid search from zero. Async: one submit, free polls."""
    serpapi_client, search = _async_serpapi(monkeypatch, polls_needed=3)

    result = serpapi_client.serpapi_search({"engine": "google", "q": "x"})

    assert result["organic_results"] == [{"title": "ok"}]
    assert len(search.submitted) == 1 and search.polls == ["id-1"] * 4


def test_an_async_search_gives_up_at_its_deadline_without_resubmitting(monkeypatch):
    import pytest

    serpapi_client, search = _async_serpapi(monkeypatch, polls_needed=10**6, serpapi_result_timeout_seconds=0.1)

    with pytest.raises(TimeoutError, match="did not finish in 0.1s"):
        serpapi_client.serpapi_search({"engine": "google", "q": "x"})
    assert len(search.submitted) == 1


def test_a_running_async_search_does_not_hold_a_request_slot(monkeypatch):
    """One slow search used to keep a slot for 8s while the rest queued."""
    import time
    from concurrent.futures import ThreadPoolExecutor

    serpapi_client, search = _async_serpapi(monkeypatch, polls_needed=0, serpapi_max_concurrency=1)
    original = search.get_search_archive
    started = []

    def slow_archive(self, search_id):
        started.append(search_id)
        time.sleep(0.2)  # the search is still running on SerpApi's side
        return original(self, search_id)

    monkeypatch.setattr(search, "get_search_archive", slow_archive)
    begin = time.monotonic()
    with ThreadPoolExecutor(4) as pool:
        list(pool.map(lambda i: serpapi_client.serpapi_search({"engine": "google", "q": f"q{i}"}), range(4)))

    assert time.monotonic() - begin < 0.6  # 4 x 0.2s, overlapping despite one slot
    assert len(search.submitted) == 4


def test_no_cache_runs_never_use_async(monkeypatch):
    """SerpApi does not accept async with no_cache."""
    import sys
    import types

    from tools.cache import bypass_caches

    serpapi_client, _ = _async_serpapi(monkeypatch)
    seen = []

    class Search:
        def __init__(self, params):
            seen.append(params)

        def get_dict(self):
            return {"organic_results": []}

    monkeypatch.setitem(sys.modules, "serpapi", types.SimpleNamespace(GoogleSearch=Search))
    bypass_caches()
    try:
        serpapi_client.serpapi_search({"engine": "google", "q": "x"})
    finally:
        bypass_caches(False)

    assert seen[0]["no_cache"] == "true" and "async" not in seen[0]


def test_research_covers_only_the_gaps_the_plan_has_room_for(monkeypatch):
    """A 10-day plan has room for 3 topics (3 days each at least): research
    used to run for 6 gaps and pay for 3 that were never planned."""
    from agents.interview_prep_orchestrator import plannable_gaps

    gaps = [{"skill": f"Skill {i}", "effort": "High" if i < 4 else "Medium"} for i in range(8)]
    names = [g["skill"] for g in gaps]
    base = Settings(plan_max_topics=6, plan_min_days_per_topic=3, company_module="off")
    monkeypatch.setattr(orchestrator_module, "settings", base)

    assert plannable_gaps(names, gaps, 10) == {"Skill 0", "Skill 1", "Skill 2"}
    assert plannable_gaps(names, gaps, 45) == {f"Skill {i}" for i in range(6)}
    assert plannable_gaps(names, gaps, 90) == {f"Skill {i}" for i in range(6)}  # PLAN_MAX_TOPICS

    # the company-platform module takes the plan's first slot
    monkeypatch.setattr(orchestrator_module, "settings", dataclasses.replace(base, company_module="on"))
    assert plannable_gaps(names, gaps, 10) == {"Skill 0", "Skill 1"}


def test_a_no_cache_search_that_times_out_is_collected_async_not_bought_again(monkeypatch):
    """--no-cache: the first attempt waits on a no_cache request; its retry
    is submitted async (SerpApi refuses async with no_cache) and polled,
    instead of a second cut-off request and a failure."""
    import sys
    import types

    from tools.cache import bypass_caches

    serpapi_client, _ = _async_serpapi(monkeypatch)
    sent, polls = [], []

    class Search:
        def __init__(self, params):
            self.params = dict(params)

        def get_dict(self):
            sent.append(self.params)
            if "no_cache" in self.params:
                raise TimeoutError("Read timed out. (read timeout=8.0)")
            return {"search_metadata": {"id": "s1", "status": "Processing"}}

        def get_search_archive(self, search_id):
            polls.append(search_id)
            return {"search_metadata": {"id": search_id, "status": "Success"}, "organic_results": [{"title": "ok"}]}

    monkeypatch.setitem(sys.modules, "serpapi", types.SimpleNamespace(GoogleSearch=Search))
    monkeypatch.setattr(serpapi_client, "read_archive", lambda search_id, timeout: Search({}).get_search_archive(search_id))
    bypass_caches()
    try:
        result = serpapi_client.serpapi_search({"engine": "google", "q": "x"})
    finally:
        bypass_caches(False)

    assert result["organic_results"] == [{"title": "ok"}]
    assert [("no_cache" in p, "async" in p) for p in sent] == [(True, False), (False, True)]
    assert polls == ["s1"]


def test_an_async_answer_without_results_is_read_from_the_archive_not_cached_empty(monkeypatch):
    import sys
    import types

    serpapi_client, _ = _async_serpapi(monkeypatch)

    class Search:
        def __init__(self, params):
            pass

        def get_dict(self):
            return {"search_metadata": {"id": "s2", "status": "Success"}, "search_parameters": {}}

        def get_search_archive(self, search_id):
            return {"search_metadata": {"id": search_id, "status": "Success"}, "organic_results": [{"title": "ok"}]}

    monkeypatch.setitem(sys.modules, "serpapi", types.SimpleNamespace(GoogleSearch=Search))
    monkeypatch.setattr(serpapi_client, "read_archive", lambda search_id, timeout: Search({}).get_search_archive(search_id))

    assert serpapi_client.serpapi_search({"engine": "google", "q": "x"})["organic_results"] == [{"title": "ok"}]


def test_an_empty_serpapi_account_stops_further_searches_but_not_the_cache(monkeypatch, tmp_path):
    """"Your account has run out of searches." came back 33 times in one run,
    with tracebacks: after the first, nothing more is sent."""
    import sys
    import types

    import pytest

    import tools.serpapi_client as serpapi_client
    from tools.cache import ResponseCache

    sent = []

    class Search:
        def __init__(self, params):
            sent.append(params)

        def get_dict(self):
            return {"error": "Your account has run out of searches."}

    cache = ResponseCache(tmp_path)
    cache.set("serpapi", {"engine": "youtube", "search_query": "cached"}, {"video_results": [{"title": "kept"}]})
    monkeypatch.setitem(sys.modules, "serpapi", types.SimpleNamespace(GoogleSearch=Search))
    monkeypatch.setattr(serpapi_client, "settings", Settings(serpapi_api_key="k", serpapi_enabled=True,
                                                             serpapi_async=False))
    monkeypatch.setattr(serpapi_client, "get_response_cache", lambda: cache)

    first = serpapi_client.serpapi_search({"engine": "google", "q": "a"})
    assert first["error"].startswith("Your account has run out")
    with pytest.raises(serpapi_client.SearchUnavailable, match="run out of searches"):
        serpapi_client.serpapi_search({"engine": "youtube", "search_query": "b"})
    assert len(sent) == 1  # the second search never went out
    # what is already cached still answers
    assert serpapi_client.serpapi_search({"engine": "youtube", "search_query": "cached"})["video_results"] == [{"title": "kept"}]


def test_outages_log_one_line_not_a_traceback(caplog):
    from observability.timing import log_failure
    from tools.serpapi_client import SearchUnavailable

    with caplog.at_level(logging.WARNING):
        log_failure(logging.getLogger("t"), "Company Research branch failed", SearchUnavailable("out of searches"))
    assert caplog.records[-1].exc_info is None
