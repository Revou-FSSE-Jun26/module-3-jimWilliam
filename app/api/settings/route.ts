import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { expire, TAG } from "@/lib/server/cache-tags";
import { requirePermission } from "@/lib/server/auth";
import { gate, readBody, respond } from "@/lib/server/http";
import { getSettings, updateSettings } from "@/lib/server/store";

// Store settings - not part of the Flask API (see README).
//   GET /api/settings -> 200 settings
//   PUT /api/settings -> 200 { message, settings } | 400 { error, details }

export async function GET() {
  const blocked = await gate();
  if (blocked) return blocked;
  return respond(await getSettings());
}

export async function PUT(req: NextRequest) {
  const blocked = await gate();
  if (blocked) return blocked;
  const denied = await requirePermission(req, "settings:write");
  if (denied) return denied;
  const body = await readBody(req);
  if (body instanceof Response) return body;
  const result = await updateSettings(body);
  if (result.status < 300) {
    // the root layout reads the settings, so every page shows the new name / logo / time zone
    expire(TAG.settings);
    revalidatePath("/", "layout");
  }
  return respond(result);
}
