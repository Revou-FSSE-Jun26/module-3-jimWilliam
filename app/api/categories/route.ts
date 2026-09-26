import type { NextRequest } from "next/server";
import { expiring, TAG } from "@/lib/server/cache-tags";
import { requirePermission } from "@/lib/server/auth";
import { gate, readBody, respond } from "@/lib/server/http";
import { createCategory, listCategories } from "@/lib/server/store";

export async function GET() {
  const blocked = await gate();
  if (blocked) return blocked;
  return respond(listCategories());
}

export async function POST(req: NextRequest) {
  const blocked = await gate();
  if (blocked) return blocked;
  const denied = requirePermission(req, "categories:write");
  if (denied) return denied;
  const body = await readBody(req);
  return body instanceof Response ? body : respond(expiring(createCategory(body), TAG.catalog));
}
