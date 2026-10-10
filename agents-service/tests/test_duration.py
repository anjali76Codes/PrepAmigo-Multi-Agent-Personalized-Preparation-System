import pytest
from tools.duration import extract_duration_days, extract_requested_duration_days, resolve_plan_total_days, resolve_requested_plan_total_days


def test_extract_duration_days_direct():
    assert extract_duration_days("make a 90 day plan") is None
    assert extract_requested_duration_days("I have 90 days to prepare for Google") == 90
    assert extract_duration_days("45 days") == 45
    assert extract_duration_days("30-day prep") == 30
    assert extract_duration_days("60days") == 60
    assert extract_duration_days("1 day") == 1


def test_extract_duration_days_months_and_weeks():
    assert extract_duration_days("3 months preparation") is None
    assert extract_duration_days("2 month plan") == 60
    assert extract_duration_days("1 month") == 30
    assert extract_duration_days("6 weeks") == 42
    assert extract_duration_days("1 week") == 7


def test_extract_duration_days_invalid_and_out_of_bounds():
    assert extract_duration_days(None) is None
    assert extract_duration_days("") is None
    assert extract_duration_days("prepare for Backend Engineer at Stripe") is None
    assert extract_duration_days("0 days") is None
    assert extract_duration_days("500 days") is None


def test_resolve_plan_total_days():
    # 1. Directly in state
    assert resolve_plan_total_days({"plan_total_days": 90}) is None
    assert resolve_requested_plan_total_days({"plan_total_days": 90}) == 90

    # 2. In workflow_input
    assert resolve_plan_total_days({"workflow_input": {"total_days": 60}}) == 60
    assert resolve_plan_total_days({"workflow_input": {"plan_days": 30}}) == 30

    # 3. In candidate text
    assert resolve_plan_total_days({}, candidate_texts=["I need a 90-day plan"]) is None
    assert resolve_requested_plan_total_days({}, candidate_texts=["I need a 90-day plan"]) == 90

    # 4. In workflow_text_input
    assert resolve_plan_total_days({"workflow_text_input": "make a 90 day plan"}) is None
    assert resolve_requested_plan_total_days({"workflow_text_input": "make a 90 day plan"}) == 90

    # 5. In messages
    from langchain_core.messages import HumanMessage
    state = {
        "messages": [HumanMessage(content="I want a 90 day study plan for Meta")]
    }
    assert resolve_plan_total_days(state) is None
    assert resolve_requested_plan_total_days(state) == 90
