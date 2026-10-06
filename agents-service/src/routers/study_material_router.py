"""
Study material and knowledge-graph endpoints the backend calls.

  POST /internal/study-material     questions + flashcards for a sprint's days
  POST /internal/knowledge/attempt  quiz / flashcard results -> the user's graph

The backend owns MongoDB: it sends the days, saves what comes back, and
reports results. This service keeps no state of its own; the knowledge
graph (Neo4j) is derived data it can rebuild, read here to personalise the
material (graph/knowledge_graph.py).
"""
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from agents.study_material import generate_for_sprint
from core.auth import resolve_user_id, verify_token
from graph.knowledge_graph import best_effort, get_knowledge_graph

router = APIRouter()


class MaterialReference(BaseModel):
    title: str = ""
    url: str = ""


class MaterialDay(BaseModel):
    day_number: int = Field(ge=1)
    topic_title: str = Field(min_length=1, max_length=200)
    topic_description: str | None = None
    objectives: list[str] = Field(default_factory=list)
    references: list[MaterialReference] = Field(default_factory=list)
    concepts: list[str] = Field(default_factory=list)


class StudyMaterialRequest(BaseModel):
    user_id: str | None = None  # used only when auth is off; otherwise the token says
    days: list[MaterialDay] = Field(min_length=1, max_length=14)


class AttemptResult(BaseModel):
    concept: str = Field(min_length=1, max_length=120)
    correct: bool | None = None
    score: float | None = Field(default=None, ge=0, le=1)


class KnowledgeAttemptRequest(BaseModel):
    user_id: str | None = None
    results: list[AttemptResult] = Field(min_length=1, max_length=200)


async def _graph():
    return await best_effort("opening the graph", get_knowledge_graph)


@router.post("/internal/study-material")
async def study_material(request: StudyMaterialRequest, auth_payload: Any = Depends(verify_token)) -> dict:
    """Questions and flashcards per 3-4 day chunk of the given days. A
    chunk the model could not write comes back with status "failed"; the
    request itself only fails on bad input."""
    user_id = resolve_user_id(auth_payload, request.user_id)
    context = None
    graph = await _graph() if user_id else None
    if graph is not None:
        concepts = [c for day in request.days for c in day.concepts]
        context = await best_effort("reading the study context", graph.study_context, user_id, concepts)
    chunks = await generate_for_sprint([day.model_dump() for day in request.days], context)
    return {"success": True, "data": {
        "chunks": [chunk.model_dump() for chunk in chunks],
        "personalised": bool(context and (context.get("weak") or context.get("mastered"))),
    }}


@router.post("/internal/knowledge/attempt")
async def knowledge_attempt(request: KnowledgeAttemptRequest, auth_payload: Any = Depends(verify_token)) -> dict:
    """Per-concept results of a quiz or flashcard review. Returns each
    concept's new proficiency ({} when the graph is unavailable: results
    are kept by the backend either way)."""
    user_id = resolve_user_id(auth_payload, request.user_id)
    graph = await _graph() if user_id else None
    updated = None
    if graph is not None:
        updated = await best_effort("recording an attempt", graph.record_attempt, user_id,
                                    [result.model_dump() for result in request.results])
    return {"success": True, "data": {"updated": updated or {}}}
