import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { modifyAccountCredentials } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";

/**
 * Operator-run password reset. The app deliberately has no reset flow of its
 * own (`convex/auth.ts`) — no email means no way to prove a password request
 * came from the account's owner — so someone who forgets theirs can only be
 * helped from the outside:
 *
 *     npx convex run admin:setPassword '{"username":"annie","password":"..."}' --prod
 *
 * `internalAction`, so it is not part of the public API surface and no client
 * can call it; reaching it needs CLI or dashboard access to the deployment.
 * An action rather than a mutation because `modifyAccountCredentials` runs the
 * auth component's own `store` mutation.
 *
 * Hashing is not done here: the helper looks up the `"password"` provider and
 * reuses its `crypto.hashSecret`, so the stored secret matches what sign-in
 * verifies against. Throws if no account is filed under the username, rather
 * than silently creating one. Existing sessions are left alone — this is for
 * an account that cannot get in at all, not a suspected compromise.
 */
export const setPassword = internalAction({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { username, password }) => {
    const id = username.trim().toLowerCase();
    if (password.length === 0) {
      throw new Error("password must not be empty");
    }
    await modifyAccountCredentials<DataModel>(ctx, {
      provider: "password",
      account: { id, secret: password },
    });
    return `password replaced for ${id}`;
  },
});
