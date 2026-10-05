import asyncio
import json
import logging
from typing import Any, List

from core.config import get_llm, settings
from graph.events import INTERNAL_LLM_CONFIG
from tools.plan_builder import parse_json_object
from schemas.study_plan import StudyPlan
from schemas.flashcard import Flashcard, Flashcards

logger = logging.getLogger(__name__)

class FlashcardAgent:
    name = "flashcard_agent"

    def __init__(self, llm: Any | None = None):
        self._llm = llm

    @property
    def llm(self):
        if self._llm is None:
            self._llm = get_llm(temperature=0.3, max_tokens=1500, profile=settings.planner_llm,
                                model=settings.planner_model or None)
        return self._llm

    async def generate_flashcards(self, plan: StudyPlan | dict) -> dict:
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
                    class MockDay:
                        day_number = chunk[0].day_number
                        topic_title = " | ".join(titles)
                        objectives = list(set(objectives))
                    
                    tasks.append(self._generate_for_day(sprint.sprint_number, MockDay()))

        results = await asyncio.gather(*tasks)
        cards = []
        for c_list in results:
            if c_list:
                cards.extend(c_list)
        
        flashcards = Flashcards(cards=cards)
        return flashcards.model_dump()

    async def _generate_for_day(self, sprint_num: int, day: Any) -> List[Flashcard]:
        prompt = (
            f"Generate revision-focused flashcards for the following study topic.\n"
            f"Topic: {day.topic_title}\n"
            f"Objectives: {', '.join(day.objectives)}\n"
            f"Maximum 5 flashcards. Ensure they are concise.\n"
            f"Output JSON in exactly this format: {{\"cards\": [{{\"front\": \"...\", \"back\": \"...\", \"difficulty\": \"easy\", \"category\": \"concept\", \"tags\": [\"tag1\"]}}]}}\n"
            f"Return ONLY a JSON object."
        )
        for attempt in range(3):
            try:
                response = await asyncio.wait_for(
                    self.llm.ainvoke(prompt, config=INTERNAL_LLM_CONFIG), timeout=120
                )
                # Quick fix for trailing commas before parsing
                content = str(response.content).replace(",]", "]").replace(",}", "}")
                raw = parse_json_object(content).get("cards", [])
                cards = []
                for i, c in enumerate(raw):
                    cards.append(Flashcard(
                        id=f"s{sprint_num}-d{day.day_number}-fc{i+1}",
                        sprint=sprint_num,
                        day=day.day_number,
                        topic_title=day.topic_title,
                        front=c.get("front", ""),
                        back=c.get("back", ""),
                        difficulty=c.get("difficulty", "medium"),
                        category=c.get("category", "concept"),
                        tags=c.get("tags", [])
                    ))
                return cards
            except Exception as e:
                logger.warning(f"Failed to generate flashcards for day {day.day_number} on attempt {attempt+1}: {e}")
        logger.error(f"Completely failed to generate flashcards for day {day.day_number} after 3 attempts.")
        return []
