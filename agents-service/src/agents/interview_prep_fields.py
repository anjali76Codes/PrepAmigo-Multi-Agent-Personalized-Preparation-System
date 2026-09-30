"""Single place to define required workflow fields and their agent routing."""
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class WorkflowField:
    name: str
    label: str
    description: str
    required: bool
    recipients: tuple[str, ...]
    max_length: int = 200


WORKFLOW_FIELDS: tuple[WorkflowField, ...] = (
    WorkflowField(
        name="company",
        label="Company",
        description="The company the candidate is preparing to interview with.",
        required=True,
        recipients=("company_research", "job_intelligence"),
    ),
    WorkflowField(
        name="role",
        label="Target role",
        description="The specific job title or role for interview preparation.",
        required=True,
        recipients=("company_research", "job_intelligence"),
    ),
    WorkflowField(
        name="location",
        label="Job location",
        description="The city, region, country, or remote location for job-market data.",
        required=True,
        recipients=("job_intelligence",),
    ),
)


def empty_workflow_fields() -> dict[str, str]:
    return {field.name: "" for field in WORKFLOW_FIELDS}


def normalize_workflow_fields(values: Any) -> dict[str, str]:
    if not isinstance(values, dict):
        return empty_workflow_fields()
    normalized = empty_workflow_fields()
    definitions = {field.name: field for field in WORKFLOW_FIELDS}
    for name, value in values.items():
        field = definitions.get(name)
        if field and isinstance(value, str):
            normalized[name] = value.strip()[:field.max_length]
    return normalized


def missing_required_fields(values: dict[str, str]) -> list[WorkflowField]:
    return [
        field for field in WORKFLOW_FIELDS
        if field.required and not values.get(field.name, "").strip()
    ]


def fields_for_agent(values: dict[str, str], agent: str) -> dict[str, str]:
    return {
        field.name: values.get(field.name, "")
        for field in WORKFLOW_FIELDS
        if agent in field.recipients and values.get(field.name, "")
    }


def extraction_schema() -> dict[str, Any]:
    return {
        field.name: {
            "type": "string",
            "description": field.description,
            "required": field.required,
        }
        for field in WORKFLOW_FIELDS
    }