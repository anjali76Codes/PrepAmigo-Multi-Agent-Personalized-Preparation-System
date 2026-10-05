"""
The fast model's rate budget: stay inside a free tier's limits instead of
discovering them as 429s.

Groq's free tier for qwen/qwen3.8-27b allows 30 requests and 8,000 tokens a
minute, and 1,000 requests and 200,000 tokens a day (FAST_LLM_RPM/TPM/RPD/
TPD; 0 = no limit). The limits belong to the organisation, not the API key,
so there is one budget per model, shared by every agent and thread, and it
is spent only up to FAST_LLM_LIMIT_HEADROOM (85%) of each limit.

Before a call, reserve its estimated tokens (prompt characters / 3.5 plus
the call's max_tokens):
  - it fits now: the call goes to the fast model
  - it fits within FAST_LLM_MAX_WAIT_SECONDS: wait, then go
  - otherwise: FastBudgetExhausted, and get_llm's fallback runs the call on
    the main model, so the run never sees a 429 and nothing fails
After it, settle: the estimate is replaced by the tokens Groq counted (a
cached answer refunds everything), and Groq's x-ratelimit-* headers correct
the books, since they also count use this process cannot see. A 429 that
gets through anyway blocks the budget for its retry-after.

The day's totals are kept in FAST_LLM_BUDGET_FILE: every CLI run is a new
process, and the daily limits outlast it.

Key pool (FAST_LLM_KEY_POOL=on, keys in FAST_LLM_API_KEYS): one budget per
key, each call goes to the key with the most room left (pick), a key that
answers 429 is paused and the same call moves on to the next key, and a key
the provider rejects as invalid is left out for the rest of the process.
Budgets are named by a hash of the key, never the key itself.
"""
import hashlib
import json
import logging
import math
import re
import threading
import time
from collections import deque
from datetime import date
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

MINUTE = 60.0
CHARS_PER_TOKEN = 3.5  # conservative for English prose and JSON
DEFAULT_COMPLETION_TOKENS = 512  # when a call sets no max_tokens


class FastBudgetExhausted(RuntimeError):
    """The fast model's rate budget has no room for this call soon enough."""


def estimate_tokens(value: Any) -> int:
    """Rough input size of a prompt: a string, a list of messages, or a
    prompt value."""
    if hasattr(value, "to_messages"):
        value = value.to_messages()
    if isinstance(value, str):
        return math.ceil(len(value) / CHARS_PER_TOKEN)
    if isinstance(value, (list, tuple)):
        total = 0
        for item in value:
            content = getattr(item, "content", item)
            text = content if isinstance(content, str) else json.dumps(content, default=str)
            total += math.ceil(len(text) / CHARS_PER_TOKEN) + 4  # per-message overhead
        return total
    return math.ceil(len(str(value)) / CHARS_PER_TOKEN)


_DURATION_PART = re.compile(r"(\d+(?:\.\d+)?)(ms|h|m|s)")


def parse_duration(text: Any) -> float:
    """Groq's reset headers: "7.66s", "2m59.56s", "1h2m3s", "450ms"."""
    seconds = 0.0
    for number, unit in _DURATION_PART.findall(str(text or "")):
        seconds += float(number) * {"ms": 0.001, "s": 1, "m": 60, "h": 3600}[unit]
    return seconds


class Reservation:
    def __init__(self, entry: list[float], tokens: int):
        self.entry = entry  # [time, tokens] in the minute window
        self.tokens = tokens


