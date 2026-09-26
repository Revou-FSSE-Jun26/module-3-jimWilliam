import { Skeleton, SkeletonGrid } from "@/components/ui/Skeleton";

// Shown while GET /products is in flight - set MOCK_API_LATENCY_MS to see it on demand.
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6" data-testid="products-loading">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
      <SkeletonGrid />
    </div>
  );
}
