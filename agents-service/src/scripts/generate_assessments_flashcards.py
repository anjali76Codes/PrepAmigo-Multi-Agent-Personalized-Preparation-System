import asyncio
import json
import sys
from pathlib import Path
from datetime import date

_src_dir = str(Path(__file__).resolve().parent.parent)
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from schemas.study_plan import StudyPlan, Sprint, SprintDay
from agents.assessment_agent import AssessmentAgent
from agents.flashcard_agent import FlashcardAgent

async def main():
    plan = StudyPlan(
        plan_name="Mock Plan",
        company="Mock Company",
        role="Software Engineer",
        total_days=1,
        start_date=date.today(),
        end_date=date.today(),
        sprints=[
            Sprint(
                sprint_number=1,
                sprint_name="Sprint 1",
                start_date=date.today(),
                end_date=date.today(),
                total_days=1,
                sprint_days=[
                    SprintDay(
                        day_number=1,
                        scheduled_date=date.today(),
                        topic_title="Introduction to React",
                        topic_description="Learn the basics of React",
                        objectives=["Understand components", "Learn JSX syntax", "Use state and props"],
                        estimated_minutes=60,
                        status="pending"
                    )
                ]
            )
        ]
    )

    assessment_agent = AssessmentAgent()
    flashcard_agent = FlashcardAgent()

    print("Generating assessment...")
    assessment = await assessment_agent.generate_assessment(plan)
    with open("assessment.json", "w") as f:
        json.dump(assessment, f, indent=2)

    print("Generating flashcards...")
    flashcards = await flashcard_agent.generate_flashcards(plan)
    with open("flashcards.json", "w") as f:
        json.dump(flashcards, f, indent=2)

    print("Successfully generated assessment.json and flashcards.json")

if __name__ == "__main__":
    asyncio.run(main())
