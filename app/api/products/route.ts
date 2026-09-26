import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { expire, TAG } from "@/lib/server/cache-tags";
import { requirePermission } from "@/lib/server/auth";
import { gate, readBody, respond } from "@/lib/server/http";
import { createProduct, listProducts } from "@/lib/server/store";

// GET /api/products?search=&category_id=
export async function GET(req: NextRequest) {
  const blocked = await gate();
  if (blocked) return blocked;
  const q = req.nextUrl.searchParams;
  return respond(await listProducts({ search: q.get("search"), category_id: q.get("category_id") }));
}

// POST /api/products -> 201 { message, product } | 400 { error, details }
export async function POST(req: NextRequest) {
  const blocked = await gate();
  if (blocked) return blocked;
  const denied = await requirePermission(req, "products:write");
  if (denied) return denied;
  const body = await readBody(req);
  if (body instanceof Response) return body;
  const result = await createProduct(body);
  if (result.status < 300) revalidateProductPages();
  return respond(result);
}

/** Home and categories are ISR - mark them stale so a new product appears on the next visit. */
function revalidateProductPages() {
  expire(TAG.catalog);
  revalidatePath("/");
  revalidatePath("/categories");
}
