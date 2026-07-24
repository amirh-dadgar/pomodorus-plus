import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

const MINUTE_MS = 60_000;
export const WORK_MINUTES = [25, 55] as const;
const SHORT_BREAK_MS = 5 * MINUTE_MS;
const LONG_BREAK_MS = 20 * MINUTE_MS;
const SESSIONS_PER_CYCLE = 4;
const IDLE_RESET_MS = 60 * MINUTE_MS;

// Day bucket in Asia/Tehran (fixed UTC+3:30, Iran abolished DST in 2022).
const TEHRAN_OFFSET_MS = 3.5 * 60 * MINUTE_MS;
function tehranDayKey(ts: number): string {
  return new Date(ts + TEHRAN_OFFSET_MS).toISOString().slice(0, 10);
}

async function requireUserId(ctx: { auth: MutationCtx["auth"] }) {
  const userId = await getAuthUserId(ctx as MutationCtx);
  if (userId === null) throw new ConvexError("ابتدا وارد شوید");
  return userId;
}

async function getRunning(ctx: MutationCtx, userId: Id<"users">) {
  return await ctx.db
    .query("sessions")
    .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "running"))
    .unique();
}

async function getStats(ctx: MutationCtx, userId: Id<"users">) {
  const stats = await ctx.db
    .query("userStats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (stats) return stats;
  const id = await ctx.db.insert("userStats", {
    userId,
    cycleCount: 0,
    lastActivityAt: 0,
  });
  return (await ctx.db.get(id))!;
}

/** Start a work session on a category (25 or 55 minutes). */
export const startWork = mutation({
  args: { categoryId: v.id("categories"), minutes: v.number() },
  handler: async (ctx, { categoryId, minutes }) => {
    const userId = await requireUserId(ctx);
    if (!WORK_MINUTES.includes(minutes as (typeof WORK_MINUTES)[number])) {
      throw new ConvexError("مدت جلسه باید ۲۵ یا ۵۵ دقیقه باشد");
    }
    const category = await ctx.db.get(categoryId);
    if (!category || category.userId !== userId) {
      throw new ConvexError("دسته‌بندی پیدا نشد");
    }
    if (await getRunning(ctx, userId)) {
      throw new ConvexError("یک جلسه در حال اجراست");
    }

    const now = Date.now();
    const stats = await getStats(ctx, userId);
    if (stats.cycleCount > 0 && now - stats.lastActivityAt > IDLE_RESET_MS) {
      await ctx.db.patch(stats._id, { cycleCount: 0 });
    }

    const durationMs = minutes * MINUTE_MS;
    const sessionId = await ctx.db.insert("sessions", {
      userId,
      kind: "work",
      categoryId,
      startedAt: now,
      durationMs,
      status: "running",
    });
    await ctx.scheduler.runAfter(durationMs, internal.sessions.finalize, { sessionId });
  },
});

/** Cancel the running work session. It counts for nothing. */
export const cancelWork = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const running = await getRunning(ctx, userId);
    if (!running || running.kind !== "work") {
      throw new ConvexError("جلسه‌ای در حال اجرا نیست");
    }
    await ctx.db.patch(running._id, { status: "canceled" });
  },
});

/** Skip the running break and become idle immediately. */
export const skipBreak = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const running = await getRunning(ctx, userId);
    if (!running || running.kind === "work") {
      throw new ConvexError("استراحتی در حال اجرا نیست");
    }
    await ctx.db.patch(running._id, { status: "skipped" });
    const stats = await getStats(ctx, userId);
    await ctx.db.patch(stats._id, {
      cycleCount: running.kind === "longBreak" ? 0 : stats.cycleCount,
      lastActivityAt: Date.now(),
    });
  },
});

/**
 * Scheduled at session start for exactly its end time; the timer is fully
 * server-side so sessions complete even with no tab open. No-ops if the
 * session was canceled/skipped meanwhile.
 */
export const finalize = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.status !== "running") return;
    await ctx.db.patch(sessionId, { status: "completed" });
    const now = Date.now();
    const stats = await getStats(ctx, session.userId);

    if (session.kind === "work") {
      const dayKey = tehranDayKey(session.startedAt + session.durationMs);
      const day = await ctx.db
        .query("dailyStats")
        .withIndex("by_user_day", (q) => q.eq("userId", session.userId).eq("dayKey", dayKey))
        .unique();
      if (day) {
        await ctx.db.patch(day._id, {
          totalMs: day.totalMs + session.durationMs,
          sessionCount: day.sessionCount + 1,
        });
      } else {
        await ctx.db.insert("dailyStats", {
          userId: session.userId,
          dayKey,
          totalMs: session.durationMs,
          sessionCount: 1,
        });
      }

      const cycleCount = stats.cycleCount + 1;
      await ctx.db.patch(stats._id, { cycleCount, lastActivityAt: now });

      // Auto-start the break (skippable from the UI).
      const isLong = cycleCount >= SESSIONS_PER_CYCLE;
      const durationMs = isLong ? LONG_BREAK_MS : SHORT_BREAK_MS;
      const breakId = await ctx.db.insert("sessions", {
        userId: session.userId,
        kind: isLong ? "longBreak" : "shortBreak",
        startedAt: now,
        durationMs,
        status: "running",
      });
      await ctx.scheduler.runAfter(durationMs, internal.sessions.finalize, {
        sessionId: breakId,
      });
    } else {
      await ctx.db.patch(stats._id, {
        cycleCount: session.kind === "longBreak" ? 0 : stats.cycleCount,
        lastActivityAt: now,
      });
    }
  },
});

/** The signed-in user's live state: running session, cycle count, today's totals. */
export const myState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const running = await ctx.db
      .query("sessions")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "running"))
      .unique();
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const today = await ctx.db
      .query("dailyStats")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("dayKey", tehranDayKey(Date.now())))
      .unique();
    const user = await ctx.db.get(userId);
    let category: Doc<"categories"> | null = null;
    if (running?.categoryId) category = await ctx.db.get(running.categoryId);
    return {
      name: user?.name ?? "",
      running: running
        ? {
            id: running._id,
            kind: running.kind,
            startedAt: running.startedAt,
            durationMs: running.durationMs,
            categoryName: category?.name ?? null,
          }
        : null,
      cycleCount: stats?.cycleCount ?? 0,
      todayMs: today?.totalMs ?? 0,
      todayCount: today?.sessionCount ?? 0,
    };
  },
});

/** Global live feed: everyone working or on break right now. */
export const activeFeed = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const running = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(200);
    const feed = [];
    for (const session of running) {
      const user = await ctx.db.get(session.userId);
      if (!user) continue;
      let label: string | null = null;
      if (session.kind === "work") {
        const category = session.categoryId ? await ctx.db.get(session.categoryId) : null;
        label = category?.isPublic ? category.name : null;
      }
      feed.push({
        id: session._id,
        name: user.name ?? "",
        isMe: session.userId === userId,
        kind: session.kind,
        label, // null on work = private task
        startedAt: session.startedAt,
        durationMs: session.durationMs,
      });
    }
    feed.sort((a, b) => a.startedAt - b.startedAt);
    return feed;
  },
});

/** Daily focus history for the signed-in user, newest first. */
export const history = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const days = await ctx.db
      .query("dailyStats")
      .withIndex("by_user_day", (q) => q.eq("userId", userId))
      .order("desc")
      .take(365);
    return days.map((d) => ({
      dayKey: d.dayKey,
      totalMs: d.totalMs,
      sessionCount: d.sessionCount,
    }));
  },
});
