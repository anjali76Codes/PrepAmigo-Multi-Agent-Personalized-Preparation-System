"""Parse Markdown study plans into validated JSON and a merged Markdown file."""

import json
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from itertools import repeat
from pathlib import Path
from typing import Annotated, List, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, StringConstraints, ValidationError

from src.config import get_llm

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
INPUT_DIR = BASE_DIR / "dummy_md"
OUTPUT_DIR = BASE_DIR / "output"
TEST_USER_ID = "000000000000000000000001"
MAX_CONCURRENT_SPRINTS = 4

ReferenceType = Literal["video", "article", "documentation", "problem", "course", "book"]
PlanStatus = Literal["pending", "in_progress", "completed"]
ObjectIdString = Annotated[str, StringConstraints(pattern=r"^[a-fA-F0-9]{24}$")]
ModelT = TypeVar("ModelT", bound=BaseModel)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class PlanOutline(StrictModel):
    company: str
    role: str
    total_days: int
    start_date: str
    end_date: str


class PlanReference(StrictModel):
    type: ReferenceType
    title: str
    is_required: bool
    url: str
    source: str | None = None
    description: str | None = None


class SprintDay(StrictModel):
    day_number: int
    scheduled_date: str
    topic_title: str
    topic_description: str | None = None
    objectives: List[str]
    estimated_minutes: int | None = None
    references: list[PlanReference]
    status: PlanStatus = "pending"
    completed_at: str | None = None


class Sprint(StrictModel):
    sprint_number: int
    sprint_name: str
    start_date: str
    end_date: str
    total_days: int
    sprint_days: list[SprintDay]
    completion_percent: float = 0
    status: PlanStatus = "pending"


class CompletePlan(PlanOutline):
    user_id: ObjectIdString
    plan_name: str
    sprints: list[Sprint]
    completion_percent: float = 0
    status: PlanStatus = "pending"


def call_llm(prompt: str) -> str:
    """Invoke the LLM configured for the agent service and return its text."""
    response = get_llm(temperature=0).invoke(prompt)
    content = getattr(response, "content", response)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            item.get("text", "") if isinstance(item, dict) else str(item)
            for item in content
        )
    return str(content)


def _build_prompt(markdown: str, model_type: type[ModelT], context: str = "") -> str:
    instruction = (
        "Convert the following Markdown text into a valid JSON object. Output ONLY raw JSON. "
        "Do NOT wrap it in markdown code blocks like ```json. Just the raw JSON string. "
        "Map daily topics to topic_title, descriptions to topic_description, dates to "
        "scheduled_date in YYYY-MM-DD format, estimated times to estimated_minutes, "
        "and resources to references. Map each resource's provider to source and infer "
        "references.type only from the allowed enum. Preserve all objectives as strings. "
        "Use the year from the plan outline for sprint and daily dates that omit a year. "
        f"Here is the text: {markdown}"
    )
    schema = json.dumps(model_type.model_json_schema(), indent=2)
    context_section = f"\n\nPlan outline for date context:\n{context}" if context else ""
    return f"{instruction}{context_section}\n\nThe JSON object must match this schema:\n{schema}"


def _clean_json_response(content: str) -> object:
    cleaned = re.sub(r"```(?:json)?|```", "", content, flags=re.IGNORECASE).strip()
    cleaned = re.sub(
        r"^\s*(?:Here is your JSON|Here is the JSON|JSON:)\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    object_start = cleaned.find("{")
    if object_start < 0:
        raise json.JSONDecodeError("No JSON object found in LLM response", cleaned, 0)

    _, object_end = json.JSONDecoder().raw_decode(cleaned[object_start:])
    return json.loads(cleaned[object_start:object_start + object_end])


def _validate(data: object, model_type: type[ModelT], source: Path) -> ModelT:
    try:
        return model_type.model_validate(data)
    except ValidationError as exc:
        logger.error("Pydantic validation failed for %s:\n%s", source, exc)
        raise


def parse_markdown(path: Path, model_type: type[ModelT], context: str = "") -> ModelT:
    markdown = path.read_text(encoding="utf-8")
    response = call_llm(_build_prompt(markdown, model_type, context))
    parsed = _clean_json_response(response)
    return _validate(parsed, model_type, path)


def _parse_sprint(
    sprint_job: tuple[int, Path], outline_context: str
) -> Sprint:
    sprint_number, sprint_path = sprint_job
    sprint = parse_markdown(sprint_path, Sprint, context=outline_context)
    if sprint.sprint_number != sprint_number:
        raise ValueError(
            f"{sprint_path.name} must contain sprint_number {sprint_number}, "
            f"got {sprint.sprint_number}"
        )
    return sprint


def _parse_sprints(sprint_paths: list[Path], outline_context: str) -> list[Sprint]:
    if not sprint_paths:
        return []

    sprint_jobs = enumerate(sprint_paths, start=1)
    with ThreadPoolExecutor(
        max_workers=min(MAX_CONCURRENT_SPRINTS, len(sprint_paths))
    ) as executor:
        return list(executor.map(_parse_sprint, sprint_jobs, repeat(outline_context)))


def _merge_markdown(outline_path: Path, sprint_paths: list[Path]) -> str:
    sections = [outline_path.read_text(encoding="utf-8").strip()]
    for path in sprint_paths:
        sprint_markdown = path.read_text(encoding="utf-8").strip()
        sprint_markdown = re.sub(
            r"^(#{1,5})(?=\s)", r"#\1", sprint_markdown, flags=re.MULTILINE
        )
        sections.append(sprint_markdown)
    return "\n\n---\n\n".join(sections) + "\n"


def main() -> None:
    outline_path = INPUT_DIR / "00_outline.md"
    if not outline_path.is_file():
        raise FileNotFoundError(f"Required outline file not found: {outline_path}")

    sprint_paths = sorted(
        path for path in INPUT_DIR.glob("*.md")
        if re.fullmatch(r"\d+_sprint_.*\.md", path.name)
    )

    outline = parse_markdown(outline_path, PlanOutline)
    user_id = os.getenv("PLAN_USER_ID", "").strip()
    if not user_id:
        user_id = TEST_USER_ID
        logger.warning(
            "PLAN_USER_ID is unset; using test placeholder %s. "
            "Set PLAN_USER_ID to a real user before posting to the API.",
            TEST_USER_ID,
        )

    outline_context = outline_path.read_text(encoding="utf-8")
    sprints = _parse_sprints(sprint_paths, outline_context)

    try:
        validated_plan = CompletePlan.model_validate({
            **outline.model_dump(),
            "user_id": user_id,
            "plan_name": f"{outline.company} {outline.role} Preparation Plan",
            "sprints": [sprint.model_dump() for sprint in sprints],
        })
    except ValidationError as exc:
        logger.error("Pydantic validation failed for the merged plan:\n%s", exc)
        raise

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = OUTPUT_DIR / "complete_plan.json"
    with json_path.open("w", encoding="utf-8") as output_file:
        json.dump(validated_plan.model_dump(mode="json"), output_file, indent=2)
        output_file.write("\n")

    markdown_path = OUTPUT_DIR / "complete_plan.md"
    markdown_path.write_text(
        _merge_markdown(outline_path, sprint_paths), encoding="utf-8"
    )
    logger.info("Wrote %s and %s", json_path, markdown_path)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()