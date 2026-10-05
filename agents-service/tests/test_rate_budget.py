"""The fast model's rate budget (core/rate_budget.py): Groq's free tier is
30 requests and 8,000 tokens a minute, 1,000 requests and 200,000 tokens a
day, per organisation."""
import asyncio
import dataclasses
import math
from types import SimpleNamespace

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import AIMessage

import core.config as config
from core.rate_budget import RateBudget, estimate_tokens, parse_duration


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def budget(clock=None, **limits):
    values = {"rpm": 30, "tpm": 8000, "rpd": 1000, "tpd": 200000, **limits}
    return RateBudget("m", headroom=1.0, clock=clock or Clock(), **values)


def test_calls_within_the_minute_limits_go_at_once():
    b = budget()
    for _ in range(30):
        reservation, wait = b.try_reserve(100)
        assert reservation and wait == 0.0


def test_the_31st_request_in_a_minute_waits_for_the_oldest_to_age_out():
    clock = Clock()
    b = budget(clock)
    for i in range(30):
        clock.now = 1000.0 + i
        b.try_reserve(10)
    clock.now = 1040.0
    reservation, wait = b.try_reserve(10)
    assert reservation is None and wait == pytest.approx(20.0)  # the call at t=1000 leaves at t=1060
    clock.now = 1060.0
    assert b.try_reserve(10)[0] is not None


def test_tokens_per_minute_are_budgeted_with_headroom():
    b = RateBudget("m", rpm=30, tpm=8000, rpd=0, tpd=0, headroom=0.85, clock=Clock())
    assert b.try_reserve(6000)[0] is not None
    reservation, wait = b.try_reserve(1000)  # 7,000 > 6,800 (85% of 8,000)
    assert reservation is None and 0 < wait <= 60


def test_a_call_bigger_than_a_minute_or_past_the_daily_limit_never_fits():
    assert budget().try_reserve(9000) == (None, math.inf)
    b = budget(rpd=2)
    b.try_reserve(1), b.try_reserve(1)
    assert b.try_reserve(1) == (None, math.inf)


def test_settling_books_the_real_usage_and_a_cache_hit_costs_nothing():
    b = budget()
    reservation, _ = b.try_reserve(900)
    b.settle(reservation, AIMessage(content="x", usage_metadata={"input_tokens": 200, "output_tokens": 100,
                                                                  "total_tokens": 300}))
    assert b.snapshot()["minute_tokens"] == 300 and b.snapshot()["day_tokens"] == 300
    cached, _ = b.try_reserve(500)
    b.settle(cached, AIMessage(content="x", id="cache-123"))
    assert b.snapshot()["minute_requests"] == 1 and b.snapshot()["day_tokens"] == 300


def test_the_providers_headers_correct_the_books():
    """Another process used most of the minute: Groq's headers say so."""
    b = budget()
    reservation, _ = b.try_reserve(100)
    headers = {"x-ratelimit-remaining-tokens": "500", "x-ratelimit-reset-tokens": "30s",
               "x-ratelimit-remaining-requests": "10"}
    b.settle(reservation, AIMessage(content="x", response_metadata={"headers": headers}))
    assert b.try_reserve(1000)[0] is None  # only 500 left this minute
    assert b.snapshot()["day_requests"] == 990  # 1,000 - 10 left today


def test_a_429_pauses_the_budget_for_its_retry_after():
    clock = Clock()
    b = budget(clock)
    reservation, _ = b.try_reserve(100)
    error = type("RateLimitError", (Exception,), {})("429")
    error.response = SimpleNamespace(headers={"retry-after": "7"})
    b.on_error(reservation, error)
    assert b.try_reserve(10) == (None, pytest.approx(7.0))


def test_the_days_use_survives_a_new_process(tmp_path):
    state = tmp_path / "budget.json"
    first = RateBudget("m", rpm=0, tpm=0, rpd=3, tpd=0, state_file=state, headroom=1.0)
    first.try_reserve(1), first.try_reserve(1)
    again = RateBudget("m", rpm=0, tpm=0, rpd=3, tpd=0, state_file=state, headroom=1.0)
    assert again.try_reserve(1)[0] is not None
    assert again.try_reserve(1) == (None, math.inf)


def test_helpers():
    assert parse_duration("2m59.56s") == pytest.approx(179.56)
    assert parse_duration("450ms") == pytest.approx(0.45)
    assert estimate_tokens("x" * 350) == 100


# ---- through get_llm: a call that doesn't fit runs on the main model --------

def _fast_with_fallback(monkeypatch, **limits):
    monkeypatch.setattr(config, "settings", dataclasses.replace(
        config.settings, fast_llm_model="m", fast_llm_max_wait_seconds=0.0, **limits))
    fast = config._within_rate_budget([("m#k1", FakeListChatModel(responses=["fast"] * 10))], max_tokens=100)
    return fast.with_fallbacks([FakeListChatModel(responses=["main"] * 10)])


