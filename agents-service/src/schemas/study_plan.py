"""
Study plan contract: matches the backend's MongoDB models
(backend/src/models/{Plan,Sprint,SprintDay}.ts) with independent entities
for Plan, Sprint, and SprintDay.

Field names, enums and length limits mirror the backend's Zod request
schemas (backend/src/utils/planApi.ts), so a plan that validates here is
accepted there. The sequential API creation creates the three levels
through separate endpoints (POST /api/plans, /api/sprints,
/api/sprint-days), each with an independent body.
"""
from datetime import date
from typing import Annotated, Any, Literal, Optional
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


class PlanEntity(_Strict):
    user_id: Optional[ObjectId] = None
    plan_name: str = Field(min_length=1, max_length=120)
    company: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=200)
    total_days: int = Field(ge=1)
    start_date: date
    end_date: date
    completion_percent: float = Field(default=0, ge=0, le=100)
    status: Status = "pending"

    @model_validator(mode="after")
    def _dates_consistent(self) -> "PlanEntity":
        if self.end_date < self.start_date:
            raise ValueError("plan end_date is before start_date")
        return self


class SprintEntity(_Strict):
    plan_id: Optional[ObjectId] = None
    sprint_number: int = Field(ge=1)
    sprint_name: str = Field(min_length=1, max_length=120)
    start_date: date
    end_date: date
    total_days: int = Field(ge=1)
    completion_percent: float = Field(default=0, ge=0, le=100)
    status: Status = "pending"

    @model_validator(mode="after")
    def _dates_consistent(self) -> "SprintEntity":
        if self.end_date < self.start_date:
            raise ValueError(f"sprint {self.sprint_number}: end_date is before start_date")
        return self


class SprintDayEntity(_Strict):
    sprint_id: Optional[ObjectId] = None
    sprint_number: Optional[int] = Field(default=None, ge=1)
    day_number: int = Field(ge=1)
    scheduled_date: date
    topic_title: str = Field(min_length=1, max_length=200)
    topic_description: Optional[str] = Field(default=None, max_length=4000)
    objectives: list[Objective] = Field(default_factory=list, max_length=30)
    estimated_minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    references: list[PlanReference] = Field(default_factory=list, max_length=50)
    status: Status = "pending"
    completed_at: Optional[str] = None


class SprintDay(SprintDayEntity):
    pass


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


class SeparatedStudyPlan(_Strict):
    plan: PlanEntity
    sprints: list[SprintEntity] = Field(min_length=1)
    sprint_days: list[SprintDayEntity] = Field(min_length=1)
    sprint: Optional[list[SprintEntity]] = None
    sprintday: Optional[list[SprintDayEntity]] = None

    @model_validator(mode="after")
    def _consistent(self) -> "SeparatedStudyPlan":
        if self.plan.total_days != sum(s.total_days for s in self.sprints):
            raise ValueError("plan total_days doesn't match the sum of its sprints' days")
        if len(self.sprint_days) != self.plan.total_days:
            raise ValueError(f"total sprint_days ({len(self.sprint_days)}) != plan total_days ({self.plan.total_days})")
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

    def to_separated(self) -> dict[str, Any]:
        """Convert nested StudyPlan into independent objects matching MongoDB entities."""
        plan_dict = {
            "user_id": self.user_id,
            "plan_name": self.plan_name,
            "company": self.company,
            "role": self.role,
            "total_days": self.total_days,
            "start_date": self.start_date.isoformat() if isinstance(self.start_date, date) else self.start_date,
            "end_date": self.end_date.isoformat() if isinstance(self.end_date, date) else self.end_date,
            "completion_percent": self.completion_percent,
            "status": self.status,
        }
        sprints_list = []
        days_list = []
        for s in self.sprints:
            sprints_list.append({
                "sprint_number": s.sprint_number,
                "sprint_name": s.sprint_name,
                "start_date": s.start_date.isoformat() if isinstance(s.start_date, date) else s.start_date,
                "end_date": s.end_date.isoformat() if isinstance(s.end_date, date) else s.end_date,
                "total_days": s.total_days,
                "completion_percent": s.completion_percent,
                "status": s.status,
            })
            for d in s.sprint_days:
                days_list.append({
                    "sprint_number": s.sprint_number,
                    "day_number": d.day_number,
                    "scheduled_date": d.scheduled_date.isoformat() if isinstance(d.scheduled_date, date) else d.scheduled_date,
                    "topic_title": d.topic_title,
                    "topic_description": d.topic_description,
                    "objectives": list(d.objectives),
                    "estimated_minutes": d.estimated_minutes,
                    "references": [r.model_dump(mode="json") for r in d.references],
                    "status": d.status,
                    "completed_at": d.completed_at,
                })
        return {
            "plan": plan_dict,
            "sprints": sprints_list,
            "sprint_days": days_list,
            "sprint": sprints_list,
            "sprintday": days_list,
        }

    @classmethod
    def model_validate(cls, obj: Any, *, strict: bool | None = None, from_attributes: bool | None = None, context: Any | None = None) -> "StudyPlan":
        if isinstance(obj, dict) and ("plan" in obj or "sprint_days" in obj or "sprintday" in obj or "nested_plan" in obj):
            if "nested_plan" in obj and isinstance(obj["nested_plan"], dict):
                return super().model_validate(obj["nested_plan"], strict=strict, from_attributes=from_attributes, context=context)
            return cls.from_separated(obj)
        return super().model_validate(obj, strict=strict, from_attributes=from_attributes, context=context)

    @classmethod
    def from_separated(cls, data: dict[str, Any]) -> "StudyPlan":
        """Reconstruct nested StudyPlan from separated entities."""
        plan_data = data.get("plan") if isinstance(data.get("plan"), dict) else data
        sprints_data = data.get("sprints") or data.get("sprint") or []
        days_data = data.get("sprint_days") or data.get("sprintday") or []

        sprint_days_by_num: dict[int, list[dict[str, Any]]] = {}
        for d in days_data:
            s_num = d.get("sprint_number", 1)
            sprint_days_by_num.setdefault(s_num, []).append(d)

        sprints = []
        for s in sprints_data:
            s_num = s["sprint_number"]
            s_days = sprint_days_by_num.get(s_num, [])
            sprints.append({
                **s,
                "sprint_days": s_days,
            })

        return super().model_validate({
            **plan_data,
            "sprints": sprints,
        }, strict=strict, from_attributes=from_attributes, context=context)
