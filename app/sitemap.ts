import type { MetadataRoute } from "next";
import { serverApi } from "@/lib/api.server";
import { galleryFor } from "@/lib/meta";
import { absoluteUrl } from "@/lib/site";

/** The public storefront pages; the account, cart, checkout and admin pages are left out on purpose. */
const PAGES = ["/", "/products", "/categories", "/build", "/about"];

/**
 * /sitemap.xml - the storefront pages plus every product that is for sale, each with its main
 * image. Fetched with the same 5-minute revalidation as the product pages, so a new product
 * shows up here when its page does. If the API is down, the static pages are still listed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await serverApi.products({}, { revalidate: 300 }).catch(() => []);
  return [
    ...PAGES.map((path) => ({ url: absoluteUrl(path) })),
    ...products
      .filter((p) => p.is_active)
      .map((p) => ({
        url: absoluteUrl(`/products/${p.product_id}`),
        images: [absoluteUrl(galleryFor(p)[0].src)],
      })),
  ];
}
