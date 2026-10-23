import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/server/auth";
import { releaseUploads } from "@/lib/server/upload-cleanup";

// POST /api/uploads/release  { urls: string[] }
// A product was just saved without these images, or deleted (the browser reports it after the
// API confirmed the write - lib/api.client.ts). Uploads among them that no product uses any more
// are deleted straight away; seeded photos and images still in use are left alone.
//   -> 200 { removed, bytes } | 400 | 401 | 403

export async function POST(req: NextRequest) {
  const denied = await requirePermission(req, "products:write");
  if (denied) return denied;

  let urls: unknown;
  try {
    ({ urls } = await req.json());
  } catch {
    return NextResponse.json({ error: "request body must be a JSON object" }, { status: 400 });
  }
  if (!Array.isArray(urls) || urls.length > 50 || urls.some((u) => typeof u !== "string")) {
    return NextResponse.json({ error: "validation failed", details: ["urls must be a list of at most 50 image URLs"] }, { status: 400 });
  }
  return NextResponse.json(await releaseUploads(urls as string[]));
}
