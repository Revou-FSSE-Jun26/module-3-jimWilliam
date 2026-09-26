import type { NextRequest } from "next/server";
import { expire, TAG } from "@/lib/server/cache-tags";
import { gate, readBody, respond } from "@/lib/server/http";
import { createOrder, listOrders } from "@/lib/server/store";

// GET /api/orders?user_id= - the Flask API scopes this by JWT; the mock takes it as a query param
export async function GET(req: NextRequest) {
  const blocked = await gate();
  if (blocked) return blocked;
  return respond(await listOrders({ user_id: req.nextUrl.searchParams.get("user_id") }));
}

// POST /api/orders -> 201 { message, order } | 400 { error, details }
export async function POST(req: NextRequest) {
  const blocked = await gate();
  if (blocked) return blocked;
  const body = await readBody(req);
  if (body instanceof Response) return body;
  const result = await createOrder(body);
  if (result.status < 300) expire(TAG.catalog); // stock went down on the product pages
  return respond(result);
}
