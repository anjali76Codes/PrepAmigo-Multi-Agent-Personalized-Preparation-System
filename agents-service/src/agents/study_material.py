"""
Assessment questions and flashcards for the days of one sprint.

One model call per chunk of 3-4 consecutive days returns both the quiz
questions and the flashcards for that chunk:

    generate_for_sprint(days)  ->  [ChunkMaterial(day_numbers, questions, cards, status)]

Called by the backend through POST /internal/study-material when a sprint
needs its material (the backend saves it; this service stores nothing),
and by AssessmentAgent / FlashcardAgent for a whole plan.

What keeps it dependable:
  - every question and card is validated on its own (exactly 4 distinct
    options, answer normalised to the letter "A"-"D" the quiz grades
    against, difficulty easy|medium|hard, nothing empty or repeated);
    invalid items are dropped, not the whole chunk
  - an unusable answer is evicted from the response cache and retried once
    with a corrective instruction (an identical retry would replay it)
  - calls take an LLM slot first (config.llm_concurrency) and only then
    start their timeout, so queued chunks never time out while waiting;
    the model is guarded (a model known to be slow is skipped)
  - each chunk reports ok / partial / failed instead of an empty list

Grounding: each day's title, description, objectives and reference titles,
the topic's key concepts when the plan carries them, and, when given, what
the user is weak in or has mastered (from the knowledge graph). Every item
is tagged with the concept it tests, which is what lets quiz results
update the user's per-concept proficiency.
"""
import asyncio
import json
import logging
import re
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

from core.config import get_llm, llm_concurrency, settings
from graph.events import INTERNAL_LLM_CONFIG
from observability.timing import log_failure
from storage.llm_cache import forget_response
from tools.plan_builder import clip, parse_json_object, split_evenly

logger = logging.getLogger(__name__)

CHUNK_MAX_DAYS = 4  # 7-day sprint -> days 1-4 and 5-7
QUESTIONS_PER_CHUNK = 8
CARDS_PER_CHUNK = 6
MAX_OUTPUT_TOKENS = 3200  # ~8 questions + ~6 cards with explanations
CALL_TIMEOUT_SECONDS = 120
LETTERS = "ABCD"
DIFFICULTIES = ("easy", "medium", "hard")


def _difficulty(value: Any) -> str:
    text = str(value or "").strip().casefold()
    if text in DIFFICULTIES:
        return text
    if text in {"beginner", "basic", "simple", "low"}:
        return "easy"
    if text in {"advanced", "difficult", "expert", "high"}:
        return "hard"
    return "medium"


def _text(value: Any, limit: int) -> str:
    return clip(" ".join(str(value or "").split()), limit)


