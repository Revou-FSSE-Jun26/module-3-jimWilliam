import { SkeletonGrid } from "@/components/ui/Skeleton";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6">
      <Skeleton className="aspect-21/9 w-full rounded-3xl" />
      <SkeletonGrid count={4} />
    </div>
  );
}
