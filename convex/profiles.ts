import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Public profile: display name + daily focus totals. Null when no such user. */
export const byUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username.toLowerCase()))
      .first();
    if (!user || !user.username) return null;
    const days = await ctx.db
      .query("dailyStats")
      .withIndex("by_user_day", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(365);
    return {
      name: user.name ?? "",
      username: user.username,
      days: days.map((d) => ({ dayKey: d.dayKey, totalMs: d.totalMs })),
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
