"""Utility for extracting study plan duration (in days) from user text, input dictionaries, or messages."""
import re
from typing import Any

MIN_PLAN_DAYS = 1
MAX_PLAN_DAYS = 60


def extract_requested_duration_days(text: Any) -> int | None:
    """Extract a requested duration without applying the plan limit."""
    if not text or not isinstance(text, str):
        return None
    patterns = (
        (r"\b(\d{1,3})\s*(?:-| )?days?\b", 1),
        (r"\b(\d{1,2})\s*(?:-| )?months?\b", 30),
        (r"\b(\d{1,2})\s*(?:-| )?weeks?\b", 7),
    )
    for pattern, multiplier in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value = int(match.group(1)) * multiplier
            return value if value >= MIN_PLAN_DAYS else None
    return None


def extract_duration_days(text: Any) -> int | None:
    """Extracts requested preparation duration in days from free-form text.
    Handles days, weeks, months with boundaries [1, 60].
    Examples:
      - "make a 90 day plan" -> 90
      - "90 days" -> 90
      - "3 months" -> 90
      - "6 weeks" -> 42
      - "30-day preparation" -> 30
    """
    if not text or not isinstance(text, str):
        return None

    day_match = re.search(r"\b(\d{1,3})\s*(?:-| )?days?\b", text, re.IGNORECASE)
    if day_match:
        val = int(day_match.group(1))
        if MIN_PLAN_DAYS <= val <= MAX_PARSEABLE_PLAN_DAYS:
            return val

    month_match = re.search(r"\b(\d{1,2})\s*(?:-| )?months?\b", text, re.IGNORECASE)
    if month_match:
        val = int(month_match.group(1)) * 30
        if MIN_PLAN_DAYS <= val <= MAX_PARSEABLE_PLAN_DAYS:
            return val

    week_match = re.search(r"\b(\d{1,2})\s*(?:-| )?weeks?\b", text, re.IGNORECASE)
    if week_match:
        val = int(week_match.group(1)) * 7
        if MIN_PLAN_DAYS <= val <= MAX_PARSEABLE_PLAN_DAYS:
            return val

    return None


def extract_duration_days(text: Any) -> int | None:
    """Extracts requested preparation duration in days from free-form text.
    Handles days, weeks, months with boundaries [1, 60].
    Examples:
      - "make a 45 day plan" -> 45
      - "60 days" -> 60
      - "2 months" -> 60
      - "6 weeks" -> 42
      - "30-day preparation" -> 30
    """
    val = extract_requested_duration_days(text)
    return val if val is not None and val <= MAX_PLAN_DAYS else None


def resolve_requested_plan_total_days(state: dict[str, Any], candidate_texts: list[Any] | None = None) -> int | None:
    """Resolve the requested duration, including values above the 60-day limit."""
    existing = state.get("plan_total_days")
    if existing is not None:
        try:
            val = int(existing)
            if MIN_PLAN_DAYS <= val <= MAX_PARSEABLE_PLAN_DAYS:
                return val
        except (ValueError, TypeError):
            pass

    for d in (state.get("workflow_input"), state.get("interview_prep_input")):
        if isinstance(d, dict):
            for k in ("total_days", "plan_days", "days", "duration_days"):
                raw = d.get(k)
                if raw is not None:
                    try:
                        val = int(raw)
                    except (ValueError, TypeError):
                        val = extract_requested_duration_days(str(raw))
                    if val is not None and MIN_PLAN_DAYS <= val <= MAX_PARSEABLE_PLAN_DAYS:
                        return val

    texts = list(candidate_texts or [])
    if state.get("workflow_text_input"):
        texts.append(state["workflow_text_input"])
    for m in state.get("messages", [])[-5:]:
        content = getattr(m, "content", m)
        if isinstance(content, str):
            texts.append(content)
        elif isinstance(content, list):
            texts.append("".join(item.get("text", "") for item in content if isinstance(item, dict)))

    for text in texts:
        extracted = extract_requested_duration_days(text)
        if extracted:
            return extracted
    return None


def resolve_plan_total_days(state: dict[str, Any], candidate_texts: list[Any] | None = None) -> int | None:
    """Resolves plan duration from state, inputs, or text candidates."""
    requested = resolve_requested_plan_total_days(state, candidate_texts)
    return requested if requested is not None and requested <= MAX_PLAN_DAYS else None
