"use client";

import ErrorPanel from "@/components/ui/ErrorPanel";

// Catches anything thrown by the products page or a product detail page - including the
// ApiError that serverApi throws when GET /products answers with a non-2xx status.
export default function ProductsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorPanel error={error} retry={retry} what="the catalogue" />;
}
