import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { expire, TAG } from "@/lib/server/cache-tags";
import { requirePermission } from "@/lib/server/auth";
import { gate } from "@/lib/server/http";
import { LogoError, logoSvg, vectorizeLogo } from "@/lib/server/logo";
import { getLogo, getSettings, setLogo } from "@/lib/server/store";
import { MAX_UPLOAD_BYTES } from "@/lib/server/uploads";

// The store logo, always served as SVG we generated ourselves (see lib/server/logo.ts).
//   GET    /api/settings/logo[?variant=icon][&v=<logo_version>]   the logo (icon = square, for the favicon)
//   POST   /api/settings/logo   multipart "file" [+ "apply"="1"]   convert an image -> 200 { svg, colours, paths[, settings] }
//   DELETE /api/settings/logo                                     back to the default logo -> 200 { settings }

export async function GET(req: NextRequest) {
  const blocked = await gate();
  if (blocked) return blocked;
  const variant = req.nextUrl.searchParams.get("variant") === "icon" ? "icon" : "full";
  const settings = (await getSettings()).body as { logo_glow: boolean; logo_version: number };
  const svg = logoSvg(await getLogo(), { glow: settings.logo_glow, variant });
  // a URL with the current version can be cached for good; anything else is revalidated
  const versioned = req.nextUrl.searchParams.get("v") === String(settings.logo_version);
  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": versioned ? "public, max-age=31536000, immutable" : "no-cache",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function POST(req: NextRequest) {
  const blocked = await gate();
  if (blocked) return blocked;
  const denied = await requirePermission(req, "settings:write");
  if (denied) return denied;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "validation failed", details: ["send the logo as multipart/form-data"] }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "validation failed", details: ["file is required"] }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "validation failed", details: [`logos must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller`] }, { status: 400 });
  }
  try {
    const vector = await vectorizeLogo(Buffer.from(await file.arrayBuffer()));
    const preview = { svg: logoSvg(vector, { glow: true }), colours: vector.colours, paths: vector.paths.length };
    if (form.get("apply") !== "1") return NextResponse.json(preview);
    const settings = await setLogo(vector);
    expire(TAG.settings);
    revalidatePath("/", "layout");
    return NextResponse.json({ ...preview, message: "logo updated", settings });
  } catch (e) {
    const message = e instanceof LogoError ? e.message : "The logo could not be converted. Try a PNG with a plain or transparent background.";
    return NextResponse.json({ error: "validation failed", details: [message] }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const blocked = await gate();
  if (blocked) return blocked;
  const denied = await requirePermission(req, "settings:write");
  if (denied) return denied;
  const settings = await setLogo(null);
  expire(TAG.settings);
  revalidatePath("/", "layout");
  return NextResponse.json({ message: "logo reset", settings });
}
