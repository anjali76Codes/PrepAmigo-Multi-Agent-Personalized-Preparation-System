"""Flashcard decks for a whole plan, one deck per 3-4 day chunk of each
sprint. The generation itself (prompt, validation, retries, concurrency)
is shared with the assessments: agents/study_material.py."""
import asyncio
from typing import Any

from agents.study_material import generate_for_sprint
from schemas.flashcard import Flashcard, Flashcards
from schemas.study_plan import StudyPlan


class FlashcardAgent:
    name = "flashcard_agent"

    def __init__(self, llm: Any | None = None):
        self._llm = llm

    async def generate_flashcards(self, plan: StudyPlan | dict, user_context: dict | None = None) -> dict:
        if isinstance(plan, dict):
            plan = StudyPlan.model_validate(plan)
        per_sprint = await asyncio.gather(*(
            generate_for_sprint(sprint.sprint_days, user_context, llm=self._llm) for sprint in plan.sprints))
        cards = []
        for sprint, chunks in zip(plan.sprints, per_sprint):
            titles = {d.day_number: d.topic_title for d in sprint.sprint_days}
            for chunk in chunks:
                topic = " | ".join(titles[n] for n in chunk.day_numbers if n in titles)
                for i, c in enumerate(chunk.cards, start=1):
                    cards.append(Flashcard(
                        id=f"s{sprint.sprint_number}-d{chunk.day_numbers[0]}-fc{i}",
                        sprint=sprint.sprint_number, day=chunk.day_numbers[0], topic_title=topic,
                        front=c.front, back=c.back, difficulty=c.difficulty, category="concept",
                        tags=c.tags, concept=c.concept or None,
                    ))
        return Flashcards(cards=cards).model_dump()