class RateBudget:
    def __init__(self, name: str, *, rpm: int, tpm: int, rpd: int, tpd: int, headroom: float = 0.85,
                 state_file: str | Path | None = None, clock=time.time):
        self.name = name
        self.raw = {"rpm": rpm, "tpm": tpm, "rpd": rpd, "tpd": tpd}
        self.limit = {key: int(value * headroom) if value else 0 for key, value in self.raw.items()}
        self.state_file = Path(state_file) if state_file else None
        self.clock = clock
        self._lock = threading.Lock()
        self._minute: deque[list[float]] = deque()  # [started, tokens] per call in the last minute
        self._day = {"date": date.today().isoformat(), "requests": 0, "tokens": 0}
        self._blocked_until = 0.0
        self._load()

    # ---- the books ---------------------------------------------------------

    def _roll(self, now: float) -> None:
        while self._minute and self._minute[0][0] <= now - MINUTE:
            self._minute.popleft()
        today = date.today().isoformat()
        if self._day["date"] != today:
            self._day = {"date": today, "requests": 0, "tokens": 0}

    def try_reserve(self, tokens: int) -> tuple[Reservation | None, float]:
        """(reservation, 0.0) when the call may go now; else (None, seconds
        until it would fit), math.inf when not today or never."""
        with self._lock:
            now = self.clock()
            self._roll(now)
            limit = self.limit
            if (limit["rpd"] and self._day["requests"] + 1 > limit["rpd"]) or \
                    (limit["tpd"] and self._day["tokens"] + tokens > limit["tpd"]):
                return None, math.inf
            if limit["tpm"] and tokens > limit["tpm"]:
                return None, math.inf  # one call bigger than a minute's budget
            if self._blocked_until > now:
                return None, self._blocked_until - now
            wait = self._minute_wait(now, tokens)
            if wait:
                return None, wait
            entry = [now, float(tokens)]
            self._minute.append(entry)
            self._day["requests"] += 1
            self._day["tokens"] += tokens
            self._save()
            return Reservation(entry, tokens), 0.0

    def _minute_wait(self, now: float, tokens: int) -> float:
        """Seconds until enough of the last minute's calls age out for one
        more call of `tokens`; 0.0 when it fits now."""
        requests, used = len(self._minute), sum(entry[1] for entry in self._minute)
        fits = lambda r, t: (not self.limit["rpm"] or r + 1 <= self.limit["rpm"]) and \
            (not self.limit["tpm"] or t + tokens <= self.limit["tpm"])  # noqa: E731
        if fits(requests, used):
            return 0.0
        for started, spent in self._minute:  # oldest first
            requests, used = requests - 1, used - spent
            if fits(requests, used):
                return max(started + MINUTE - now, 0.01)
        return MINUTE

    def settle(self, reservation: Reservation, response: Any) -> None:
        """Replace the estimate with what the call actually cost, and take
        the provider's view of the remaining budget from its headers."""
        if str(getattr(response, "id", "") or "").startswith("cache-"):
            return self.refund(reservation)  # answered from the LLM cache: nothing was sent
        usage = getattr(response, "usage_metadata", None) or {}
        actual = int(usage.get("total_tokens") or 0)
        with self._lock:
            if actual:
                self._day["tokens"] += actual - reservation.tokens
                reservation.entry[1] = float(actual)
            self._sync(((getattr(response, "response_metadata", None) or {}).get("headers")) or {})
            self._save()

    def refund(self, reservation: Reservation) -> None:
        with self._lock:
            try:
                self._minute.remove(reservation.entry)
            except ValueError:
                pass
            self._day["requests"] = max(0, self._day["requests"] - 1)
            self._day["tokens"] = max(0, self._day["tokens"] - reservation.tokens)
            self._save()

    def on_error(self, reservation: Reservation, exc: BaseException) -> None:
        """A 429 blocks the budget for its retry-after; any other failure
        keeps the reservation (the request may have been counted)."""
        if "RateLimit" not in type(exc).__name__ and "429" not in str(exc):
            return
        headers = getattr(getattr(exc, "response", None), "headers", None) or {}
        raw = headers.get("retry-after")
        try:
            retry_after = float(raw)  # seconds, as Groq sends it
        except (TypeError, ValueError):
            retry_after = parse_duration(raw)
        with self._lock:
            self._blocked_until = max(self._blocked_until, self.clock() + (retry_after or 10.0))
            self._sync(headers)
        logger.warning("Fast model %s rate limited; pausing it for %.0fs", self.name, retry_after or 10.0)

    def _sync(self, headers: Any) -> None:
        """Groq: x-ratelimit-remaining-requests is the day's requests left,
        x-ratelimit-remaining-tokens the minute's tokens left."""
        def number(key: str) -> float | None:
            try:
                return float(headers.get(key))
            except (TypeError, ValueError):
                return None

        now = self.clock()
        requests_left = number("x-ratelimit-remaining-requests")
        if requests_left is not None and self.raw["rpd"]:
            self._day["requests"] = max(self._day["requests"], int(self.raw["rpd"] - requests_left))
        tokens_left = number("x-ratelimit-remaining-tokens")
        if tokens_left is not None and self.raw["tpm"]:
            # the provider has seen this much of the minute's budget used
            # (by any process); book the difference as one more entry that
            # ages out when its window resets
            seen = self.raw["tpm"] - tokens_left
            ours = sum(entry[1] for entry in self._minute)
            if seen > ours:
                reset = parse_duration(headers.get("x-ratelimit-reset-tokens")) or MINUTE
                self._minute.append([now - MINUTE + min(reset, MINUTE), seen - ours])

    # ---- persistence --------------------------------------------------------

    def _load(self) -> None:
        if not self.state_file:
            return
        try:
            saved = json.loads(self.state_file.read_text()).get(self.name) or {}
        except (OSError, ValueError):
            return
        if saved.get("date") == self._day["date"]:
            self._day.update(requests=int(saved.get("requests") or 0), tokens=int(saved.get("tokens") or 0))

    def _save(self) -> None:
        if not self.state_file:
            return
        try:
            data = json.loads(self.state_file.read_text()) if self.state_file.exists() else {}
        except (OSError, ValueError):
            data = {}
        data[self.name] = dict(self._day)
        try:
            self.state_file.parent.mkdir(parents=True, exist_ok=True)
            self.state_file.write_text(json.dumps(data, indent=1))
        except OSError:
            logger.debug("Could not save the fast model's rate budget", exc_info=True)

    def headroom(self) -> float:
        """The smallest share of any limit still unused (1.0 = untouched,
        0.0 = a limit is reached): the pool sends a call to the key with the
        most."""
        with self._lock:
            now = self.clock()
            self._roll(now)
            if self._blocked_until > now:
                return 0.0
            used = {"rpm": len(self._minute), "tpm": sum(entry[1] for entry in self._minute),
                    "rpd": self._day["requests"], "tpd": self._day["tokens"]}
            shares = [1 - used[key] / limit for key, limit in self.limit.items() if limit]
            return max(0.0, min(shares, default=1.0))

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            self._roll(self.clock())
            return {"minute_requests": len(self._minute),
                    "minute_tokens": int(sum(entry[1] for entry in self._minute)),
                    "day_requests": self._day["requests"], "day_tokens": self._day["tokens"],
                    "limits": dict(self.limit)}


