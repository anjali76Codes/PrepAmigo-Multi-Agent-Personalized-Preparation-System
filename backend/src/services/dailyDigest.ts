import { Types } from "mongoose";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { localDateKey, localHour } from "../utils/timezone.js";
import { User } from "../models/User.js";
import { Plan } from "../models/Plan.js";
import { Sprint } from "../models/Sprint.js";
import { SprintDay, ISprintDay } from "../models/SprintDay.js";
import { sendMail } from "./mailer.js";
import { createNotification, hasDigestSince } from "./notifications.js";

// Digests go out once a day at a fixed local hour, so one sent within this window is today's.
// A window, not local midnight: midnight in the user's zone is DST-dependent and easy to get wrong.
const DIGEST_DEDUP_WINDOW_MS = 20 * 60 * 60 * 1000;

interface DigestUser {
  _id: Types.ObjectId;
  email: string;
  name: string;
  profile?: { timezone?: string; daily_digest_email?: boolean };
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function renderEmail(name: string, tasks: ISprintDay[]): { subject: string; html: string; text: string } {
  const subject = tasks.length === 1 ? "1 task on your prep plan today" : `${tasks.length} tasks on your prep plan today`;
  const rows = tasks
    .sort((a, b) => a.day_number - b.day_number)
    .map((t) => `Day ${t.day_number}: ${t.topic_title}${t.estimated_minutes ? ` (~${t.estimated_minutes} min)` : ""}`);
  const text = `Good morning, ${name}!\n\nHere's what's on today:\n\n${rows.map((r) => `- ${r}`).join("\n")}\n\nKeep the streak going.\n— PrepAmigo`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a;">
      <h2 style="margin-bottom:4px;">Good morning, ${escapeHtml(name)}! ☀️</h2>
      <p style="color:#555;margin-top:0;">Here's what's on today:</p>
      <ul style="padding-left:20px;">
        ${rows.map((r) => `<li style="margin-bottom:6px;">${escapeHtml(r)}</li>`).join("")}
      </ul>
      <p style="color:#555;">Keep the streak going.</p>
      <p style="color:#999;font-size:12px;">— PrepAmigo</p>
    </div>`;
  return { subject, html, text };
}

/** Today's not-yet-completed sprint days, in the user's local calendar day, across their active plans. */
async function todaysTasks(userId: Types.ObjectId, now: Date, timeZone?: string): Promise<ISprintDay[]> {
  const plans = await Plan.find({ user_id: userId, status: { $ne: "completed" } }).select("_id").lean();
  if (plans.length === 0) return [];
  const sprints = await Sprint.find({ plan_id: { $in: plans.map((p) => p._id) } }).select("_id").lean();
  if (sprints.length === 0) return [];
  const days = await SprintDay.find({
    sprint_id: { $in: sprints.map((s) => s._id) },
    status: { $ne: "completed" },
  });
  const todayKey = localDateKey(now, timeZone);
  return days.filter((d) => localDateKey(d.scheduled_date, timeZone) === todayKey);
}

async function sendDigestForUser(user: DigestUser, now: Date): Promise<boolean> {
  const tasks = await todaysTasks(user._id, now, user.profile?.timezone);
  if (tasks.length === 0) return false;
  const { subject, html, text } = renderEmail(user.name, tasks);
  const delivered = await sendMail({ to: user.email, subject, html, text });
  if (!delivered) return false;
  await createNotification(
    user._id,
    "daily-digest",
    subject,
    `We emailed you this morning's ${tasks.length === 1 ? "task" : "tasks"}: ${tasks
      .slice(0, 3)
      .map((t) => t.topic_title)
      .join(", ")}${tasks.length > 3 ? ", …" : ""}.`,
  );
  return true;
}

/**
 * Checks every opted-in user's local clock and sends the morning digest to
 * whoever is currently at `DAILY_DIGEST_HOUR`. Meant to run on an hourly
 * cron (see src/jobs/dailyDigest.ts); idempotent via `hasDigestSince` so a
 * re-run or a slightly-off cron tick never double-sends.
 */
export async function runDailyDigestForAllUsers(now: Date = new Date()): Promise<{ sent: number; checked: number }> {
  const users = await User.find({ "profile.daily_digest_email": { $ne: false } })
    .select("_id email name profile.timezone profile.daily_digest_email")
    .lean<DigestUser[]>();
  let sent = 0;
  let checked = 0;
  for (const user of users) {
    if (!user.email) continue;
    if (localHour(now, user.profile?.timezone) !== config.DAILY_DIGEST_HOUR) continue;
    checked++;
    if (await hasDigestSince(user._id, new Date(now.getTime() - DIGEST_DEDUP_WINDOW_MS))) continue;
    try {
      if (await sendDigestForUser(user, now)) sent++;
    } catch (error) {
      logger.error("Daily digest failed for user", { error, userId: String(user._id) });
    }
  }
  return { sent, checked };
}
