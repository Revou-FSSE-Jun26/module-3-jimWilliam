import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-card" />
    </div>
  );
}
