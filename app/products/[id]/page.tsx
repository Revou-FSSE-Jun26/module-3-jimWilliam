import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductAdminBar } from "@/components/admin/PageAdminBars";
import ProductGrid from "@/components/product/ProductGrid";
import ProductGallery from "@/components/product/ProductGallery";
import ProductPurchase from "@/components/product/ProductPurchase";
import SpecTable from "@/components/product/SpecTable";
import { AvailabilityBadge, Badge } from "@/components/ui/Badge";
import StockMeter from "@/components/ui/StockMeter";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/api.server";
import { availabilityOf, formatIDR, specText } from "@/lib/format";
import { buttonVariants, cx } from "@/lib/classes";
import { galleryFor, metaFor } from "@/lib/meta";

// Rendering strategy: static generation + ISR. Every product page is prerendered at build
// (generateStaticParams) and regenerated at most every 5 minutes. Being static also means the
// page is fully prefetched, which is what lets the card image morph into this hero - a view
// transition only pairs when the destination renders in the same commit as the navigation.
export const revalidate = 300;

export async function generateStaticParams() {
  const products = await serverApi.products({}, { revalidate: 300 });
  return products.map((p) => ({ id: String(p.product_id) }));
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

async function loadProduct(id: string) {
  try {
    return await serverApi.product(id, { revalidate: 300 });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e; // anything else goes to app/products/error.tsx
  }
}

export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    // same URL + options as the page's own fetch, so Next memoises it into a single request
    const [product, settings] = await Promise.all([serverApi.product(id, { revalidate: 300 }), serverApi.settings({ cache: "force-cache" })]);
    const meta = metaFor(product);
    return {
      title: product.product_name,
      description: `${product.product_name} — ${specText(product.description)}. ${formatIDR(product.price)} at ${settings.shop_name}.`,
      openGraph: { title: product.product_name, images: [{ url: meta.image, width: 1600, height: 1600 }] },
    };
  } catch {
    return { title: `Product #${id}` };
  }
}

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const product = await loadProduct(id);

  const [category, allInCategory, categories] = await Promise.all([
    serverApi.category(product.category_id, { revalidate: 300 }).catch(() => null),
    serverApi.products({ category_id: product.category_id }, { revalidate: 300 }).catch(() => []),
    serverApi.categories({ revalidate: 300 }).catch(() => []),
  ]);
  const related = allInCategory.filter((p) => p.product_id !== product.product_id).slice(0, 4);

  const meta = metaFor(product);
  const availability = availabilityOf(product);
  const specsFrom = product.specs_source ?? product.official_url ?? null;
  const features = (product.description ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {/* admins only: edit this product in place */}
      <div className="mb-6 empty:hidden">
        <ProductAdminBar productId={product.product_id} categories={categories.map(({ category_id, category_name }) => ({ category_id, category_name }))} />
      </div>
      <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        {/* hero - shares its view-transition name with the product card */}
        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] opacity-40 blur-3xl" style={{ background: meta.accent }} aria-hidden />
          {/* gallery: main image + thumbnails; the main frame morphs from the product card */}
          <ProductGallery product={product} />
          {meta.origin === "generated" && galleryFor(product)[0].src === meta.image && (
            <p className="mt-3 font-mono text-[0.65rem] tracking-[0.14em] text-faint uppercase">Illustration · manufacturer photo unavailable</p>
          )}
        </div>

        <div className="flex flex-col gap-6 lg:pt-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {category && (
                <Link href={`/products?category_id=${category.category_id}`}>
                  <Badge tone="magenta">{category.category_name}</Badge>
                </Link>
              )}
              <AvailabilityBadge availability={availability} />
              {meta.socket && <Badge tone="blue">Socket {meta.socket}</Badge>}
            </div>
            {meta.brand && <p className="font-mono text-xs tracking-[0.2em] text-faint uppercase">{meta.brand}</p>}
            <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl" data-testid="product-title">
              {product.product_name}
            </h1>
          </div>

          <p className="font-mono text-3xl font-semibold text-ink tabular sm:text-4xl" data-testid="product-detail-price">
            {formatIDR(product.price)}
          </p>

          {product.is_active ? (
            <div className="max-w-sm space-y-1.5">
              <p className="font-mono text-[0.68rem] tracking-[0.16em] text-faint uppercase">Stock</p>
              <StockMeter stock={product.stock_quantity} />
              {availability === "low-stock" && <p className="font-mono text-xs text-amber">Only {product.stock_quantity} left — order soon</p>}
            </div>
          ) : (
            <p className="panel border-line-bright px-4 py-3 text-sm text-dim">This product has been withdrawn from sale and can&apos;t be ordered.</p>
          )}

          <ProductPurchase product={product} />

          {product.official_url && (
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={product.official_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cx(buttonVariants.secondary, "px-4")}
                data-testid="official-link"
              >
                View on official site <span aria-hidden>↗</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              <span className="font-mono text-xs text-faint">{hostOf(product.official_url)}</span>
            </div>
          )}

          {product.overview && (
            <section aria-labelledby="overview" className="space-y-2" data-testid="product-overview">
              <h2 id="overview" className="font-mono text-xs tracking-[0.2em] text-cyan uppercase">
                Overview
              </h2>
              <p className="leading-relaxed text-dim">{product.overview}</p>
              {product.overview_source && (
                <p className="text-xs text-faint">
                  Summary from{" "}
                  <a href={product.overview_source} target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">
                    {hostOf(product.overview_source)}
                  </a>
                </p>
              )}
            </section>
          )}

          {features.length > 0 && (
            <section aria-labelledby="features" className="panel p-5">
              <h2 id="features" className="mb-3 font-mono text-xs tracking-[0.2em] text-cyan uppercase">
                Key features
              </h2>
              <ul className="divide-y divide-line">
                {features.map((s) => (
                  <li key={s} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="size-1.5 rounded-full bg-cyan" aria-hidden />
                    {specText(s)}
                  </li>
                ))}
                {meta.watt > 0 && (
                  <li className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="size-1.5 rounded-full bg-amber" aria-hidden />
                    Typical power draw ~{meta.watt} W
                  </li>
                )}
              </ul>
            </section>
          )}

          {meta.socket && (
            <p className="text-sm text-dim">
              Planning a build around this?{" "}
              <Link href="/build" className="text-cyan underline-offset-4 hover:underline">
                The build planner
              </Link>{" "}
              checks it against your motherboard&apos;s socket.
            </p>
          )}
        </div>
      </div>

      {product.specs && product.specs.length > 0 && (
        <section aria-labelledby="tech-specs" className="panel mt-14 space-y-6 p-5 sm:p-8" data-testid="tech-specs">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="tech-specs" className="text-2xl font-semibold tracking-tight">
              Technical specifications
            </h2>
            {specsFrom && (
              <p className="text-xs text-faint">
                From{" "}
                <a href={specsFrom} target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline" data-testid="specs-source">
                  {hostOf(specsFrom)} <span aria-hidden>↗</span>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>{" "}
                · check the manufacturer&apos;s page for the latest details
              </p>
            )}
          </div>
          <SpecTable rows={product.specs} />
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-20 space-y-6">
          <h2 id="related" className="text-2xl font-semibold tracking-tight">
            More in {category?.category_name ?? "this category"}
          </h2>
          <ProductGrid products={related} categories={category ? [category] : []} priorityCount={0} />
        </section>
      )}
    </div>
  );
}
