import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { expire, TAG } from "@/lib/server/cache-tags";
import { requirePermission } from "@/lib/server/auth";
import { gate, readBody, respond } from "@/lib/server/http";
import { getContent, updateContent } from "@/lib/server/store";

// Editable site content - not part of the Flask API (see README). key is "home" or "about".
//   GET /api/content/[key] -> 200 content | 404 { error }
//   PUT /api/content/[key] -> 200 { message, content } | 400 { error, details } | 404 { error }

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/content/[key]">) {
  const blocked = await gate();
  if (blocked) return blocked;
  const { key } = await ctx.params;
  return respond(await getContent(key));
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/content/[key]">) {
  const blocked = await gate();
  if (blocked) return blocked;
  const denied = await requirePermission(req, "content:write");
  if (denied) return denied;
  const { key } = await ctx.params;
  const body = await readBody(req);
  if (body instanceof Response) return body;
  const result = await updateContent(key, body);
  if (result.status < 300) {
    expire(TAG.content(key));
    revalidatePath(key === "home" ? "/" : "/about");
  }
  return respond(result);
}
