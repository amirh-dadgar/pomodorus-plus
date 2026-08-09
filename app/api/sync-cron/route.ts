import { NextResponse } from "next/server";

// Keeps this deployment's leaderboard_cache in sync with the production
// deployment (tacit-clam-994), which is still where most users time their
// sessions.
//
// Self-schedules every minute via a background fetch (no Vercel Cron needed,
// so it works on the Hobby plan). A Convex action can't reach a different
// deployment (cross-deploy fetches are rejected), but a serverless route can
// — same as curl.

const SOURCE = "https://tacit-clam-994.convex.cloud";
const TARGET = "https://dazzling-ocelot-629.convex.cloud";
const SELF_PING_MS = 60_000; // 1 minute

const SEED_USERS = ["yazdanctx", "jinx", "amirhossein", "amirh-dadgar"];

function tehranDayKey(ts: number): string {
  return new Date(ts + 3.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function sourceQuery(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${SOURCE}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    status: string;
    value?: unknown;
    errorMessage?: string;
  };
  if (json.status !== "success") throw new Error(json.errorMessage ?? json.status);
  return json.value;
}

async function targetMutation(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${TARGET}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
    cache: "no-store",
  });
  const json = (await res.json()) as { status: string; errorMessage?: string };
  if (json.status !== "success") throw new Error(json.errorMessage ?? json.status);
}

export async function GET() {
  try {
    const usernames = new Set<string>(SEED_USERS);
    try {
      const feed = (await sourceQuery("sessions:activeFeed", {})) as {
        username?: string;
      }[];
      for (const e of feed) if (e.username) usernames.add(e.username);
    } catch {
      // feed unreachable — fall back to seeds
    }

    const todayKey = tehranDayKey(Date.now());
    const weekCutoff = tehranDayKey(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthCutoff = tehranDayKey(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let synced = 0;
    for (const username of usernames) {
      try {
        const chart = (await sourceQuery("profiles:chart", {
          username,
          days: 90,
        })) as { days?: { dayKey: string; totalMs?: number }[] } | null;
        if (!chart?.days) continue;
        let totalMs = 0;
        let todayMs = 0;
        let weekMs = 0;
        let monthMs = 0;
        for (const d of chart.days) {
          const ms = d.totalMs ?? 0;
          totalMs += ms;
          if (d.dayKey >= monthCutoff) monthMs += ms;
          if (d.dayKey >= weekCutoff) weekMs += ms;
          if (d.dayKey === todayKey) todayMs += ms;
        }
        await targetMutation("leaderboard_cache:upsertEntry", {
          username,
          totalMs,
          todayMs,
          weekMs,
          monthMs,
        });
        synced++;
      } catch {
        // skip this user
      }
    }

    // Re-arm: ask the runtime to call us again in 1 minute. Fire-and-forget
    // so we don't block the response; the function stays alive just long
    // enough for the fetch to dispatch (Hobby plan keeps it warm briefly).
    if (process.env.VERCEL_URL) {
      const url = `https://${process.env.VERCEL_URL}/api/sync-cron`;
      void fetch(url, { cache: "no-store" }).catch(() => {});
    } else {
      setTimeout(() => {
        fetch(`http://localhost:${process.env.PORT ?? 3000}/api/sync-cron`, {
          cache: "no-store",
        }).catch(() => {});
      }, SELF_PING_MS);
    }

    return NextResponse.json({ ok: true, synced });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
