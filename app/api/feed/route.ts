import { NextResponse } from "next/server";

// The feed combines live presence from BOTH deployments:
//  - tacit-clam-994: the production site, where most users time their sessions
//  - dazzling-ocelot-629: this site's own deployment, where visitors who time
//    from here write their presence (since NEXT_PUBLIC_CONVEX_URL points here)
// Merging both means a user timing from either site shows up in the feed.
const SOURCES = [
  "https://tacit-clam-994.convex.cloud",
  "https://dazzling-ocelot-629.convex.cloud",
];

type FeedEntry = {
  id: string;
  username: string;
  kind: string;
  label: string | null;
  startedAt: number;
  durationMs: number;
};

export async function GET() {
  try {
    const results = await Promise.all(
      SOURCES.map(async (src) => {
        try {
          const res = await fetch(`${src}/api/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: "sessions:activeFeed", args: {} }),
            cache: "no-store",
          });
          const json = (await res.json()) as {
            status: string;
            value?: FeedEntry[];
          };
          if (json.status !== "success") return [] as FeedEntry[];
          return json.value ?? [];
        } catch {
          return [] as FeedEntry[];
        }
      }),
    );

    // Merge and de-dupe by username (keep the most recent session per user).
    const byUser = new Map<string, FeedEntry>();
    for (const list of results) {
      for (const e of list) {
        const existing = byUser.get(e.username);
        if (!existing || e.startedAt > existing.startedAt) {
          byUser.set(e.username, e);
        }
      }
    }
    return NextResponse.json([...byUser.values()]);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
