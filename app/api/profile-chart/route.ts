import { NextResponse } from "next/server";

// Proxy profiles.chart from BOTH deployments and merge the focus history:
//  - tacit-clam-994: the production site, where most users time their sessions
//  - dazzling-ocelot-629: this site's own deployment, where visitors who time
//    from here write their sessions (since NEXT_PUBLIC_CONVEX_URL points here)
// Merging both means a profile shows the user's full history regardless of
// which site they timed from.
const SOURCES = [
  "https://tacit-clam-994.convex.cloud",
  "https://dazzling-ocelot-629.convex.cloud",
];

type ChartDay = {
  dayKey: string;
  totalMs?: number;
  slices?: { name?: string; bucket?: string; ms?: number }[];
};

type ChartPayload = {
  username: string;
  isOwner: boolean;
  days: ChartDay[];
} | null;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const days = searchParams.get("days") ?? "90";
  if (!username) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  try {
    const results = await Promise.all(
      SOURCES.map(async (src) => {
        try {
          const res = await fetch(`${src}/api/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path: "profiles:chart",
              args: { username, days: Number(days) },
            }),
            cache: "no-store",
          });
          const json = (await res.json()) as {
            status: string;
            value?: ChartPayload;
          };
          if (json.status !== "success") return null;
          return json.value ?? null;
        } catch {
          return null;
        }
      }),
    );

    // Merge: start from whichever has data; if both, combine day-by-day.
    const [a, b] = results;
    if (!a && !b) return NextResponse.json(null, { status: 200 });

    const primary = a ?? b!;
    if (!a || !b) {
      return NextResponse.json(primary);
    }

    // Both have data — merge per dayKey so days from either site add up.
    const byDay = new Map<string, ChartDay>();
    for (const src of [a, b]) {
      for (const d of src.days) {
        const existing = byDay.get(d.dayKey);
        if (!existing) {
          byDay.set(d.dayKey, { ...d });
        } else {
          existing.totalMs = (existing.totalMs ?? 0) + (d.totalMs ?? 0);
          // Merge slices by label.
          const sliceMap = new Map<string, { name?: string; bucket?: string; ms?: number }>();
          for (const s of [...(existing.slices ?? []), ...(d.slices ?? [])]) {
            const key = s.name ?? s.bucket ?? "private";
            const prev = sliceMap.get(key) ?? { name: s.name, bucket: s.bucket, ms: 0 };
            prev.ms = (prev.ms ?? 0) + (s.ms ?? 0);
            sliceMap.set(key, prev);
          }
          existing.slices = [...sliceMap.values()];
        }
      }
    }

    return NextResponse.json({
      username: primary.username,
      isOwner: primary.isOwner,
      days: [...byDay.values()].sort((x, y) => x.dayKey.localeCompare(y.dayKey)),
    });
  } catch {
    return NextResponse.json(null, { status: 200 });
  }
}
