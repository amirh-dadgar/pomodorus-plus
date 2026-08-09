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

// Both deployments where users may time their sessions. Leaderboard must
// include users from either.
const SOURCES = [SOURCE, TARGET];

const SEED_USERS = ["yazdanctx", "jinx", "amirhossein", "amirh-dadgar"];

function tehranDayKey(ts: number): string {
  return new Date(ts + 3.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function sourceQuery(
  path: string,
  args: Record<string, unknown>,
  source = SOURCE,
) {
  const res = await fetch(`${source}/api/query`, {
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
    // Gather usernames from the live feed on BOTH deployments, since visitors
    // may time from either site.
    for (const src of SOURCES) {
      try {
        const feed = (await sourceQuery("sessions:activeFeed", {}, src)) as {
          username?: string;
        }[];
        for (const e of feed) if (e.username) usernames.add(e.username);
      } catch {
        // feed unreachable on this source — try the other
      }
    }

    const todayKey = tehranDayKey(Date.now());
    const weekCutoff = tehranDayKey(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthCutoff = tehranDayKey(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let synced = 0;
    for (const username of usernames) {
      try {
        // Read the chart from both deployments and merge per-day, since a user
        // may have timed from either site.
        let totalMs = 0;
        let todayMs = 0;
        let weekMs = 0;
        let monthMs = 0;
        for (const src of SOURCES) {
          try {
            const chart = (await sourceQuery(
              "profiles:chart",
              { username, days: 90 },
              src,
            )) as { days?: { dayKey: string; totalMs?: number }[] } | null;
            if (!chart?.days) continue;
            for (const d of chart.days) {
              const ms = d.totalMs ?? 0;
              totalMs += ms;
              if (d.dayKey >= monthCutoff) monthMs += ms;
              if (d.dayKey >= weekCutoff) weekMs += ms;
              if (d.dayKey === todayKey) todayMs += ms;
            }
          } catch {
            // chart missing on this source — continue
          }
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
