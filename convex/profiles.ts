import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { lastDayKeys } from "./days";
import { buildChartDays } from "./chartData";

/**
 * The public profile's focus chart: per-day totals plus per-category slices
 * over the last `days` Tehran days, computed from the sessions log — the one
 * source of daily totals, so the day detail always sums to the line.
 * Masking happens server-side: a visitor never receives private category
 * names — they arrive pre-collapsed into a single "private" bucket. The
 * owner gets real names everywhere. Null when no such user.
 */
export const chart = query({
  args: {
    username: v.string(),
    days: v.union(v.literal(7), v.literal(30), v.literal(90)),
  },
  handler: async (ctx, { username, days }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username.toLowerCase()))
      .first();
    if (!user || !user.username) return null;

    const viewerId = await getAuthUserId(ctx);
    const isOwner = viewerId === user._id;

    const dayKeys = lastDayKeys(days, Date.now());
    const firstKey = dayKeys[0];

    const categories = new Map(
      (
        await ctx.db
          .query("categories")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect()
      ).map((c) => [c._id as string, { name: c.name, isPublic: c.isPublic }]),
    );

    // Full scan of the user's completed sessions rather than an endedAt index:
    // pre-migration rows may lack endedAt, and volumes are tiny (casual app).
    const completed = await ctx.db
      .query("sessions")
      .withIndex("by_user_status", (q) => q.eq("userId", user._id).eq("status", "completed"))
      .collect();
    const sessions = completed
      .filter((s) => s.kind === "work")
      .map((s) => ({
        categoryId: s.categoryId as string | undefined,
        endMs: s.endedAt ?? s.startedAt + s.durationMs,
        durationMs: s.durationMs,
      }))
      // Cheap pre-filter; buildChartDays drops strays precisely by day key.
      .filter((s) => s.endMs >= Date.parse(firstKey) - 86_400_000);

    return {
      username: user.username,
      isOwner,
      days: buildChartDays({ dayKeys, sessions, categories, isOwner }),
    };
  },
});

/** The signed-in user's username, for linking to their own profile. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    return user?.username ?? null;
  },
});
