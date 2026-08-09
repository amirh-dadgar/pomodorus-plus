import { NextResponse } from "next/server";

// Proxy profiles.chart from the production deployment (tacit-clam-994) so user
// profile pages show real focus history even though this site's functions live
// on a different deployment.
const SOURCE = "https://tacit-clam-994.convex.cloud";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const days = searchParams.get("days") ?? "90";
  if (!username) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }
  try {
    const res = await fetch(`${SOURCE}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "profiles:chart",
        args: { username, days: Number(days) },
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as { status: string; value?: unknown };
    if (json.status !== "success") {
      return NextResponse.json(null, { status: 200 });
    }
    return NextResponse.json(json.value ?? null);
  } catch {
    return NextResponse.json(null, { status: 200 });
  }
}
