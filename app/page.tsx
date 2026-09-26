import Link from "next/link";
import { HomeAdminBar } from "@/components/admin/PageAdminBars";
import HeroSlider from "@/components/HeroSlider";
import ProductGrid from "@/components/product/ProductGrid";
import Card from "@/components/ui/Card";
import { serverApi } from "@/lib/api.server";
import { buttonVariants, cx } from "@/lib/classes";
import { featuredProducts } from "@/lib/content";
import { CATEGORY_ACCENT } from "@/lib/meta";

// Rendering strategy: ISR. Prerendered at build, regenerated at most every 5 minutes, so the
// home page is static-fast but still picks up price and stock changes.
export const revalidate = 300;

/**
 * Pure Server Component: fetches GET /products and renders the featured five, read-only. The
 * slide copy, cards and featured picks are editable content (GET /api/content/home); an admin
 * sees an "Edit homepage" bar, and saving expires this page's cache tags so it re-renders.
 */
export default async function HomePage() {
  const [products, categories, content] = await Promise.all([
    serverApi.products({}, { revalidate: 300 }),
    serverApi.categories({ revalidate: 300 }),
    serverApi.home({ revalidate: 300 }),
  ]);
  const featured = featuredProducts(content, products);

  return (
    <div className="mx-auto max-w-7xl space-y-20 px-4 pt-6 pb-10 sm:px-6">
      <div className="mb-6! empty:hidden">
        <HomeAdminBar products={products.map(({ product_id, product_name, is_active }) => ({ product_id, product_name, is_active }))} />
      </div>
      {/* remount when the set of slides changes, so the slider never points past the last one */}
      <HeroSlider key={content.slides.map((s) => `${s.id}:${s.visible}`).join()} slides={content.slides} />

      <section aria-labelledby="pillars" className="grid gap-4 md:grid-cols-3">
        <h2 id="pillars" className="sr-only">
          Why RevoTech
        </h2>
        {content.pillars.map((p, i) => (
          <Card key={i} className="clip-hud p-6">
            <p className="font-mono text-xs text-cyan">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="mt-3 text-lg font-semibold">{p.title}</h3>
            <p className="mt-1.5 text-sm text-dim">{p.body}</p>
          </Card>
        ))}
      </section>

      <section id="new-arrivals" aria-labelledby="featured-title" className="scroll-mt-24 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs tracking-[0.24em] text-cyan uppercase">
              <span className="text-faint">{"//"}</span> {content.featured_eyebrow}
            </p>
            <h1 id="featured-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl" data-testid="home-heading">
              {content.featured_heading}
            </h1>
          </div>
          <Link href="/products" className={buttonVariants.secondary} data-testid="home-products-link">
            All {products.length} products →
          </Link>
        </div>
        <ProductGrid products={featured} categories={categories} readOnly columns={5} priorityCount={0} />
      </section>

      <section aria-labelledby="cat-title" className="space-y-8">
        <div>
          <p className="font-mono text-xs tracking-[0.24em] text-magenta uppercase">
            <span className="text-faint">{"//"}</span> Browse
          </p>
          <h2 id="cat-title" className="mt-2 text-3xl font-semibold tracking-tight">
            Shop by category
          </h2>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const accent = CATEGORY_ACCENT[c.category_id] ?? "#22d3ee";
            return (
              <li key={c.category_id}>
                <Card as={Link} href={`/products?category_id=${c.category_id}`} interactive accent={accent} className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="text-base font-semibold">{c.category_name}</p>
                    <p className="mt-0.5 text-sm text-dim first-letter:uppercase">{c.description}</p>
                  </div>
                  <span className="font-mono text-2xl tabular" style={{ color: accent }}>
                    {String(c.product_count ?? 0).padStart(2, "0")}
                  </span>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel relative overflow-hidden p-8 sm:p-12">
        <div className="absolute -top-24 -right-24 size-72 rounded-full bg-magenta/20 blur-3xl" aria-hidden />
        <div className="relative max-w-xl space-y-4">
          <p className="font-mono text-xs tracking-[0.24em] text-magenta uppercase">Build planner</p>
          <h2 className="text-3xl font-semibold tracking-tight">Plan a whole rig, not just a part.</h2>
          <p className="text-dim">
            One part per slot, a live total, and a compatibility check that knows an Intel Core Ultra chip won&apos;t sit in an
            AM5 board — and that a 650 W supply is tight for an RTX 5070.
          </p>
          <Link href="/build" className={cx(buttonVariants.primary, "mt-2")}>
            Open the planner →
          </Link>
        </div>
      </section>
    </div>
  );
}
