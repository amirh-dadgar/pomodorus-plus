import { internalAction, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// The deployment that holds the real user data (the production site's
// database). We can't deploy functions there, but its public queries are
// reachable over the Convex REST API, so the leaderboard cache on THIS
// deployment (dazzling-ocelot-629) pulls from it.
const SOURCE_DEPLOYMENT = "https://tacit-clam-994.convex.cloud";

/**
 * Fetch a public query result from the source deployment over the REST API.
 */
async function sourceQuery(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${SOURCE_DEPLOYMENT}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`source query failed: ${res.status} ${text}`);
  const json = JSON.parse(text) as { status: string; value?: unknown };
  if (json.status !== "success") throw new Error(`source query error: ${json.status} ${text}`);
  return json.value;
}

/**
 * Refresh the cached leaderboard by pulling from the source deployment.
 *
 * Two sources are merged:
 *   1. A small seeded list of known usernames from the production deployment
 *      (tacit-clam-994) so the leaderboard is never empty — those accounts
 *      already have focus history there.
 *   2. The live presence feed (if reachable) so anyone who shows up on the
 *      timer going forward is added too.
 *
 * Called by the cron job every 5 minutes. Rows are upserted (never deleted),
 * so anyone who has ever appeared stays ranked permanently.
 */
// Known usernames carried over from the source deployment (tacit-clam-994).
// These already have focus history there; seeding them keeps the leaderboard
// populated from day one instead of waiting for them to reappear in the feed.
const SEED_USERS = ["yazdanctx", "jinx", "amirhossein", "amirh-dadgar"];

export const syncFromFeed = internalAction({
  args: {},
  handler: async (ctx) => {
    const usernames = new Set<string>(SEED_USERS);

    // Try the live feed too (best-effort; it may be unreachable from here).
    try {
      const feed = (await sourceQuery("sessions:activeFeed", {})) as
        | { username?: string }[]
        | null;
      for (const entry of feed ?? []) {
        if (entry.username) usernames.add(entry.username);
      }
    } catch {
      // Feed unreachable — fall back to the seeded list only.
    }

    let added = 0;

    for (const username of usernames) {
      // Get this user's lifetime focus time from the source deployment.
      let totalMs = 0;
      try {
        const chart = (await sourceQuery("profiles:chart", {
          username,
          days: 90,
        })) as { days?: { totalMs?: number }[] } | null;
        if (chart?.days) {
          for (const d of chart.days) totalMs += d.totalMs ?? 0;
        }
      } catch {
        // Skip users we can't read.
        continue;
      }

      await ctx.runMutation(api.leaderboard_cache.upsertEntry, {
        username,
        totalMs,
      });
      added++;
    }

    return { added };
  },
});

/** Public mutation that writes a single leaderboard_cache row. */
export const upsertEntry = mutation({
  args: { username: v.string(), totalMs: v.number() },
  handler: async (ctx, { username, totalMs }) => {
    const existing = await ctx.db
      .query("leaderboard_cache")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { totalMs, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("leaderboard_cache", {
        username,
        totalMs,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Public read of the cached leaderboard, ranked by total focus time.
 * Reads from `leaderboard_cache` (populated by `syncFromFeed`), so it works
 * for signed-out visitors and never re-scans the source deployment.
 */
export const cachedRanking = query({
  args: {
    range: v.optional(
      v.union(v.literal("today"), v.literal("week"), v.literal("all")),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 50 }) => {
    const rows = await ctx.db.query("leaderboard_cache").collect();
    const ranked = rows
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, limit)
      .map((r) => ({ username: r.username, ms: r.totalMs }));
    return ranked;
  },
});
