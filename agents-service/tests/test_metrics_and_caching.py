"""Run metrics (per-agent time/tokens/cache), the shared response cache,
the SerpApi-boundary cache, the LLM response cache, and the research
pipeline's no-barrier scheduling."""
import asyncio
import sys
import time
import types

from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import AIMessage

import tools.serpapi_client as serpapi_client
from agents.research_agent import ContentResearchAgent, ResearchRequest
from core.config import Settings
from memory.local_adapter import LocalMemoryProvider
from observability.metrics import (
    METRICS_CALLBACK,
    _union,
    agent_scope,
    collect_metrics,
    format_report,
    record_tool,
    track_tool,
)
from storage.llm_cache import LLMResponseCache, forget_response
from test_research_agent import fake_tools
from tools.cache import ResponseCache, cached_fetch

_real_time = time.time


# ---- metrics ----------------------------------------------------------------

def test_overlapping_intervals_are_counted_once():
    assert _union([(0, 2), (1, 3), (5, 6)]) == 4
    assert _union([]) == 0


def test_calls_are_attributed_to_the_enclosing_agent_across_tasks_and_threads():
    async def scenario():
        with agent_scope("research"):
            def in_thread():
                with track_tool("serpapi:google"):
                    time.sleep(0.01)
            await asyncio.gather(asyncio.to_thread(in_thread), asyncio.to_thread(in_thread))
        with agent_scope("planner"):
            record_tool("x", 0.0, 0.0)

    with collect_metrics() as run:
        asyncio.run(scenario())

    summary = run.summary()
    assert summary["agents"]["research"]["tool_calls"] == 2
    # two parallel ~10ms calls: tool time is their overlap, not their sum
    assert summary["agents"]["research"]["tool_s"] < 0.02 + 0.01
    assert summary["agents"]["planner"]["tool_calls"] == 1


def test_nothing_is_recorded_outside_a_collected_run():
    record_tool("x", 0.0, 1.0)  # must not raise or leak into a later run
    with collect_metrics() as run:
        pass
    assert run.calls == []


def test_llm_calls_record_tokens_peak_context_and_cache_hits(tmp_path):
    class UsageModel(FakeListChatModel):
        async def _agenerate(self, messages, stop=None, run_manager=None, **kwargs):
            result = await super()._agenerate(messages, stop=stop, run_manager=run_manager, **kwargs)
            result.generations[0].message.usage_metadata = {
                "input_tokens": 120, "output_tokens": 30, "total_tokens": 150}
            return result

    async def scenario(model):
        with agent_scope("skill_gap"):
            await model.ainvoke("analyze")
            await model.ainvoke("analyze")  # served from cache

    model = UsageModel(responses=["first", "second"], callbacks=[METRICS_CALLBACK],
                       cache=LLMResponseCache(ResponseCache(tmp_path), "fake:model", 0))
    with collect_metrics() as run:
        asyncio.run(scenario(model))

    row = run.summary()["agents"]["skill_gap"]
    assert row["llm_calls"] == 2 and row["llm_cache_hits"] == 1
    assert (row["input_tokens"], row["output_tokens"]) == (120, 30)  # the hit spent nothing
    assert row["tokens_saved"] == 150
    assert row["peak_context_tokens"] == 120


def test_report_has_one_row_per_agent_and_a_total():
    with collect_metrics() as run:
        with agent_scope("company_research"):
            record_tool("serpapi:google", 0.0, 1.5)
            record_tool("serpapi:google", 2.0, 2.001, cache_hit=True, saved_ms=1500)
    lines = format_report(run.summary())

    assert lines[2].startswith("company_research")
    assert any(line.startswith("TOTAL") for line in lines)
    assert "2 (1c)" in lines[2]


# ---- response cache -----------------------------------------------------------

def test_cached_fetch_stores_the_original_latency_and_reports_it_on_a_hit(tmp_path):
    cache = ResponseCache(tmp_path)

    def slow():
        time.sleep(0.05)
        return {"ok": True}

    with collect_metrics() as run:
        first = cached_fetch(cache, "serpapi", {"q": "x"}, slow, label="serpapi:google")
        second = cached_fetch(cache, "serpapi", {"q": "x"}, lambda: 1 / 0, label="serpapi:google")

    assert first == second == {"ok": True}
    miss, hit = run.calls
    assert not miss.cache_hit and miss.ms >= 50
    assert hit.cache_hit and hit.saved_ms >= 50 and hit.ms < 50
    assert cache.get_entry("serpapi", {"q": "x"})["latency_ms"] >= 50


def test_rejected_responses_are_not_cached(tmp_path):
    cache = ResponseCache(tmp_path)
    cached_fetch(cache, "serpapi", {"q": "x"}, lambda: {"error": "quota"},
                 should_store=lambda r: not r.get("error"))
    assert cache.get("serpapi", {"q": "x"}) is None


