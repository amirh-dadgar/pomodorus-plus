import { v } from "convex/values";
import { query } from "./_generated/server";
import { tehranDayStart, tehranWeekStart } from "./days";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export type LeaderboardRange = "today" | "week" | "all";

/**
 * Aggregate completed work-focus time per user over a window, ranked highest
 * first. The window is Tehran-local:
 *   - today: since 00:00 Tehran of the current day
 *   - week:  since Saturday 00:00 Tehran of the current week
 *   - all:   every completed work session, ever
 *
 * Masking: only public category totals would ever be named elsewhere; the
 * leaderboard ranks by total focus time and shows the username only, so no
 * private category data leaks. Anonymous/legacy accounts without a username
 * are skipped.
 */
export const ranking = query({
  args: {
    range: v.union(v.literal("today"), v.literal("week"), v.literal("all")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { range, limit = 50 }) => {
    const now = Date.now();
    const since =
      range === "today"
        ? tehranDayStart(now)
        : range === "week"
          ? tehranWeekStart(now)
          : 0;

    // Full scan of completed sessions, then filter client-side. Volumes are
    // tiny (casual app) and there is no endedAt index worth adding for this.
    const completed = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();

    const totals = new Map<string, { userId: string; ms: number }>();
    for (const s of completed) {
      if (s.kind !== "work") continue;
      const endMs = s.endedAt ?? s.startedAt + s.durationMs;
      if (endMs < since) continue;
      const prev = totals.get(s.userId as string);
      if (prev) prev.ms += s.durationMs;
      else totals.set(s.userId as string, { userId: s.userId as string, ms: s.durationMs });
    }

    // Resolve usernames; drop accounts without one.
    const rows = await Promise.all(
      [...totals.values()].map(async (row) => {
        const user = (
          await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("_id"), row.userId))
            .first()
        ) as { username?: string } | null;
        return user?.username ? { username: user.username, ms: row.ms } : null;
      }),
    );

    return rows
      .filter((r): r is { username: string; ms: number } => r !== null)
      .sort((a, b) => b.ms - a.ms)
      .slice(0, limit);
  },
});
