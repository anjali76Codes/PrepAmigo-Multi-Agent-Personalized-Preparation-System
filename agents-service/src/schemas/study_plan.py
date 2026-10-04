"""
Study plan contract: the nested plan -> sprints -> sprint_days shape the
backend persists (backend/src/models/{Plan,Sprint,SprintDay}.ts).

Field names, enums and length limits mirror the backend's Zod request
schemas (backend/src/utils/planApi.ts), so a plan that validates here is
accepted there. The nesting and the status/completion defaults follow
parser_agent.py's CompletePlan (output/complete_plan.json), so both
producers emit the same document. The backend creates the three levels
through separate endpoints (POST /plans, /plans/:id/sprints,
/sprints/:id/days), each with a strict body — the caller posts only that
level's fields; ids, user_id, status and completion are set server-side.

Beyond per-field limits, StudyPlan checks the arithmetic an LLM gets wrong
and Zod can't see: sprint/plan totals match their days, dates sit inside
their ranges, and day numbers run 1..N across the whole plan.
"""
from datetime import date
from typing import Annotated, Literal, Optional
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

SCHEMA_VERSION = "1.0"

Status = Literal["pending", "in_progress", "completed"]
ReferenceType = Literal["video", "article", "documentation", "problem", "course", "book"]
Objective = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
ObjectId = Annotated[str, StringConstraints(pattern=r"^[a-fA-F0-9]{24}$")]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PlanReference(_Strict):
    type: ReferenceType
    title: str = Field(min_length=1, max_length=300)
    url: str = Field(max_length=2048)
    source: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    is_required: bool = True

    @field_validator("url")
    @classmethod
    def _http_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("url must be an absolute http(s) URL")
        return value


class SprintDay(_Strict):
    day_number: int = Field(ge=1)
    scheduled_date: date
    topic_title: str = Field(min_length=1, max_length=200)
    topic_description: Optional[str] = Field(default=None, max_length=4000)
    objectives: list[Objective] = Field(default_factory=list, max_length=30)
    estimated_minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    references: list[PlanReference] = Field(default_factory=list, max_length=50)
    status: Status = "pending"
    completed_at: Optional[str] = None


class Sprint(_Strict):
    sprint_number: int = Field(ge=1)
    sprint_name: str = Field(min_length=1, max_length=120)
    start_date: date
    end_date: date
    total_days: int = Field(ge=1)
    sprint_days: list[SprintDay] = Field(min_length=1)
    completion_percent: float = Field(default=0, ge=0, le=100)
    status: Status = "pending"

    @model_validator(mode="after")
    def _consistent(self) -> "Sprint":
        if self.end_date < self.start_date:
            raise ValueError(f"sprint {self.sprint_number}: end_date is before start_date")
        if self.total_days != len(self.sprint_days):
            raise ValueError(
                f"sprint {self.sprint_number}: total_days={self.total_days} "
                f"but it has {len(self.sprint_days)} day(s)"
            )
        for day in self.sprint_days:
            if not self.start_date <= day.scheduled_date <= self.end_date:
                raise ValueError(
                    f"sprint {self.sprint_number}: day {day.day_number} is scheduled outside the sprint's dates"
                )
        return self


class StudyPlan(_Strict):
    user_id: Optional[ObjectId] = None
    plan_name: str = Field(min_length=1, max_length=120)
    company: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=200)
    total_days: int = Field(ge=1)
    start_date: date
    end_date: date
    sprints: list[Sprint] = Field(min_length=1)
    completion_percent: float = Field(default=0, ge=0, le=100)
    status: Status = "pending"

    @model_validator(mode="after")
    def _consistent(self) -> "StudyPlan":
        if self.end_date < self.start_date:
            raise ValueError("plan end_date is before start_date")
        if self.total_days != sum(s.total_days for s in self.sprints):
            raise ValueError("plan total_days doesn't match the sum of its sprints' days")
        if [s.sprint_number for s in self.sprints] != list(range(1, len(self.sprints) + 1)):
            raise ValueError("sprint numbers must run 1..N in order")
        day_numbers = [d.day_number for s in self.sprints for d in s.sprint_days]
        if day_numbers != list(range(1, self.total_days + 1)):
            raise ValueError("day numbers must run 1..total_days across the whole plan")
        if self.sprints[0].start_date != self.start_date or self.sprints[-1].end_date != self.end_date:
            raise ValueError("plan dates must span exactly its first to last sprint")
        return self
