import { NextResponse } from "next/server";

// Proxy the live presence feed from the production deployment
// (tacit-clam-994) so the landing page shows who's currently working there,
// even though this site's functions live on a different deployment.
const SOURCE = "https://tacit-clam-994.convex.cloud";

export async function GET() {
  try {
    const res = await fetch(`${SOURCE}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "sessions:activeFeed", args: {} }),
      // Don't cache — presence is live.
      cache: "no-store",
    });
    const json = (await res.json()) as { status: string; value?: unknown };
    if (json.status !== "success") {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json(json.value ?? []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
