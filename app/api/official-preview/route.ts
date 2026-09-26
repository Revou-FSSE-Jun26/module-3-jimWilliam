import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/server/auth";
import { gate } from "@/lib/server/http";
import { fetchSummary, SummaryError } from "@/lib/server/page-summary";

// GET /api/official-preview?url=https://... -> 200 { url, title, description, siteName } | 400 { error }
// Used by the admin form's "Fetch summary" button. Only public http(s) pages are fetched.
export async function GET(req: NextRequest) {
  const blocked = await gate();
  if (blocked) return blocked;
  const denied = await requirePermission(req, "products:write");
  if (denied) return denied;
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });
  try {
    return NextResponse.json(await fetchSummary(url));
  } catch (e) {
    return NextResponse.json({ error: e instanceof SummaryError ? e.message : "The page could not be read." }, { status: 400 });
  }
}
