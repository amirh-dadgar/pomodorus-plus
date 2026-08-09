import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Refresh the leaderboard cache from the live presence feed every 5 minutes,
// so anyone who has ever been on the timer stays ranked permanently.
const crons = cronJobs();

crons.cron(
  "Sync leaderboard from feed",
  "*/5 * * * *",
  internal.leaderboard_cache.syncFromFeed,
);

export default crons;
