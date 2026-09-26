import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/server/auth";
import { gate } from "@/lib/server/http";
import { SummaryError } from "@/lib/server/page-summary";
import { extractSpecs, fetchSpecs } from "@/lib/server/page-specs";

// Used by the admin form's specifications editor. Both answer 200 { url, specs: SpecRow[] } | 400 { error }.
//   GET  /api/official-specs?url=https://...&name=<product name>   fetch a public spec page
//   POST /api/official-specs  { html, name }                          extract from HTML pasted from a browser

const MAX_PASTE = 2_000_000;

export async function GET(req: NextRequest) {
  const blocked = await gate();
  if (blocked) return blocked;
  const denied = await requirePermission(req, "products:write");
  if (denied) return denied;
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });
  try {
    return NextResponse.json(await fetchSpecs(url, req.nextUrl.searchParams.get("name") ?? ""));
  } catch (e) {
    return NextResponse.json({ error: e instanceof SummaryError ? e.message : "The page could not be read." }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const blocked = await gate();
  if (blocked) return blocked;
  const denied = await requirePermission(req, "products:write");
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { html?: unknown; name?: unknown } | null;
  if (!body || typeof body.html !== "string" || !body.html.trim()) {
    return NextResponse.json({ error: "html is required" }, { status: 400 });
  }
  if (body.html.length > MAX_PASTE) return NextResponse.json({ error: "That paste is too large - copy just the spec table." }, { status: 400 });
  const specs = extractSpecs(body.html, typeof body.name === "string" ? body.name : "", { fragment: true });
  return NextResponse.json({ url: null, specs });
}
