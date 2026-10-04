import asyncio
import os
import sys
from pathlib import Path

import motor.motor_asyncio
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')

_src_dir = str(Path(__file__).resolve().parent.parent)
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

load_dotenv(Path(_src_dir).parent / ".env")

from core.config import get_llm

MONGO_URI = os.getenv("MONGODB_URI", "mongodb+srv://ganjali9877_db_user:asdfghjkl@travelamigo-cluster.ymfdokn.mongodb.net/database")

async def evaluate_chunk(db, assessment, flashcard, days_chunk):
    topic_titles = [d.get("topic_title") for d in days_chunk]
    objectives = []
    for d in days_chunk:
        objectives.extend(d.get("objectives", []))
    
    input_text = f"TOPICS:\n" + "\n".join(topic_titles) + "\n\nOBJECTIVES:\n" + "\n".join(objectives)
    
    output_text = "GENERATED ASSESSMENT QUESTIONS:\n"
    for idx, q in enumerate(assessment.get("questions", [])):
        output_text += f"Q{idx+1}: {q.get('question')}\n"
        output_text += f"Explanation: {q.get('explanation')}\n\n"
        
    output_text += "GENERATED FLASHCARDS:\n"
    for idx, f in enumerate(flashcard.get("cards", [])):
        output_text += f"Card {idx+1} Front: {f.get('front')}\n"
        output_text += f"Card {idx+1} Back: {f.get('back')}\n\n"
        
    prompt = (
        "You are an expert Educational AI Evaluator. Your task is to evaluate the quality of LLM-generated study materials.\n"
        "You will be given the original INPUT (the topics and learning objectives the AI was supposed to cover) and the actual OUTPUT (the generated multiple-choice questions and flashcards).\n\n"
        "Analyze the output against the input and write a structured Markdown report covering:\n"
        "1. **Coverage Analysis**: How many of the objectives are actually tested?\n"
        "2. **Relevance Analysis**: Did it stick to the topic or hallucinate out-of-scope concepts?\n"
        "3. **Quality Analysis**: Are the questions intellectually stimulating?\n"
        "4. **Summary**: Provide final scores out of 100 for Coverage, Relevance, and Quality.\n\n"
        f"=== ORIGINAL INPUT ===\n{input_text}\n\n"
        f"=== GENERATED OUTPUT ===\n{output_text}\n"
    )
    
    llm = get_llm(temperature=0.0) 
    
    print("Running LLM-as-a-Judge Evaluation...")
    try:
        response = await asyncio.wait_for(llm.ainvoke(prompt), timeout=120)
        return response.content
    except Exception as e:
        print(f"Evaluation failed: {e}")
        return None

async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = client.get_default_database()

    sprint = await db.sprints.find_one({"sprint_number": 1})
    if not sprint:
        print("Sprint 1 not found.")
        return

    assessments = await db.assessments.find({"sprint_id": sprint["_id"]}).to_list(length=100)
    
    print(f"Found {len(assessments)} chunks (assessments) for Sprint 1. Starting evaluation pipeline...\n")
    
    final_report = f"# Evaluation Report for Sprint: {sprint.get('sprint_name')}\n\n"
    
    for idx, assessment in enumerate(assessments):
        covered_ids = assessment.get("covered_sprint_days", [])
        flashcard = await db.flashcards.find_one({
            "sprint_id": sprint["_id"],
            "covered_sprint_days": covered_ids
        })
        sprint_days = await db.sprint_days.find({"_id": {"$in": covered_ids}}).to_list(length=100)
        
        if not flashcard or not sprint_days:
            continue
            
        print(f"\nEvaluating Chunk {idx + 1} (Covering {len(sprint_days)} Days)...")
        eval_result = await evaluate_chunk(db, assessment, flashcard, sprint_days)
        
        if eval_result:
            day_numbers = [str(d.get('day_number')) for d in sprint_days]
            final_report += f"## Evaluation for Days {day_numbers[0]}-{day_numbers[-1]}\n\n"
            final_report += eval_result + "\n\n---\n\n"
            print(f"✅ Chunk {idx+1} evaluation complete.")

    with open("evaluation_report.md", "w", encoding="utf-8") as f:
        f.write(final_report)
    print("\n🏆 DONE! The full evaluation report has been saved to evaluation_report.md")

if __name__ == "__main__":
    asyncio.run(main())
