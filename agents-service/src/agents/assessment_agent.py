"""Multiple-choice assessments for a whole plan, one set per 3-4 day chunk
of each sprint. The generation itself (prompt, validation, retries,
concurrency) is shared with the flashcards: agents/study_material.py."""
import asyncio
from typing import Any

from agents.study_material import generate_for_sprint
from schemas.assessment import Assessment, AssessmentQuestion
from schemas.study_plan import StudyPlan


class AssessmentAgent:
    name = "assessment_agent"

    def __init__(self, llm: Any | None = None):
        self._llm = llm

    async def generate_assessment(self, plan: StudyPlan | dict, user_context: dict | None = None) -> dict:
        if isinstance(plan, dict):
            plan = StudyPlan.model_validate(plan)
        per_sprint = await asyncio.gather(*(
            generate_for_sprint(sprint.sprint_days, user_context, llm=self._llm) for sprint in plan.sprints))
        questions = []
        for sprint, chunks in zip(plan.sprints, per_sprint):
            titles = {d.day_number: d.topic_title for d in sprint.sprint_days}
            for chunk in chunks:
                topic = " | ".join(titles[n] for n in chunk.day_numbers if n in titles)
                for i, q in enumerate(chunk.questions, start=1):
                    questions.append(AssessmentQuestion(
                        id=f"s{sprint.sprint_number}-d{chunk.day_numbers[0]}-q{i}",
                        sprint=sprint.sprint_number, day=chunk.day_numbers[0], topic_title=topic,
                        question=q.question, options=q.options, correct_answer=q.answer,
                        explanation=q.explanation, difficulty=q.difficulty, concept=q.concept or None,
                    ))
        return Assessment(questions=questions).model_dump()
