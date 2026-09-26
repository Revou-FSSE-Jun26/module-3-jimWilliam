import type { NextRequest } from "next/server";
import { expiring, TAG } from "@/lib/server/cache-tags";
import { requirePermission } from "@/lib/server/auth";
import { gate, readBody, respond, toId } from "@/lib/server/http";
import { deleteCategory, getCategory, updateCategory } from "@/lib/server/store";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/categories/[id]">) {
  const blocked = await gate();
  if (blocked) return blocked;
  const { id } = await ctx.params;
  return respond(getCategory(toId(id)));
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/categories/[id]">) {
  const blocked = await gate();
  if (blocked) return blocked;
  const denied = requirePermission(req, "categories:write");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = await readBody(req);
  return body instanceof Response ? body : respond(expiring(updateCategory(toId(id), body), TAG.catalog));
}

// 409 { error, id, product_count } while products still belong to it
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/categories/[id]">) {
  const blocked = await gate();
  if (blocked) return blocked;
  const denied = requirePermission(req, "categories:write");
  if (denied) return denied;
  const { id } = await ctx.params;
  return respond(expiring(deleteCategory(toId(id)), TAG.catalog));
}