def test_per_call_ttl_overrides_the_default(tmp_path, monkeypatch):
    cache = ResponseCache(tmp_path, ttl_seconds=0)
    cache.set("serpapi", {"q": "news"}, {"n": 1})
    monkeypatch.setattr(time, "time", lambda: _real_time() + 100)  # 100s later

    assert cache.get("serpapi", {"q": "news"}) == {"n": 1}  # default: never expires
    assert cache.get("serpapi", {"q": "news"}, ttl_seconds=50) is None


# ---- SerpApi boundary ---------------------------------------------------------

def _live_serpapi(monkeypatch, tmp_path, responses):
    calls = []

    class FakeSearch:
        def __init__(self, params):
            calls.append(params)
            self.params = params

        def get_dict(self):
            return responses(self.params)

    monkeypatch.setitem(sys.modules, "serpapi", types.SimpleNamespace(GoogleSearch=FakeSearch))
    monkeypatch.setattr(serpapi_client, "settings", Settings(serpapi_api_key="k", serpapi_enabled=True))
    cache = ResponseCache(tmp_path)
    monkeypatch.setattr(serpapi_client, "get_response_cache", lambda: cache)
    return calls


def test_every_agents_serpapi_calls_share_one_cache(monkeypatch, tmp_path):
    calls = _live_serpapi(monkeypatch, tmp_path, lambda p: {"organic_results": []})

    serpapi_client.serpapi_search({"engine": "google_jobs", "q": "engineer"})  # job intelligence
    serpapi_client.serpapi_search({"engine": "google_jobs", "q": "engineer"})

    assert len(calls) == 1


def test_errors_and_no_cache_calls_always_reach_serpapi(monkeypatch, tmp_path):
    calls = _live_serpapi(monkeypatch, tmp_path, lambda p: {"error": "boom"} if p["q"] == "bad" else {})

    for _ in range(2):
        serpapi_client.serpapi_search({"engine": "google", "q": "bad"})
        serpapi_client.serpapi_search({"engine": "google", "q": "token", "no_cache": True})

    assert len(calls) == 4


def test_news_and_jobs_expire_sooner_than_web_results():
    assert serpapi_client.cache_ttl_for("google_news") == serpapi_client.settings.serpapi_fresh_cache_ttl_seconds
    assert serpapi_client.cache_ttl_for("youtube") == serpapi_client.settings.research_cache_ttl_seconds


# ---- LLM response cache --------------------------------------------------------

def _cached_model(tmp_path, model_key="ollama:a"):
    return FakeListChatModel(responses=["first", "second"],
                             cache=LLMResponseCache(ResponseCache(tmp_path), model_key, 0))


def test_identical_prompt_is_answered_from_the_cache(tmp_path):
    model = _cached_model(tmp_path)

    first = asyncio.run(model.ainvoke("plan days 1-3"))
    again = asyncio.run(model.ainvoke("plan days 1-3"))
    other = asyncio.run(model.ainvoke("plan days 4-6"))

    assert first.content == again.content == "first"
    assert other.content == "second"  # a different prompt reached the model
    assert first.id != again.id  # replayed answers stay distinct thread messages
    assert list((tmp_path / "llm").glob("*.json"))  # readable JSON entries


def test_cache_key_includes_the_model_configuration(tmp_path):
    asyncio.run(_cached_model(tmp_path, "ollama:a").ainvoke("x"))
    other_model = FakeListChatModel(responses=["from model b"],
                                    cache=LLMResponseCache(ResponseCache(tmp_path), "ollama:b", 0))

    assert asyncio.run(other_model.ainvoke("x")).content == "from model b"


def test_a_rejected_answer_is_forgotten(tmp_path):
    model = _cached_model(tmp_path)
    bad = asyncio.run(model.ainvoke("return json"))

    forget_response(bad)
    retry = asyncio.run(model.ainvoke("return json"))

    assert (bad.content, retry.content) == ("first", "second")


def test_forget_ignores_messages_that_did_not_come_from_the_cache():
    forget_response(AIMessage(content="x"))
    forget_response(None)


# ---- research scheduling ---------------------------------------------------------

class RecordingLLM:
    async def ainvoke(self, messages):
        return AIMessage(content="## Overview\nok")


