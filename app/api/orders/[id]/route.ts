import type { NextRequest } from "next/server";
import { expire, TAG } from "@/lib/server/cache-tags";
import { requirePermission } from "@/lib/server/auth";
import { gate, readBody, respond, toId } from "@/lib/server/http";
import { getOrder, updateOrder } from "@/lib/server/store";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/orders/[id]">) {
  const blocked = await gate();
  if (blocked) return blocked;
  const { id } = await ctx.params;
  return respond(getOrder(toId(id)));
}

// PUT /api/orders/[id] { order_status?, shipping_address? } - the Flask contract:
// 200 { message, order } | 400 { error: "no fields to update" } | 400 { error, details } | 404 { error, id }
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/orders/[id]">) {
  const blocked = await gate();
  if (blocked) return blocked;
  const denied = requirePermission(req, "orders:manage");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = await readBody(req);
  if (body instanceof Response) return body;
  const result = updateOrder(toId(id), body);
  // cancelling or reopening moves stock, which the product pages show
  if ((result.body as { stock_changed?: boolean }).stock_changed) expire(TAG.catalog);
  return respond(result);
}
