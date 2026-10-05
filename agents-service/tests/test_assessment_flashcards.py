"""Assessment and flashcard generation over a planner-built plan: one set
per sprint chunk (days 1-3 and 4-7). Both agents used to raise NameError
for every plan (a class body reading the enclosing `objectives`)."""
import asyncio
import json
from datetime import date

from langchain_core.messages import AIMessage

from agents.assessment_agent import AssessmentAgent
from agents.flashcard_agent import FlashcardAgent
from agents.planner_agent import PlannerAgent
from test_planner_agent import GAPS, MODULES, ChunkLLM


class QuizLLM:
    def __init__(self):
        self.prompts = []

    async def ainvoke(self, prompt, config=None):
        self.prompts.append(prompt)
        if '"questions"' in prompt:
            return AIMessage(content=json.dumps({"questions": [
                {"question": "Q?", "options": ["A", "B", "C", "D"], "correct_answer": "A", "explanation": "e"}]}))
        return AIMessage(content=json.dumps({"cards": [{"front": "f", "back": "b", "tags": ["t"]}]}))


def _plan(days=45):
    return asyncio.run(PlannerAgent(llm=ChunkLLM()).build_plan(
        MODULES, GAPS, "FDE", "Anthropic", start_date=date(2026, 1, 1), total_days=days))


def test_every_sprint_chunk_gets_an_assessment_and_flashcards():
    plan = _plan()
    chunks = sum(2 for s in plan["sprints"] if s["total_days"] > 3)  # 45 days: 7 sprints of 6-7 days

    quiz, cards = QuizLLM(), QuizLLM()
    asyncio.run(AssessmentAgent(llm=quiz).generate_assessment(plan))
    asyncio.run(FlashcardAgent(llm=cards).generate_flashcards(plan))

    assert len(quiz.prompts) == len(cards.prompts) == chunks == 14
    first_sprint_titles = " | ".join(d["topic_title"] for d in plan["nested_plan"]["sprints"][0]["sprint_days"][:3])
    assert any(first_sprint_titles in prompt for prompt in quiz.prompts)