def test_a_topic_is_written_up_as_soon_as_its_own_searches_finish():
    """A slow search for one topic must not hold back another topic's
    write-up (it used to: every write-up waited for the slowest search)."""
    written = []

    class Agent(ContentResearchAgent):
        async def _execute_searches(self, request, ctx):
            if request.topic_or_skill_gap == "Slow Topic":
                await asyncio.sleep(0.4)
            return await super()._execute_searches(request, ctx)

        async def _synthesize_learning_module(self, request, ctx):
            written.append((request.topic_or_skill_gap, time.perf_counter()))
            return await super()._synthesize_learning_module(request, ctx)

    agent = Agent(llm=RecordingLLM(), memory=LocalMemoryProvider(), tools=fake_tools())
    start = time.perf_counter()
    results = asyncio.run(agent.research_many([_request("Slow Topic"), _request("Dynamic Programming")]))

    assert all(results)
    first_topic, first_at = written[0]
    assert first_topic == "Dynamic Programming" and first_at - start < 0.3


def _request(topic):
    return ResearchRequest(user_id="u1", target_role="SWE", target_company="Acme", topic_or_skill_gap=topic)


# ---- failures, latency replay, key redaction -------------------------------------

def test_failed_calls_are_grouped_with_their_error():
    with collect_metrics() as run:
        with agent_scope("skill_gap"):
            for _ in range(3):
                try:
                    with track_tool("serpapi:google"):
                        raise ConnectionError("no such host")
                except ConnectionError:
                    pass
    summary = run.summary()

    assert summary["failures"] == [
        {"agent": "skill_gap", "kind": "tool", "name": "serpapi:google", "error": "no such host", "count": 3}]
    assert summary["slowest"] == []  # failures are not "slow calls"
    assert any(line.startswith("FAILED 3x skill_gap") for line in format_report(summary))


def _replay(monkeypatch, **overrides):
    import tools.cache as cache_module
    monkeypatch.setattr(cache_module, "settings", Settings(cache_replay_latency=True, **overrides))


def test_cache_hits_return_immediately_by_default(tmp_path):
    cache = ResponseCache(tmp_path)
    cache.set("serpapi", {"q": "x"}, {"ok": True}, latency_ms=5000)

    start = time.perf_counter()
    cached_fetch(cache, "serpapi", {"q": "x"}, lambda: 1 / 0)
    assert time.perf_counter() - start < 0.5


def test_replay_makes_a_hit_take_the_original_time_up_to_the_cap(tmp_path, monkeypatch):
    _replay(monkeypatch, cache_replay_max_seconds=0.15)
    cache = ResponseCache(tmp_path)
    cache.set("serpapi", {"q": "fast"}, {"ok": True}, latency_ms=60)
    cache.set("serpapi", {"q": "outage"}, {"ok": True}, latency_ms=70_000)

    with collect_metrics() as run:
        cached_fetch(cache, "serpapi", {"q": "fast"}, lambda: 1 / 0)
        cached_fetch(cache, "serpapi", {"q": "outage"}, lambda: 1 / 0)

    fast, outage = run.calls
    assert 55 <= fast.ms < 140 and fast.saved_ms == 0  # replayed in full: nothing saved
    assert 150 <= outage.ms < 400  # capped, not 70s


def test_replay_applies_to_llm_cache_hits(tmp_path, monkeypatch):
    _replay(monkeypatch)
    store = ResponseCache(tmp_path)
    model = FakeListChatModel(responses=["first"], cache=LLMResponseCache(store, "m", 0))
    asyncio.run(model.ainvoke("x"))
    entry_file = next((tmp_path / "llm").glob("*.json"))
    entry_file.write_text(entry_file.read_text().replace('"latency_ms": ', '"latency_ms": 120.0, "was": '))

    start = time.perf_counter()
    asyncio.run(model.ainvoke("x"))
    assert time.perf_counter() - start >= 0.12


def test_serpapi_errors_never_carry_the_api_key(monkeypatch, tmp_path):
    class FailingSearch:
        def __init__(self, params):
            self.params = params

        def get_dict(self):
            raise ConnectionError(f"Max retries exceeded with url: /search?q=x&api_key={self.params['api_key']}&output=json")

    monkeypatch.setitem(sys.modules, "serpapi", types.SimpleNamespace(GoogleSearch=FailingSearch))
    monkeypatch.setattr(serpapi_client, "settings", Settings(serpapi_api_key="s3cr3t-key", serpapi_enabled=True))
    monkeypatch.setattr(serpapi_client, "get_response_cache", lambda: None)

    with collect_metrics() as run:
        try:
            serpapi_client.serpapi_search({"engine": "google", "q": "x"})
        except RuntimeError as exc:
            error = exc
    assert "s3cr3t-key" not in str(error) and "api_key=***" in str(error)
    assert error.__cause__ is None and error.__suppress_context__  # no chained traceback with the key
    assert "s3cr3t-key" not in run.calls[0].error


def test_memory_startup_gives_up_after_the_connect_timeout():
    from memory.store import _within
    import pytest

    start = time.perf_counter()
    with pytest.raises(TimeoutError):
        _within(0.1, lambda: time.sleep(5))
    assert time.perf_counter() - start < 1
    with pytest.raises(ValueError, match="bad key"):
        _within(1, lambda: (_ for _ in ()).throw(ValueError("bad key")))


