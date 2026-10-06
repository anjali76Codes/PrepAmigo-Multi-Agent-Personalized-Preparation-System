/**
 * Generate missing assessments and flashcards for sprints saved before
 * just-in-time generation existed (replaces agents-service's
 * generate_from_db.py, which wrote to MongoDB from the agent service).
 *
 *   npm run backfill:study-material                 every sprint that is missing material
 *   npm run backfill:study-material -- <planId>     one plan's sprints
 *
 * Needs the agents service running (AGENTS_SERVICE_URL). Only days without
 * an assessment are sent, so it is safe to re-run.
 */
import mongoose, { Types } from "mongoose";

import { connectDB } from "../config/db.js";
import { Sprint } from "../models/Sprint.js";
import { SprintDay } from "../models/SprintDay.js";
import { ensureStudyMaterial } from "../services/studyMaterial.js";

async function main() {
  await connectDB();
  const planId = process.argv[2];
  const filter = planId && Types.ObjectId.isValid(planId) ? { plan_id: new Types.ObjectId(planId) } : {};
  const sprints = await Sprint.find(filter).sort({ plan_id: 1, sprint_number: 1 }).select("_id sprint_number sprint_name").lean();
  let done = 0;
  for (const sprint of sprints) {
    if (!(await SprintDay.exists({ sprint_id: sprint._id, assessment_id: { $exists: false } }))) continue;
    process.stdout.write(`Sprint ${sprint.sprint_number} (${sprint.sprint_name}) ... `);
    try {
      const result = await ensureStudyMaterial(sprint._id as Types.ObjectId);
      console.log(`${result.generated} chunk(s) saved${result.failed ? `, ${result.failed} to retry` : ""}`);
      done += 1;
    } catch (error) {
      console.log(`failed: ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log(done ? `Done: ${done} sprint(s) processed.` : "Nothing to do: every sprint has its material.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
