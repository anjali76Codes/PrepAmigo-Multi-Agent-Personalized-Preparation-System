import asyncio
import os
import sys
import traceback
from pathlib import Path
from datetime import datetime, timezone

import motor.motor_asyncio
from bson import ObjectId

from dotenv import load_dotenv

_src_dir = str(Path(__file__).resolve().parent.parent)
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

# Load env variables from agents-service/.env
load_dotenv(Path(_src_dir).parent / ".env")

from agents.assessment_agent import AssessmentAgent
from agents.flashcard_agent import FlashcardAgent

MONGO_URI = os.getenv("MONGODB_URI", "mongodb+srv://ganjali9877_db_user:asdfghjkl@travelamigo-cluster.ymfdokn.mongodb.net/database")

class DotDict(dict):
    """Utility class to allow dot access to dictionary keys, mocking Pydantic models."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for key, value in self.items():
            if isinstance(value, dict):
                self[key] = DotDict(value)
            elif isinstance(value, list):
                self[key] = [DotDict(item) if isinstance(item, dict) else item for item in value]
    
    def __getattr__(self, item):
        return self.get(item)
    
    def __setattr__(self, key, value):
        self[key] = value

async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = client.get_default_database()

    # Find Sprint 1
    sprint = await db.sprints.find_one({"sprint_number": 1})
    if not sprint:
        print("No Sprint 1 found in the database. Please generate a plan first.")
        return

    print(f"Processing Sprint 1: {sprint.get('sprint_name')}")

    # Find all days for this sprint
    sprint_days_cursor = db.sprint_days.find({"sprint_id": sprint["_id"]}).sort("day_number", 1)
    sprint_days = await sprint_days_cursor.to_list(length=100)
    print(f"Found {len(sprint_days)} days for this sprint.")

    assessment_agent = AssessmentAgent()
    flashcard_agent = FlashcardAgent()

    for i in range(0, len(sprint_days), 3):
        chunk = sprint_days[i:i+3]
        chunk_ids = [d["_id"] for d in chunk]
        
        chunk_titles = [d.get("topic_title") for d in chunk]
        chunk_objectives = []
        for d in chunk:
            chunk_objectives.extend(d.get("objectives", []))
            
        day_numbers_str = "-".join([str(chunk[0].get("day_number")), str(chunk[-1].get("day_number"))])
        print(f"Generating for Days {day_numbers_str}: {' | '.join(chunk_titles)}")
        
        # Mocking the day object expected by the agents
        mock_day = DotDict({
            "day_number": chunk[0].get("day_number"),
            "topic_title": " | ".join(chunk_titles),
            "objectives": list(set(chunk_objectives))
        })

        # Generate Questions
        questions = await assessment_agent._generate_for_day(1, mock_day)
        if questions:
            # Prepare for DB insertion matching new schema
            db_questions = []
            for q in questions:
                db_questions.append({
                    "question": q.question,
                    "options": q.options or [],
                    "correct_answer": q.correct_answer,
                    "explanation": q.explanation,
                    "difficulty": q.difficulty,
                    "type": q.type,
                    "is_attempted": False,
                    "user_answer": None,
                    "is_correct": None
                })
            
            assessment_doc = {
                "sprint_id": sprint["_id"],
                "covered_sprint_days": chunk_ids,
                "questions": db_questions,
                "score": 0,
                "attempted_questions": 0,
                "correct_answers": 0,
                "wrong_answers": 0,
                "total_attempts": 0,
                "is_completed": False,
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }
            result = await db.assessments.insert_one(assessment_doc)
            assessment_id = result.inserted_id
            
            # Update all SprintDays in the chunk with assessment_id
            await db.sprint_days.update_many(
                {"_id": {"$in": chunk_ids}},
                {"$set": {"assessment_id": assessment_id}}
            )
            print(f" - Saved Assessment with {len(db_questions)} questions to DB and linked to SprintDays.")

        # Generate Flashcards
        cards = await flashcard_agent._generate_for_day(1, mock_day)
        if cards:
            db_cards = []
            for c in cards:
                db_cards.append({
                    "front": c.front,
                    "back": c.back,
                    "difficulty": c.difficulty,
                    "category": c.category,
                    "tags": c.tags or [],
                    "is_reviewed": False,
                    "confidence_level": None,
                    "last_reviewed_at": None
                })
            
            flashcard_doc = {
                "sprint_id": sprint["_id"],
                "covered_sprint_days": chunk_ids,
                "cards": db_cards,
                "reviewed_count": 0,
                "total_attempts": 0,
                "is_completed": False,
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }
            result = await db.flashcards.insert_one(flashcard_doc)
            flashcard_id = result.inserted_id
            
            # Update all SprintDays in the chunk with flashcard_id
            await db.sprint_days.update_many(
                {"_id": {"$in": chunk_ids}},
                {"$set": {"flashcard_id": flashcard_id}}
            )
            print(f" - Saved Flashcards with {len(db_cards)} cards to DB and linked to SprintDays.")

    print("Successfully generated and stored assessments and flashcards in MongoDB!")

if __name__ == "__main__":
    asyncio.run(main())
