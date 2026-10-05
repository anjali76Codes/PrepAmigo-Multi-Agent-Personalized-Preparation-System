"""Utility for extracting study plan duration (in days) from user text, input dictionaries, or messages."""
import re
from typing import Any

MIN_PLAN_DAYS = 1
MAX_PLAN_DAYS = 365


def extract_duration_days(text: Any) -> int | None:
    """Extracts requested preparation duration in days from free-form text.
    Handles days, weeks, months with boundaries [1, 365].
    Examples:
      - "make a 90 day plan" -> 90
      - "90 days" -> 90
      - "3 months" -> 90
      - "6 weeks" -> 42
      - "30-day preparation" -> 30
    """
    if not text or not isinstance(text, str):
        return None

    # 1. Direct days pattern: "90 days", "90-day", "90 day", "90days"
    day_match = re.search(r"\b(\d{1,3})\s*(?:-| )?days?\b", text, re.IGNORECASE)
    if day_match:
        val = int(day_match.group(1))
        if MIN_PLAN_DAYS <= val <= MAX_PLAN_DAYS:
            return val

    # 2. Months pattern: "3 months", "2 month", "1 month"
    month_match = re.search(r"\b(\d{1,2})\s*(?:-| )?months?\b", text, re.IGNORECASE)
    if month_match:
        val = int(month_match.group(1)) * 30
        if MIN_PLAN_DAYS <= val <= MAX_PLAN_DAYS:
            return val

    # 3. Weeks pattern: "6 weeks", "4 week", "2 weeks"
    week_match = re.search(r"\b(\d{1,2})\s*(?:-| )?weeks?\b", text, re.IGNORECASE)
    if week_match:
        val = int(week_match.group(1)) * 7
        if MIN_PLAN_DAYS <= val <= MAX_PLAN_DAYS:
            return val

    return None


def resolve_plan_total_days(state: dict[str, Any], candidate_texts: list[Any] | None = None) -> int | None:
    """Resolves plan duration from state, inputs, or text candidates."""
    # 1. Already in state
    existing = state.get("plan_total_days")
    if existing:
        try:
            val = int(existing)
            if MIN_PLAN_DAYS <= val <= MAX_PLAN_DAYS:
                return val
        except (ValueError, TypeError):
            pass

    # 2. Check workflow_input and interview_prep_input
    for d in (state.get("workflow_input"), state.get("interview_prep_input")):
        if isinstance(d, dict):
            for k in ("total_days", "plan_days", "days", "duration_days"):
                raw = d.get(k)
                if raw is not None:
                    try:
                        val = int(raw)
                        if MIN_PLAN_DAYS <= val <= MAX_PLAN_DAYS:
                            return val
                    except (ValueError, TypeError):
                        parsed = extract_duration_days(str(raw))
                        if parsed:
                            return parsed

    # 3. Inspect candidate texts (workflow_text_input, query, messages, etc.)
    texts = list(candidate_texts or [])
    if state.get("workflow_text_input"):
        texts.append(state["workflow_text_input"])
    for m in state.get("messages", [])[-5:]:
        content = getattr(m, "content", m)
        if isinstance(content, str):
            texts.append(content)
        elif isinstance(content, list):
            texts.append("".join(item.get("text", "") for item in content if isinstance(item, dict)))

    for t in texts:
        extracted = extract_duration_days(t)
        if extracted:
            return extracted

    return None
