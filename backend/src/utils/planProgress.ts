import { Types } from "mongoose";
import { Plan, PlanStatus } from "../models/Plan.js";
import { PlanProgress, IPlanProgress } from "../models/PlanProgress.js";
import { Sprint, SprintStatus } from "../models/Sprint.js";
import { SprintDay } from "../models/SprintDay.js";
import { ensureStudyMaterialInBackground, nextSprintId } from "../services/studyMaterial.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function syncSprintAndPlan(sprintId: Types.ObjectId, planId: Types.ObjectId) {
  const sprint = await Sprint.findById(sprintId).select("total_days");
  const totalSprintDays = sprint?.total_days ?? 0;
  const completedSprintDays = await SprintDay.countDocuments({ sprint_id: sprintId, status: "completed" });
  const sprintPercent = totalSprintDays ? Math.min(100, Math.round((completedSprintDays / totalSprintDays) * 100)) : 0;
  const sprintStatus: SprintStatus = totalSprintDays > 0 && completedSprintDays >= totalSprintDays
    ? "completed"
    : completedSprintDays > 0 ? "in_progress" : "pending";
  const before = await Sprint.findOneAndUpdate(
    { _id: sprintId },
    { $set: { completion_percent: sprintPercent, status: sprintStatus } },
  ).select("status");
  if (sprintStatus === "completed" && before?.status !== "completed") {
    // the next sprint's quiz and flashcards, generated with what this one taught
    const next = await nextSprintId(sprintId);
    if (next) ensureStudyMaterialInBackground(next);
  }

  const [plan, sprints] = await Promise.all([
    Plan.findById(planId).select("total_days"),
    Sprint.find({ plan_id: planId }).select("_id").lean(),
  ]);
  const sprintIds = sprints.map((item) => item._id);
  const totalDays = plan?.total_days ?? 0;
  const completedDays = await SprintDay.countDocuments({ sprint_id: { $in: sprintIds }, status: "completed" });
  const planPercent = totalDays ? Math.min(100, Math.round((completedDays / totalDays) * 100)) : 0;
  const planStatus: PlanStatus = totalDays > 0 && completedDays >= totalDays
    ? "completed"
    : completedDays > 0 ? "in_progress" : "pending";
  await Plan.updateOne(
    { _id: planId },
    { $set: { sprints: sprintIds, completion_percent: planPercent, status: planStatus } },
  );

  const completedSprints = await Sprint.countDocuments({ plan_id: planId, status: "completed" });
  const totalSprints = sprints.length;

  const progressDoc = await PlanProgress.findOne({ plan_id: planId });
  if (progressDoc) {
    if (completedSprints >= 1) await awardTrophy(progressDoc._id as Types.ObjectId, "first_sprint");
    if (completedSprints >= 2) await awardTrophy(progressDoc._id as Types.ObjectId, "second_sprint");
    if (completedSprints >= 3) await awardTrophy(progressDoc._id as Types.ObjectId, "third_sprint");
    if (completedSprints >= 4) await awardTrophy(progressDoc._id as Types.ObjectId, "fourth_sprint");
    if (totalSprints > 0 && completedSprints >= Math.ceil(totalSprints / 2)) {
      await awardTrophy(progressDoc._id as Types.ObjectId, "half_sprints");
    }
    if (planStatus === "completed") {
      await awardTrophy(progressDoc._id as Types.ObjectId, "plan_complete");
    }
  }

  return {
    sprintStatus,
    planStatus,
    sprintPercent,
    planPercent,
    completedSprints,
    totalSprints,
  };
}

export interface StreakSummary {
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
}

