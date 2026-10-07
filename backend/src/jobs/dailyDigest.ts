import cron from "node-cron";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { runDailyDigestForAllUsers } from "../services/dailyDigest.js";

/**
 * Runs shortly after the top of every hour and sends the morning digest to
 * whichever users are currently at `DAILY_DIGEST_HOUR` in their own
 * timezone (`runDailyDigestForAllUsers` is idempotent, so this is safe to
 * re-tick). Toggle off with ENABLE_DAILY_DIGEST=false.
 */
export function startDailyDigestJob(): void {
  if (!config.ENABLE_DAILY_DIGEST || config.NODE_ENV === "test") return;
  cron.schedule("5 * * * *", () => {
    void runDailyDigestForAllUsers().then(
      ({ sent, checked }) => {
        if (sent > 0) logger.info(`Daily digest: sent ${sent} email(s) (${checked} user(s) at their local digest hour).`);
      },
      (error) => logger.error("Daily digest job failed", { error }),
    );
  });
  logger.info(`Daily digest job scheduled (local hour ${config.DAILY_DIGEST_HOUR}, checked hourly).`);
}