def test_a_call_cancelled_by_its_callers_timeout_is_reported_as_failed_llm_time():
    """It used to vanish from the table and show up as unexplained "Other"."""
    class SlowModel(FakeListChatModel):
        async def _agenerate(self, messages, stop=None, run_manager=None, **kwargs):
            await asyncio.sleep(5)

    async def scenario():
        with agent_scope("planner"):
            try:
                await asyncio.wait_for(SlowModel(responses=["x"], callbacks=[METRICS_CALLBACK]).ainvoke("plan"), 0.1)
            except asyncio.TimeoutError:
                pass
            await asyncio.sleep(0)  # let the cancelled call's bookkeeping run

    with collect_metrics() as run:
        asyncio.run(scenario())

    row = run.summary()["agents"]["planner"]
    assert row["llm_calls"] == 1 and row["llm_failures"] == 1
    assert row["llm_s"] >= 0.1 and row["other_s"] < 0.05
    assert run.summary()["failures"][0]["error"].startswith("cancelled")


def test_bypass_skips_reads_and_writes_of_every_cache(tmp_path, monkeypatch):
    import tools.cache as cache_module

    cache = ResponseCache(tmp_path)
    monkeypatch.setattr(cache_module, "settings", Settings(research_cache_enabled=True, research_cache_dir=str(tmp_path)))
    monkeypatch.setattr(cache_module, "_cache_instance", cache)
    model = _cached_model(tmp_path)
    asyncio.run(model.ainvoke("x"))  # cached while caches are on
    monkeypatch.setattr(cache_module, "_bypass", True)

    assert cache_module.get_response_cache() is None  # API + transcript caches off
    assert asyncio.run(model.ainvoke("x")).content == "second"  # LLM cache not read
    assert len(list((tmp_path / "llm").glob("*.json"))) == 1  # and not written


def test_one_memory_recall_serves_every_gap_of_a_run():
    class CountingMemory(LocalMemoryProvider):
        calls = 0

        async def search(self, query, user_id, limit=5):
            CountingMemory.calls += 1
            return [{"memory": "prefers hands-on labs"}]

    agent = ContentResearchAgent(llm=RecordingLLM(), memory=CountingMemory(), tools=fake_tools())
    result = asyncio.run(agent({"user_id": "u1", "skill_gaps": ["Dynamic Programming", "Graphs"],
                                "task_context": {"target_role": "SWE", "target_company": "Acme"}}))

    assert len(result["researched_materials"]) == 2
    assert CountingMemory.calls == 1  # not one per gap


def test_no_cache_also_covers_stored_job_profiles_and_serpapis_own_cache(monkeypatch, tmp_path):
    """--no-cache must mean nothing cached anywhere: the job agent's
    MongoDB profiles and SerpApi's server-side cache were not covered."""
    import agents.job_intelligence_agent as job_module
    import tools.cache as cache_module

    monkeypatch.setattr(cache_module, "_bypass", True)

    # 1. SerpApi is told to run the search fresh
    sent = _live_serpapi(monkeypatch, tmp_path, lambda p: {"organic_results": []})
    serpapi_client.serpapi_search({"engine": "google", "q": "x"})
    assert sent[0]["no_cache"] == "true"

    # 2. the job agent neither reads nor writes its stored profiles
    class ForbiddenCollection:
        def find_one(self, *_args, **_kwargs):
            raise AssertionError("a stored profile was read under --no-cache")

        def update_one(self, *_args, **_kwargs):
            raise AssertionError("a profile was stored under --no-cache")

    class Database:
        job_intelligence_profiles = ForbiddenCollection()

    async def extraction(postings, **_kwargs):
        return {"skills": [{"name": "Python"}], "coverage": "medium"}

    monkeypatch.setattr(job_module, "settings", Settings(serpapi_api_key="k", serpapi_enabled=True))
    monkeypatch.setattr(job_module, "fetch_google_jobs", lambda q, loc: {"jobs_results": []})
    monkeypatch.setattr(job_module, "extract_with_llm", extraction)
    monkeypatch.setattr(job_module, "get_db", lambda: Database())
    profile = asyncio.run(job_module.get_job_intelligence_profile(
        job_module.JobIntelligenceInput(company="Acme", role="SWE", location="Remote")))
    assert profile["skills"][0]["name"] == "Python"


def test_with_caches_on_serpapi_requests_carry_no_bypass_flag(monkeypatch, tmp_path):
    sent = _live_serpapi(monkeypatch, tmp_path, lambda p: {"organic_results": []})
    serpapi_client.serpapi_search({"engine": "google", "q": "x"})
    assert "no_cache" not in sent[0]
