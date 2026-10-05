import asyncio
import os
import sys
from pathlib import Path

import motor.motor_asyncio
from dotenv import load_dotenv

_src_dir = str(Path(__file__).resolve().parent.parent)
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

load_dotenv(Path(_src_dir).parent / ".env")

MONGO_URI = os.getenv("MONGODB_URI", "mongodb+srv://ganjali9877_db_user:asdfghjkl@travelamigo-cluster.ymfdokn.mongodb.net/database")

async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = client.get_default_database()

    print("Dropping collections: plans, sprints, sprint_days, assessments, flashcards...")
    await db.plans.delete_many({})
    await db.sprints.delete_many({})
    await db.sprint_days.delete_many({})
    await db.assessments.delete_many({})
    await db.flashcards.delete_many({})
    
    print("Database cleared successfully!")

if __name__ == "__main__":
    asyncio.run(main())
