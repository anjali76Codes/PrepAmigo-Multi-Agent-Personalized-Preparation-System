import pytest

from agents.supervisor import supervisor_node
from config import Settings
import tools.search_tools as search_tools
from guardrails.validators import check_no_unconfirmed_payment
from tools.search_tools import search_flights


def test_settings_reject_unknown_provider():
    with pytest.raises(ValueError, match="LLM_PROVIDER"):
        Settings(llm_provider="unknown").validate()


def test_supervisor_rejects_unknown_decision(monkeypatch):
    class FakeLLM:
        def invoke(self, messages):
            class Response:
                content = "support"

            return Response()

    monkeypatch.setattr("agents.supervisor.get_llm", lambda temperature: FakeLLM())

    with pytest.raises(ValueError, match="unsupported agent"):
        supervisor_node({"messages": []})


def test_guardrail_blocks_irreversible_tool_call():
    state = {
        "messages": [
            type(
                "Message",
                (),
                {"tool_calls": [{"name": "charge_card"}]},
            )()
        ]
    }

    passed, reason = check_no_unconfirmed_payment(state)

    assert not passed
    assert "charge_card" in reason


def test_search_flights_validates_configuration(monkeypatch):
    monkeypatch.setattr(search_tools, "settings", Settings(serpapi_api_key=""))

    with pytest.raises(RuntimeError, match="SERPAPI_API_KEY"):
        search_tools.search_flights.invoke(
            {"origin": "JFK", "destination": "LAX", "date": "2099-01-01"}
        )