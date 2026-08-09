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
 * Tehran (UTC+3:30) day key, e.g. "2026-08-09". Iran abolished DST in 2022.
 */
function tehranDayKey(ts: number): string {
  const d = new Date(ts + 3.5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** Refresh the cached leaderboard by pulling from the source deployment. */
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

    const todayKey = tehranDayKey(Date.now());
    // dayKey strings sort lexicographically, so rolling windows are easy.
    const weekCutoff = tehranDayKey(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthCutoff = tehranDayKey(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let added = 0;

    for (const username of usernames) {
      let totalMs = 0;
      let todayMs = 0;
      let weekMs = 0;
      let monthMs = 0;
      try {
        const chart = (await sourceQuery("profiles:chart", {
          username,
          days: 90,
        })) as { days?: { dayKey: string; totalMs?: number }[] } | null;
        if (chart?.days) {
          for (const d of chart.days) {
            const ms = d.totalMs ?? 0;
            totalMs += ms;
            if (d.dayKey >= monthCutoff) monthMs += ms;
            if (d.dayKey >= weekCutoff) weekMs += ms;
            if (d.dayKey === todayKey) todayMs += ms;
          }
        }
      } catch {
        // Skip users we can't read.
        continue;
      }

      await ctx.runMutation(api.leaderboard_cache.upsertEntry, {
        username,
        totalMs,
        todayMs,
        weekMs,
        monthMs,
      });
      added++;
    }

    return { added };
  },
});

/** Public mutation that writes a single leaderboard_cache row. */
export const upsertEntry = mutation({
  args: {
    username: v.string(),
    totalMs: v.number(),
    todayMs: v.number(),
    weekMs: v.number(),
    monthMs: v.number(),
  },
  handler: async (ctx, { username, totalMs, todayMs, weekMs, monthMs }) => {
    const existing = await ctx.db
      .query("leaderboard_cache")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalMs,
        todayMs,
        weekMs,
        monthMs,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("leaderboard_cache", {
        username,
        totalMs,
        todayMs,
        weekMs,
        monthMs,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Public read of the cached leaderboard, ranked by focus time for the chosen
 * window. Reads from `leaderboard_cache` (populated by `syncFromFeed`), so it
 * works for signed-out visitors and never re-scans the source deployment.
 */
export const cachedRanking = query({
  args: {
    range: v.union(
      v.literal("today"),
      v.literal("week"),
      v.literal("month"),
      v.literal("all"),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { range, limit = 50 }) => {
    const rows = await ctx.db.query("leaderboard_cache").collect();
    const field =
      range === "today"
        ? "todayMs"
        : range === "week"
          ? "weekMs"
          : range === "month"
            ? "monthMs"
            : "totalMs";
    const ranked = rows
      .filter((r) => (r[field] ?? 0) > 0)
      .sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0))
      .slice(0, limit)
      .map((r) => ({ username: r.username, ms: r[field] ?? 0 }));
    return ranked;
  },
});
