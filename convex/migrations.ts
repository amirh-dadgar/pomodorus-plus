import { internalMutation } from "./_generated/server";

/**
 * One-shot: move password accounts from being keyed by email to being keyed
 * by username, for the switch to username-only login (`convex/auth.ts`).
 *
 * Run it once against each deployment, before anyone tries to sign in with
 * the new form:
 *
 *     npx convex run migrations:usernameLogin
 *
 * Passwords are untouched — only the identifier they are filed under changes,
 * so everyone keeps the password they already have. Idempotent: accounts that
 * are already keyed by username are skipped, so a second run is a no-op.
 */
export const usernameLogin = internalMutation({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("authAccounts").collect();
    let moved = 0;
    let alreadyDone = 0;
    const skipped: string[] = [];

    for (const account of accounts) {
      if (account.provider !== "password") continue;
      const user = await ctx.db.get(account.userId);
      const username = user?.username;
      if (!username) {
        // An account whose user never got a username can't be keyed by one.
        // Left alone rather than deleted: that is data loss, and this is a
        // migration, not a cleanup.
        skipped.push(`${account._id} (user has no username)`);
        continue;
      }
      if (account.providerAccountId === username) {
        alreadyDone++;
        continue;
      }
      // Two accounts can't share an identifier — the sign-in lookup is a
      // `.unique()` and would start throwing for both of them.
      const clash = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", username),
        )
        .first();
      if (clash !== null) {
        skipped.push(`${account._id} (${username} already taken by ${clash._id})`);
        continue;
      }
      await ctx.db.patch(account._id, { providerAccountId: username });
      // The address is no longer a credential and is shown nowhere, so it is
      // not kept. `undefined` removes the field.
      if (user.email !== undefined) {
        await ctx.db.patch(user._id, { email: undefined });
      }
      moved++;
    }

    return { moved, alreadyDone, skipped };
  },
});
