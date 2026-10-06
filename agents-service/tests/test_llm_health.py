"""The slow-model circuit breaker (observability/llm_health.py) and the
guarded models get_llm(guarded=True) builds on it."""
import asyncio
import dataclasses

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

import core.config as config
from observability import llm_health
from observability.llm_health import ModelDegradedError
from observability.metrics import METRICS_CALLBACK, collect_metrics


@pytest.fixture
def health_settings(monkeypatch):
    def apply(**overrides):
        monkeypatch.setattr(llm_health, "settings", dataclasses.replace(llm_health.settings, **overrides))
    apply(llm_slow_call_seconds=30, llm_degraded_seconds=300)
    return apply


def test_a_slow_answer_marks_its_model_degraded(health_settings):
    llm_health.observe("m", 47.4, 413)  # job intelligence on the slow day: ~9 tokens/s
    assert llm_health.degraded("m") and not llm_health.degraded("other")


@pytest.mark.parametrize("seconds, tokens", [(3.0, 400), (45.0, 1800)])
def test_a_quick_answer_or_a_long_one_at_normal_speed_does_not(health_settings, seconds, tokens):
    llm_health.observe("m", seconds, tokens)
    assert not llm_health.degraded("m")


def test_a_call_cut_off_after_the_threshold_counts_as_slow(health_settings):
    llm_health.observe("m", 45.0, cut_off=True)
    assert llm_health.degraded("m")


def test_a_degraded_model_is_tried_again_after_the_window(health_settings):
    health_settings(llm_degraded_seconds=0.01)
    llm_health.observe("m", 60.0, cut_off=True)
    asyncio.run(asyncio.sleep(0.02))
    assert not llm_health.degraded("m")


def _guarded(monkeypatch, fast_configured: bool):
    main = FakeListChatModel(responses=["from the main model"])
    fast = FakeListChatModel(responses=["from the fast model"])
    monkeypatch.setattr(config, "_build_llm",
                        lambda *args, fallback=True, **kw: fast if (args[2:3] == ("fast",)) else main)
    monkeypatch.setattr(config, "fast_llm_configured", lambda cfg=None: fast_configured)
    return config.get_llm(temperature=0, profile="default", model="slow-model", guarded=True)


def test_a_guarded_model_answers_normally_while_healthy(monkeypatch):
    llm = _guarded(monkeypatch, fast_configured=True)
    assert asyncio.run(llm.ainvoke("hi")).content == "from the main model"


def test_while_degraded_calls_go_to_their_fallback_not_to_the_fast_model(monkeypatch, health_settings):
    """A free fast tier can't absorb a whole run, so routing there is opt-in."""
    llm = _guarded(monkeypatch, fast_configured=True)
    llm_health.observe("slow-model", 60.0, cut_off=True)
    with pytest.raises(ModelDegradedError):
        asyncio.run(llm.ainvoke("hi"))


def test_with_the_fast_route_chosen_degraded_calls_go_to_the_fast_model(monkeypatch, health_settings):
    monkeypatch.setattr(config, "settings", dataclasses.replace(config.settings, llm_degraded_route="fast"))
    llm = _guarded(monkeypatch, fast_configured=True)
    llm_health.observe("slow-model", 60.0, cut_off=True)
    assert asyncio.run(llm.ainvoke("hi")).content == "from the fast model"


def test_while_degraded_without_a_fast_model_calls_fail_at_once(monkeypatch, health_settings):
    """The caller's own fallback (concept-based wording, a resources-only
    note) then runs in milliseconds instead of after a 45-120s timeout."""
    llm = _guarded(monkeypatch, fast_configured=False)
    llm_health.observe("slow-model", 60.0, cut_off=True)
    with pytest.raises(ModelDegradedError):
        asyncio.run(llm.ainvoke("hi"))


def test_the_metrics_callback_feeds_the_breaker(health_settings):
    """Every timed model call reaches llm_health.observe."""
    health_settings(llm_slow_call_seconds=0.05)

    class SlowFake(FakeListChatModel):
        async def _agenerate(self, *args, **kwargs):
            await asyncio.sleep(0.1)
            return await super()._agenerate(*args, **kwargs)

    model = SlowFake(responses=["x"], callbacks=[METRICS_CALLBACK])

    async def run():
        with collect_metrics():
            # a real chat model reports its name as ls_model_name; the fake one doesn't
            await model.ainvoke("hi", config={"metadata": {"ls_model_name": "fake-model"}})

    asyncio.run(run())
    assert llm_health.degraded("fake-model")
