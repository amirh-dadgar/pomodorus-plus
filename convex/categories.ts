import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * The signed-in user's categories. Read-only: every category write goes
 * through sync.push (the same path online and offline), so devices behave
 * identically either way. Clients key categories by clientId, falling back
 * to the Convex _id for rows that predate the local-first move.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .filter((c) => c.deleted !== true)
      .map((c) => ({
        clientId: c.clientId ?? c._id,
        name: c.name,
        isPublic: c.isPublic,
        updatedAt: c.updatedAt ?? c._creationTime,
      }));
  },
});
