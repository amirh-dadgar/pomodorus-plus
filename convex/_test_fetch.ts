import { action } from "./_generated/server";

export const testFetch = action({
  args: {},
  handler: async () => {
    const url = "https://tacit-clam-994.convex.cloud/api/query";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "profiles:chart", args: { username: "yazdanctx", days: 365 } }),
    });
    const text = await res.text();
    return { status: res.status, text: text.slice(0, 300) };
  },
});