def test_calls_go_to_the_fast_model_while_it_has_budget_then_to_the_main_one(monkeypatch):
    llm = _fast_with_fallback(monkeypatch, fast_llm_rpm=2, fast_llm_tpm=0, fast_llm_rpd=0, fast_llm_tpd=0,
                              fast_llm_limit_headroom=1.0)
    answers = [asyncio.run(llm.ainvoke("hi")).content for _ in range(3)]
    assert answers == ["fast", "fast", "main"]  # the third would have been a 429


# ---- key pool (FAST_LLM_KEY_POOL=on) -------------------------------------------

def _pool(monkeypatch, chats: dict, **limits):
    monkeypatch.setattr(config, "settings", dataclasses.replace(
        config.settings, fast_llm_model="m", fast_llm_max_wait_seconds=0.0, fast_llm_limit_headroom=1.0,
        **{"fast_llm_rpm": 0, "fast_llm_tpm": 0, "fast_llm_rpd": 0, "fast_llm_tpd": 0, **limits}))
    pool = config._within_rate_budget(list(chats.items()), max_tokens=100)
    return pool.with_fallbacks([FakeListChatModel(responses=["main"] * 20)])


class Answer(FakeListChatModel):
    """Answers with its name, or raises `error` on every call."""
    error: Exception | None = None

    async def _agenerate(self, *args, **kwargs):
        if self.error is not None:
            raise self.error
        return await super()._agenerate(*args, **kwargs)


def test_the_pool_spreads_calls_over_its_keys_by_room_left(monkeypatch):
    chats = {f"m#k{i}": Answer(responses=[f"key{i}"] * 10) for i in (1, 2, 3)}
    llm = _pool(monkeypatch, chats, fast_llm_rpm=2)

    answers = [asyncio.run(llm.ainvoke("hi")).content for _ in range(7)]

    assert sorted(answers[:6]) == ["key1", "key1", "key2", "key2", "key3", "key3"]  # 3 keys x 2 a minute
    assert answers[6] == "main"  # every key full: the main model, never a 429


def test_a_key_that_answers_429_hands_the_same_call_to_the_next_key(monkeypatch):
    limited = type("RateLimitError", (Exception,), {})("429 Too Many Requests")
    chats = {"m#k1": Answer(responses=["key1"], error=limited), "m#k2": Answer(responses=["key2"] * 5)}
    llm = _pool(monkeypatch, chats)

    assert asyncio.run(llm.ainvoke("hi")).content == "key2"
    assert asyncio.run(llm.ainvoke("hi")).content == "key2"  # key1 is paused for its retry-after


def test_a_rejected_key_is_left_out(monkeypatch):
    from core import rate_budget

    bad = type("AuthenticationError", (Exception,), {})("401 Invalid API Key")
    chats = {"m#k1": Answer(responses=["key1"], error=bad), "m#k2": Answer(responses=["key2"] * 5)}
    llm = _pool(monkeypatch, chats)

    assert asyncio.run(llm.ainvoke("hi")).content == "key2"
    assert rate_budget.is_disabled("m#k1")


def test_the_pool_is_switched_by_config(monkeypatch):
    base = dataclasses.replace(config.settings, fast_llm_api_key="a", fast_llm_api_keys="b, c, a")
    assert dataclasses.replace(base, fast_llm_key_pool=False).fast_llm_keys() == ["a"]
    assert dataclasses.replace(base, fast_llm_key_pool=True).fast_llm_keys() == ["a", "b", "c"]
    only_list = dataclasses.replace(base, fast_llm_api_key="", fast_llm_key_pool=False)
    assert only_list.fast_llm_keys() == ["b"]
    # concurrency grows with the pool: each key has its own limits
    pooled = dataclasses.replace(base, fast_llm_key_pool=True, fast_llm_base_url="https://x", fast_llm_model="m",
                                 fast_llm_max_concurrency=2)
    assert config.llm_concurrency(pooled, "fast") == 6


def test_keys_never_reach_the_budget_file(tmp_path, monkeypatch):
    from core.rate_budget import budget_for, key_fingerprint

    state = tmp_path / "budget.json"
    monkeypatch.setattr(config, "settings", dataclasses.replace(config.settings, fast_llm_budget_file=str(state)))
    secret = "gsk_live_secret_value"
    budget_for(f"m#{key_fingerprint(secret)}", label="key1").try_reserve(10)
    assert state.exists() and secret not in state.read_text()


def test_the_run_report_shows_each_keys_use_today():
    from core.rate_budget import budget_for, disable
    from observability.metrics import RunMetrics, format_report

    budget_for("m#a", label="key1").try_reserve(100)
    budget_for("m#b", label="key2").try_reserve(50)
    disable("m#b", "the provider rejected the key")

    line = next(line for line in format_report(RunMetrics().summary()) if line.startswith("Fast model keys"))
    assert line == ("Fast model keys (today): key1 1 req / 100 tok · "
                    "key2 1 req / 50 tok (left out: the provider rejected the key)")
