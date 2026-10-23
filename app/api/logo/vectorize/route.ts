import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/server/auth";
import { LogoError, logoSvg, vectorizeLogo } from "@/lib/server/logo";
import { MAX_UPLOAD_BYTES } from "@/lib/server/uploads";

// POST /api/logo/vectorize  (multipart/form-data, field "file")
// Traces an image into SVG paths in its real colours. Nothing is stored: the browser previews the
// result, and to apply it sends `vector` to the API's PUT /settings/logo, which stores it.
//   -> 200 { svg, colours, paths, vector } | 400 { error, details } | 401 | 403

export async function POST(req: NextRequest) {
  const denied = await requirePermission(req, "settings:write");
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "validation failed", details: ["send the logo as multipart/form-data"] }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation failed", details: ["file is required"] }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "validation failed", details: [`logos must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller`] }, { status: 400 });
  }

  try {
    const vector = await vectorizeLogo(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ svg: logoSvg(vector, { glow: true }), colours: vector.colours, paths: vector.paths.length, vector });
  } catch (e) {
    const message = e instanceof LogoError ? e.message : "The logo could not be converted. Try a PNG with a plain or transparent background.";
    return NextResponse.json({ error: "validation failed", details: [message] }, { status: 400 });
  }
}
