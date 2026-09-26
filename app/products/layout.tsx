import CatalogRail from "@/components/product/CatalogRail";

/**
 * Nested layout shared by /products and /products/[id]. It stays mounted while you move
 * between the list and a detail page - CatalogRail's timer proves it by never resetting.
 */
export default function ProductsLayout({ children }: LayoutProps<"/products">) {
  return (
    <>
      <CatalogRail />
      {children}
    </>
  );
}
