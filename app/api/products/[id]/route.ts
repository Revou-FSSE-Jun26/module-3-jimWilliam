import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { expire, TAG } from "@/lib/server/cache-tags";
import { requirePermission } from "@/lib/server/auth";
import { gate, readBody, respond, toId } from "@/lib/server/http";
import { deleteProduct, getProduct, updateProduct } from "@/lib/server/store";
import { releaseImages } from "@/lib/server/upload-cleanup";
import type { Product } from "@/lib/types";

/** The product's images before a write, so the uploads it drops can be deleted afterwards. */
const imagesOf = async (id: number) => {
  const r = await getProduct(id);
  return r.status === 200 ? ((r.body as Product).images ?? []) : [];
};

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/products/[id]">) {
  const blocked = await gate();
  if (blocked) return blocked;
  const { id } = await ctx.params;
  return respond(await getProduct(toId(id)));
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/products/[id]">) {
  const blocked = await gate();
  if (blocked) return blocked;
  const denied = await requirePermission(req, "products:write");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = await readBody(req);
  if (body instanceof Response) return body;
  const before = await imagesOf(toId(id));
  const result = await updateProduct(toId(id), body);
  if (result.status < 300) {
    revalidateProductPages(id);
    const now = new Set((result.body as { product: Product }).product.images ?? []);
    releaseImages(before.filter((url) => !now.has(url)));
  }
  return respond(result);
}

// 409 { error, id, active_orders } while pending / paid / shipped orders reference it
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/products/[id]">) {
  const blocked = await gate();
  if (blocked) return blocked;
  const denied = await requirePermission(req, "products:write");
  if (denied) return denied;
  const { id } = await ctx.params;
  const before = await imagesOf(toId(id));
  const result = await deleteProduct(toId(id));
  if (result.status < 300) {
    revalidateProductPages(id);
    releaseImages(before);
  }
  return respond(result);
}

/**
 * Product pages are statically generated (ISR, 5 min). Without this an admin's edit - new
 * images, an official link, a price - would not show on the product page for up to 5 minutes.
 */
function revalidateProductPages(id: string) {
  expire(TAG.catalog); // no stale page after saving - the admin reloads straight into their change
  revalidatePath(`/products/${id}`);
  revalidatePath("/");
  revalidatePath("/categories");
}
