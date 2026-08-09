/**
 * One-shot sync script: pulls focus totals from the source deployment
 * (tacit-clam-994) and pushes them into THIS deployment's leaderboard_cache
 * (dazzling-ocelot-629) via the public REST API.
 *
 * Run locally (where outbound fetch to tacit-clam-994 works):
 *   npx tsx scripts/sync-leaderboard.ts
 *
 * Why not a Convex action? The source deployment rejects cross-deployment
 * fetches (returns status:error), but a plain Node script from your machine
 * reaches it fine — same as curl.
 */
const SOURCE = "https://tacit-clam-994.convex.cloud";
const TARGET = "https://dazzling-ocelot-629.convex.cloud";

// Known usernames to seed (extend as you discover more).
const SEED_USERS = ["yazdanctx", "jinx", "amirhossein", "amirh-dadgar"];

async function sourceQuery(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${SOURCE}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const json = (await res.json()) as { status: string; value?: unknown; errorMessage?: string };
  if (json.status !== "success") throw new Error(json.errorMessage ?? json.status);
  return json.value;
}

async function targetMutation(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${TARGET}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const json = (await res.json()) as { status: string; errorMessage?: string };
  if (json.status !== "success") throw new Error(json.errorMessage ?? json.status);
}

async function main() {
  const usernames = new Set<string>(SEED_USERS);

  // Try the live feed for any extra usernames.
  try {
    const feed = (await sourceQuery("sessions:activeFeed", {})) as { username?: string }[];
    for (const e of feed) if (e.username) usernames.add(e.username);
  } catch (err) {
    console.warn("feed fetch failed, using seed list only:", err);
  }

  let synced = 0;
  for (const username of usernames) {
    try {
      const chart = (await sourceQuery("profiles:chart", { username, days: 90 })) as {
        days?: { totalMs?: number }[];
      } | null;
      if (!chart?.days) continue;
      let totalMs = 0;
      for (const d of chart.days) totalMs += d.totalMs ?? 0;
      await targetMutation("leaderboard_cache:upsertEntry", { username, totalMs });
      synced++;
      console.log(`✓ ${username}: ${(totalMs / 3_600_000).toFixed(1)}h`);
    } catch (err) {
      console.warn(`✗ ${username}:`, err);
    }
  }
  console.log(`\nDone. Synced ${synced} users to leaderboard_cache.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
