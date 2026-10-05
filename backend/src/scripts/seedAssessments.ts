import mongoose from "mongoose";
import * as dotenv from "dotenv";
import { Sprint } from "../models/Sprint.js";
import { SprintDay } from "../models/SprintDay.js";
import { Assessment } from "../models/Assessment.js";
import { Flashcard } from "../models/Flashcard.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/prepamigo";

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    // Find the first available sprint
    const sprint = await Sprint.findOne().populate("sprint_days");

    if (!sprint) {
      console.log("No Sprint found in the database. Please generate a plan first.");
      process.exit(0);
    }

    console.log(`Processing Sprint: ${sprint.sprint_name}`);

    // Find all days for this sprint
    const sprintDays = await SprintDay.find({ sprint_id: sprint._id });
    console.log(`Found ${sprintDays.length} days for this sprint.`);

    for (const day of sprintDays) {
      console.log(`Generating Assessment and Flashcards for Day ${day.day_number}: ${day.topic_title}`);

      // 1. Create dummy Assessment for this day
      const assessment = new Assessment({
        sprint_day_id: day._id,
        questions: [
          {
            question: `What is a key concept of ${day.topic_title}?`,
            options: ["Concept A", "Concept B", "Concept C", "Concept D"],
            correct_answer: "Concept A",
            explanation: `Concept A is fundamental to understanding ${day.topic_title}.`,
            difficulty: "medium",
            type: "mcq",
          },
          {
            question: `How do you apply ${day.topic_title} in practice?`,
            options: ["Method 1", "Method 2", "Method 3", "Method 4"],
            correct_answer: "Method 2",
            explanation: `Method 2 is the industry standard for applying ${day.topic_title}.`,
            difficulty: "hard",
            type: "mcq",
          }
        ]
      });
      await assessment.save();
      console.log(` - Saved Assessment with ${assessment.questions.length} questions.`);

      // 2. Create dummy Flashcards for this day
      const flashcard = new Flashcard({
        sprint_day_id: day._id,
        cards: [
          {
            front: `Define ${day.topic_title}`,
            back: `It is a core topic covering ${day.objectives.join(", ") || "essential concepts"}.`,
            difficulty: "easy",
            category: "definition",
            tags: [day.topic_title.toLowerCase().replace(/\s+/g, '-')]
          }
        ]
      });
      await flashcard.save();
      console.log(` - Saved Flashcards with ${flashcard.cards.length} cards.`);
    }

    console.log("Successfully seeded assessments and flashcards!");
  } catch (error) {
    console.error("Error seeding data:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

main();
