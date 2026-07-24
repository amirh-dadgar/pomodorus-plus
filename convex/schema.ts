import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // authTables.users plus `username`: the unique, immutable public handle
  // used in profile URLs (/u/[username]).
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    username: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_username", ["username"]),

  categories: defineTable({
    userId: v.id("users"),
    name: v.string(),
    isPublic: v.boolean(),
  }).index("by_user", ["userId"]),

  sessions: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("work"), v.literal("shortBreak"), v.literal("longBreak")),
    categoryId: v.optional(v.id("categories")),
    startedAt: v.number(),
    durationMs: v.number(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("canceled"),
      v.literal("skipped"),
    ),
    // Dev-only fast session: stored/credited at the nominal duration above,
    // but the finalize job fires after seconds instead.
    devFast: v.optional(v.boolean()),
    // Actual completion time. Diverges from startedAt + durationMs for
    // devFast sessions; drives end-of-session notifications.
    endedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"]),

  // Cycle counter for the 4-session pomodoro rhythm.
  userStats: defineTable({
    userId: v.id("users"),
    cycleCount: v.number(),
    // Last time a session/break ended — used for the 1h idle reset.
    lastActivityAt: v.number(),
  }).index("by_user", ["userId"]),

  // Daily aggregates (Tehran-local day), independent of categories so
  // deleting a category never erases history.
  dailyStats: defineTable({
    userId: v.id("users"),
    dayKey: v.string(), // "YYYY-MM-DD" in Asia/Tehran (UTC+3:30)
    totalMs: v.number(),
    sessionCount: v.number(),
  }).index("by_user_day", ["userId", "dayKey"]),
});
