import { v, ConvexError } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

function validateName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 40) {
    throw new ConvexError("نام دسته‌بندی باید بین ۱ تا ۴۰ حرف باشد");
  }
  return trimmed;
}

async function requireOwnCategory(ctx: MutationCtx, id: Id<"categories">) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("ابتدا وارد شوید");
  const category = await ctx.db.get(id);
  if (!category || category.userId !== userId) {
    throw new ConvexError("دسته‌بندی پیدا نشد");
  }
  const running = await ctx.db
    .query("sessions")
    .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "running"))
    .unique();
  if (running?.categoryId === id) {
    throw new ConvexError("در حین جلسه نمی‌توان این دسته‌بندی را تغییر داد");
  }
  return category;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const create = mutation({
  args: { name: v.string(), isPublic: v.boolean() },
  handler: async (ctx, { name, isPublic }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("ابتدا وارد شوید");
    return await ctx.db.insert("categories", {
      userId,
      name: validateName(name),
      isPublic,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, name, isPublic }) => {
    await requireOwnCategory(ctx, id);
    await ctx.db.patch(id, {
      ...(name !== undefined ? { name: validateName(name) } : {}),
      ...(isPublic !== undefined ? { isPublic } : {}),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, { id }) => {
    await requireOwnCategory(ctx, id);
    // Past focus time lives in dailyStats, so history survives deletion.
    await ctx.db.delete(id);
  },
});