_budgets: dict[str, RateBudget] = {}
_labels: dict[str, str] = {}  # budget name -> "key1", "key2", ... for reports
_disabled: dict[str, str] = {}  # budget name -> why the key was left out
_budgets_lock = threading.Lock()


def key_fingerprint(api_key: str) -> str:
    """A stable, non-reversible name for a key (logs and the budget file
    never see the key)."""
    return hashlib.sha256(api_key.encode()).hexdigest()[:10]


def budget_for(name: str, label: str = "") -> RateBudget:
    """The process-wide budget called `name` (one per model and key;
    settings read on first use)."""
    from core.config import service_path, settings

    with _budgets_lock:
        if name not in _budgets:
            _budgets[name] = RateBudget(
                name, rpm=settings.fast_llm_rpm, tpm=settings.fast_llm_tpm, rpd=settings.fast_llm_rpd,
                tpd=settings.fast_llm_tpd, headroom=settings.fast_llm_limit_headroom,
                state_file=service_path(settings.fast_llm_budget_file) if settings.fast_llm_budget_file else None,
            )
        if label:
            _labels[name] = label
        return _budgets[name]


def disable(name: str, why: str) -> None:
    with _budgets_lock:
        if name not in _disabled:
            logger.warning("Fast model %s left out for the rest of this process: %s", _labels.get(name, name), why)
        _disabled[name] = why


def is_disabled(name: str) -> bool:
    return name in _disabled


def is_rate_limit(exc: BaseException) -> bool:
    return "RateLimit" in type(exc).__name__ or " 429" in f" {exc}"


def is_bad_key(exc: BaseException) -> bool:
    text = str(exc).lower()
    return "Authentication" in type(exc).__name__ or "PermissionDenied" in type(exc).__name__ \
        or "invalid api key" in text or " 401" in f" {text}"


def pick(names: list[str], tokens: int, exclude: set[str]) -> tuple[str | None, Reservation | None, float]:
    """(budget name, reservation, 0.0) for the usable key with the most
    room that can take `tokens` now; else (None, None, seconds until the
    soonest one could; math.inf when none can today)."""
    usable = [name for name in names if name not in exclude and not is_disabled(name)]
    soonest = math.inf
    for name in sorted(usable, key=lambda n: budget_for(n).headroom(), reverse=True):
        reservation, wait = budget_for(name).try_reserve(tokens)
        if reservation:
            return name, reservation, 0.0
        soonest = min(soonest, wait)
    return None, None, soonest


def pool_snapshot() -> list[dict[str, Any]]:
    """Today's use per key, for the run report (only keys this process used)."""
    with _budgets_lock:
        names = list(_budgets)
    rows = []
    for name in names:
        snap = budget_for(name).snapshot()
        rows.append({"key": _labels.get(name, name), "requests_today": snap["day_requests"],
                     "tokens_today": snap["day_tokens"], "disabled": _disabled.get(name, "")})
    return rows


def reset_budgets() -> None:
    """Forget every budget (tests)."""
    with _budgets_lock:
        _budgets.clear()
        _labels.clear()
        _disabled.clear()