export function utcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function calculateStreakSummary(
  completionDates: string[],
  asOfDate: string = utcDateKey(),
): StreakSummary {
  const dates = [...new Set(completionDates)].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  if (!dates.length) {
    return { current_streak: 0, longest_streak: 0, last_completed_date: null };
  }

  let longest = 1;
  let run = 1;
  for (let index = 1; index < dates.length; index += 1) {
    const difference = (Date.parse(`${dates[index]}T00:00:00Z`) - Date.parse(`${dates[index - 1]}T00:00:00Z`)) / MS_PER_DAY;
    run = difference === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  let current = 1;
  for (let index = dates.length - 1; index > 0; index -= 1) {
    const difference = (Date.parse(`${dates[index]}T00:00:00Z`) - Date.parse(`${dates[index - 1]}T00:00:00Z`)) / MS_PER_DAY;
    if (difference !== 1) break;
    current += 1;
  }

  const daysSinceLastCompletion =
    (Date.parse(`${asOfDate}T00:00:00Z`) - Date.parse(`${dates.at(-1)}T00:00:00Z`)) / MS_PER_DAY;
  if (daysSinceLastCompletion > 1) current = 0;

  return {
    current_streak: current,
    longest_streak: longest,
    last_completed_date: dates.at(-1) ?? null,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function claimDayCompletion(
  userId: Types.ObjectId,
  planId: Types.ObjectId,
  sprintDayId: Types.ObjectId,
  completedDate: string = utcDateKey(),
): Promise<{ progress: IPlanProgress; newlyAwarded: boolean }> {
  let progress: IPlanProgress | null = null;
  let newlyAwarded = true;

  try {
    progress = await PlanProgress.findOneAndUpdate(
      {
        user_id: userId,
        plan_id: planId,
        completed_day_ids: { $ne: sprintDayId },
      },
      {
        $addToSet: {
          completed_day_ids: sprintDayId,
          completed_day_dates: completedDate,
        },
        $inc: { xp_points: 20, completed_day_count: 1 },
      },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    newlyAwarded = false;
    progress = await PlanProgress.findOne({ user_id: userId, plan_id: planId });
  }

  if (!progress) {
    progress = await PlanProgress.findOne({ user_id: userId, plan_id: planId });
  }
  if (!progress) throw new Error("Could not load plan progress after recording completion.");
  let currentProgress: IPlanProgress = progress;

  const streak = calculateStreakSummary(currentProgress.completed_day_dates, completedDate);
  await PlanProgress.updateOne(
    { _id: currentProgress._id },
    {
      $set: {
        streak_count: streak.current_streak,
        longest_streak: Math.max(currentProgress.longest_streak, streak.longest_streak),
        last_completed_date: streak.last_completed_date,
      },
    },
  );

  // Each group of seven distinct completed SprintDays earns one 100 XP bonus.
  const weeklyTarget = Math.floor(currentProgress.completed_day_count / 7);
  while (currentProgress.weekly_bonus_count < weeklyTarget) {
    const currentBonusCount = currentProgress.weekly_bonus_count;
    const bonusProgress: IPlanProgress | null = await PlanProgress.findOneAndUpdate(
      { _id: currentProgress._id, weekly_bonus_count: currentBonusCount },
      { $inc: { weekly_bonus_count: 1, xp_points: 100 } },
      { returnDocument: "after", runValidators: true },
    );
    if (bonusProgress) {
      currentProgress = bonusProgress;
    } else {
      const latest: IPlanProgress | null = await PlanProgress.findById(currentProgress._id);
      if (!latest) throw new Error("Plan progress disappeared while applying a weekly bonus.");
      currentProgress = latest;
    }
  }

  const refreshed: IPlanProgress | null = await PlanProgress.findById(currentProgress._id);
  if (refreshed) currentProgress = refreshed;
  return { progress: currentProgress, newlyAwarded };
}

export async function awardTrophy(
  progressId: Types.ObjectId,
  key: string,
): Promise<void> {
  await PlanProgress.updateOne(
    { _id: progressId, "trophies.key": { $ne: key } },
    { $push: { trophies: { key, awarded_at: new Date() } } },
  );
}

export async function claimAssessmentCompletion(
  userId: Types.ObjectId,
  planId: Types.ObjectId,
  completedDate: string = utcDateKey(),
): Promise<IPlanProgress | null> {
  const progress = await PlanProgress.findOneAndUpdate(
    { user_id: userId, plan_id: planId },
    {
      $addToSet: { completed_day_dates: completedDate },
      $inc: { xp_points: 30 },
    },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
  if (progress) {
    const streak = calculateStreakSummary(progress.completed_day_dates, completedDate);
    await PlanProgress.updateOne(
      { _id: progress._id },
      {
        $set: {
          streak_count: streak.current_streak,
          longest_streak: Math.max(progress.longest_streak, streak.longest_streak),
          last_completed_date: streak.last_completed_date,
        },
      }
    );
    return await PlanProgress.findById(progress._id);
  }
  return progress;
}
