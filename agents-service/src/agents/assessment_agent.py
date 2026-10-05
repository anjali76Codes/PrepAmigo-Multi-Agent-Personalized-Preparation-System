import asyncio
import json
import logging
from types import SimpleNamespace
from typing import Any, List

from core.config import get_llm, settings
from graph.events import INTERNAL_LLM_CONFIG
from tools.plan_builder import parse_json_object
from schemas.study_plan import StudyPlan
from schemas.assessment import Assessment, AssessmentQuestion

logger = logging.getLogger(__name__)

class AssessmentAgent:
    name = "assessment_agent"

    def __init__(self, llm: Any | None = None):
        self._llm = llm

    @property
    def llm(self):
        if self._llm is None:
            self._llm = get_llm(temperature=0.3, max_tokens=3000, profile=settings.planner_llm,
                                model=settings.planner_model or None)
        return self._llm

    async def generate_assessment(self, plan: StudyPlan | dict) -> dict:
        if isinstance(plan, dict):
            plan = StudyPlan.model_validate(plan)

        tasks = []
        for sprint in plan.sprints:
            days = sprint.sprint_days
            chunks = []
            if len(days) >= 3:
                chunks.append(days[0:3])
            if len(days) > 3:
                chunks.append(days[3:7])
                
            for chunk in chunks:
                titles = [d.topic_title for d in chunk if d.topic_title]
                objectives = []
                for d in chunk:
                    objectives.extend(d.objectives)
                
                if titles:
                    # one "day" standing for the chunk (a class body could not read
                    # the enclosing `objectives` here: NameError on every plan)
                    chunk_day = SimpleNamespace(
                        day_number=chunk[0].day_number,
                        topic_title=" | ".join(titles),
                        objectives=list(dict.fromkeys(objectives)),
                    )
                    
                    tasks.append(self._generate_for_day(sprint.sprint_number, chunk_day))

        results = await asyncio.gather(*tasks)
        questions = []
        for q_list in results:
            if q_list:
                questions.extend(q_list)
        
        assessment = Assessment(questions=questions)
        return assessment.model_dump()

    async def _generate_for_day(self, sprint_num: int, day: Any) -> List[AssessmentQuestion]:
        prompt = (
            f"Generate multiple choice questions for the following study topic.\n"
            f"Topic: {day.topic_title}\n"
            f"Objectives: {', '.join(day.objectives)}\n"
            f"Maximum 10 questions. Ensure they are high-quality and non-duplicate.\n"
            f"Output JSON in exactly this format: {{\"questions\": [{{\"question\": \"...\", \"options\": [\"A\", \"B\", \"C\", \"D\"], \"correct_answer\": \"A\", \"explanation\": \"...\", \"difficulty\": \"medium\"}}]}}\n"
            f"Return ONLY a JSON object."
        )
        for attempt in range(3):
            try:
                response = await asyncio.wait_for(
                    self.llm.ainvoke(prompt, config=INTERNAL_LLM_CONFIG), timeout=120
                )
                # Quick fix for trailing commas before parsing
                content = str(response.content).replace(",]", "]").replace(",}", "}")
                raw = parse_json_object(content).get("questions", [])
                questions = []
                for i, q in enumerate(raw):
                    questions.append(AssessmentQuestion(
                        id=f"s{sprint_num}-d{day.day_number}-q{i+1}",
                        sprint=sprint_num,
                        day=day.day_number,
                        topic_title=day.topic_title,
                        type="mcq",
                        question=q.get("question", ""),
                        options=q.get("options", []),
                        correct_answer=q.get("correct_answer", ""),
                        explanation=q.get("explanation", ""),
                        difficulty=q.get("difficulty", "medium")
                    ))
                return questions
            except Exception as e:
                logger.warning(f"Failed to generate assessment for day {day.day_number} on attempt {attempt+1}: {e}")
        logger.error(f"Completely failed to generate assessment for day {day.day_number} after 3 attempts.")
        return []