class StudyQuestion(BaseModel):
    question: str = Field(min_length=8)
    options: list[str] = Field(min_length=4, max_length=4)
    answer: Literal["A", "B", "C", "D"]
    explanation: str = Field(min_length=1)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    concept: str = ""

    @model_validator(mode="before")
    @classmethod
    def _normalise(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        options = [_text(o, 300) for o in data.get("options") or [] if str(o or "").strip()]
        # "A) Foo" / "A. Foo" -> "Foo": the quiz shows its own letters
        options = [re.sub(r"^[A-Da-d][\).:\-]\s+", "", o) for o in options]
        answer = str(data.get("answer") or data.get("correct_answer") or "").strip()
        letter = answer[:1].upper() if len(answer) == 1 or re.match(r"^[A-Da-d][\).:\-\s]", answer) else ""
        if not letter or letter not in LETTERS:  # ("" is in every string)
            # the model answered with the option text instead of its letter
            match = next((i for i, o in enumerate(options) if o.casefold() == answer.casefold()), None)
            letter = LETTERS[match] if match is not None and match < 4 else ""
        return {
            "question": _text(data.get("question"), 600),
            "options": options,
            "answer": letter,
            "explanation": _text(data.get("explanation"), 800),
            "difficulty": _difficulty(data.get("difficulty")),
            "concept": _text(data.get("concept"), 120),
        }

    @field_validator("options")
    @classmethod
    def _distinct(cls, options: list[str]) -> list[str]:
        if len({o.casefold() for o in options}) != len(options):
            raise ValueError("options must be distinct")
        return options


class StudyCard(BaseModel):
    front: str = Field(min_length=3)
    back: str = Field(min_length=1)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    concept: str = ""
    tags: list[str] = Field(default_factory=list, max_length=6)

    @model_validator(mode="before")
    @classmethod
    def _normalise(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        tags = data.get("tags") if isinstance(data.get("tags"), list) else []
        return {
            "front": _text(data.get("front"), 400),
            "back": _text(data.get("back"), 800),
            "difficulty": _difficulty(data.get("difficulty")),
            "concept": _text(data.get("concept"), 120),
            "tags": [_text(t, 40) for t in tags if str(t or "").strip()][:6],
        }


class ChunkMaterial(BaseModel):
    day_numbers: list[int]
    status: Literal["ok", "partial", "failed"]
    questions: list[StudyQuestion] = Field(default_factory=list)
    cards: list[StudyCard] = Field(default_factory=list)
    error: str | None = None


def _get(day: Any, key: str, default: Any = None) -> Any:
    return day.get(key, default) if isinstance(day, dict) else getattr(day, key, default)


def chunk_days(days: list[Any]) -> list[list[Any]]:
    """Consecutive chunks of 3-4 days (a 7-day sprint -> 4 + 3); any sprint
    length works, and a 1-2 day sprint is one chunk."""
    days = [d for d in days if _text(_get(d, "topic_title"), 200)]
    if not days:
        return []
    return [part for part in split_evenly(days, -(-len(days) // CHUNK_MAX_DAYS)) if part]


def _prompt(chunk: list[Any], user_context: dict[str, Any] | None, corrective: bool) -> str:
    lines = []
    concepts: list[str] = []
    for day in chunk:
        refs = [_text(_get(r, "title"), 80) for r in (_get(day, "references") or [])[:3]]
        objectives = [_text(o, 200) for o in (_get(day, "objectives") or [])[:4]]
        lines.append(
            f"Day {_get(day, 'day_number')}: {_text(_get(day, 'topic_title'), 200)}"
            + (f"\n  About: {_text(_get(day, 'topic_description'), 300)}" if _get(day, "topic_description") else "")
            + (f"\n  Objectives: {'; '.join(objectives)}" if objectives else "")
            + (f"\n  Study resources: {'; '.join(r for r in refs if r)}" if refs else "")
        )
        concepts += [c for c in _get(day, "concepts") or [] if isinstance(c, str)]
    concepts = list(dict.fromkeys(_text(c, 80) for c in concepts if c.strip()))[:12]
    weak = list((user_context or {}).get("weak") or [])[:8]
    mastered = list((user_context or {}).get("mastered") or [])[:8]
    return (
        f"Write interview-preparation study material for these {len(chunk)} study days.\n\n"
        + "\n".join(lines) + "\n\n"
        + (f"Key concepts of these days: {json.dumps(concepts)}\n" if concepts else "")
        + (f"The candidate is weak in: {json.dumps(weak)}: test these more.\n" if weak else "")
        + (f"The candidate has mastered: {json.dumps(mastered)}: do not test these.\n" if mastered else "")
        + f"\nWrite {QUESTIONS_PER_CHUNK} multiple-choice questions and {CARDS_PER_CHUNK} flashcards.\n"
        "Rules:\n"
        "- Test what the days' objectives cover, nothing outside them. No duplicate questions.\n"
        "- Each question has exactly 4 distinct options, written as the option text (no letters), and "
        "\"answer\" is the letter of the correct option: A, B, C or D. Vary the correct letter.\n"
        "- \"explanation\" says briefly why the answer is right.\n"
        "- \"difficulty\" is easy, medium or hard; \"concept\" names the concept the item tests"
        + (" (one of the key concepts)" if concepts else "") + ".\n"
        "- Flashcards: a short question or term on the front, a concise answer on the back.\n"
        "Return ONLY a JSON object, no prose, no markdown:\n"
        '{"questions": [{"question": "...", "options": ["...", "...", "...", "..."], "answer": "B", '
        '"explanation": "...", "difficulty": "medium", "concept": "..."}], '
        '"cards": [{"front": "...", "back": "...", "difficulty": "easy", "concept": "...", "tags": ["..."]}]}'
        + ("\n\nYour previous answer was not usable. Return only the JSON object in exactly this shape." if corrective else "")
    )


def _drop_trailing_commas(text: str) -> str:
    """`text` without commas that directly precede } or ], outside strings
    only (a blanket text replace once rewrote code inside questions)."""
    out, in_string, escaped = [], False, False
    for i, char in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
        elif char == '"':
            in_string = True
        elif char == ",":
            rest = text[i + 1:].lstrip()
            if rest[:1] in ("}", "]"):
                continue
        out.append(char)
    return "".join(out)


def _parse(text: str) -> dict[str, Any]:
    """The JSON object in a model reply; trailing commas are repaired only
    when the strict parse fails."""
    cleaned = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S)
    try:
        return parse_json_object(cleaned)
    except ValueError:
        return parse_json_object(_drop_trailing_commas(cleaned))


def _validated(raw: dict[str, Any]) -> tuple[list[StudyQuestion], list[StudyCard]]:
    questions, cards, seen = [], [], set()
    for item in raw.get("questions") if isinstance(raw.get("questions"), list) else []:
        try:
            question = StudyQuestion.model_validate(item)
        except ValidationError:
            continue
        key = question.question.casefold()
        if key not in seen:
            seen.add(key)
            questions.append(question)
    seen = set()
    for item in raw.get("cards") if isinstance(raw.get("cards"), list) else []:
        try:
            card = StudyCard.model_validate(item)
        except ValidationError:
            continue
        if card.front.casefold() not in seen:
            seen.add(card.front.casefold())
            cards.append(card)
    return questions[:QUESTIONS_PER_CHUNK], cards[:CARDS_PER_CHUNK]


def study_llm():
    """The model for study material: the planner's (PLANNER_LLM /
    PLANNER_MODEL), guarded against a model known to be slow."""
    return get_llm(guarded=True, temperature=0.3, max_tokens=MAX_OUTPUT_TOKENS, profile=settings.planner_llm,
                   model=settings.planner_model or None)


async def _generate_chunk(llm: Any, chunk: list[Any], user_context: dict[str, Any] | None,
                          semaphore: asyncio.Semaphore) -> ChunkMaterial:
    day_numbers = [int(_get(d, "day_number") or 0) for d in chunk]
    error = None
    best: tuple[list[StudyQuestion], list[StudyCard]] = ([], [])
    for corrective in (False, True):
        response = None
        async with semaphore:  # the timeout starts once the call can actually run
            try:
                response = await asyncio.wait_for(
                    llm.ainvoke(_prompt(chunk, user_context, corrective), config=INTERNAL_LLM_CONFIG),
                    timeout=CALL_TIMEOUT_SECONDS)
                questions, cards = _validated(_parse(str(response.content)))
            except Exception as exc:
                forget_response(response)  # never replay an unusable answer from the cache
                error = str(exc)[:200] or type(exc).__name__
                log_failure(logger, f"Study material for days {day_numbers} unavailable"
                                    + ("" if corrective else "; retrying once"), exc)
                continue
        full = len(questions) >= QUESTIONS_PER_CHUNK // 2 and len(cards) >= CARDS_PER_CHUNK // 2
        if full:
            return ChunkMaterial(day_numbers=day_numbers, status="ok", questions=questions, cards=cards)
        # too little usable: never cache it, keep the better of the two tries
        forget_response(response)
        error = "too few valid questions or flashcards in the answer"
        if len(questions) + len(cards) > len(best[0]) + len(best[1]):
            best = (questions, cards)
    if best[0] or best[1]:
        return ChunkMaterial(day_numbers=day_numbers, status="partial", questions=best[0], cards=best[1],
                             error=error)
    return ChunkMaterial(day_numbers=day_numbers, status="failed", error=error)


async def generate_for_sprint(
    days: list[Any], user_context: dict[str, Any] | None = None, llm: Any | None = None,
) -> list[ChunkMaterial]:
    """Questions and flashcards for each 3-4 day chunk of `days` (dicts or
    SprintDay objects: day_number, topic_title, topic_description,
    objectives, references, concepts). `user_context` = {"weak": [...],
    "mastered": [...]} concepts, when known. Never raises for a model
    failure: a chunk comes back with status "failed"."""
    chunks = chunk_days(days)
    if not chunks:
        return []
    llm = llm or study_llm()
    semaphore = asyncio.Semaphore(llm_concurrency(settings, settings.planner_llm))
    results = await asyncio.gather(*(_generate_chunk(llm, chunk, user_context, semaphore) for chunk in chunks))
    logger.info("Study material: %s", ", ".join(f"days {r.day_numbers[0]}-{r.day_numbers[-1]} {r.status}"
                                               f" ({len(r.questions)}q/{len(r.cards)}c)" for r in results))
    return list(results)
