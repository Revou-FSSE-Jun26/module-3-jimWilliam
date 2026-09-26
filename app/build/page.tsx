import type { Metadata } from "next";
import BuildPlanner from "@/components/build/BuildPlanner";
import PageHeader from "@/components/ui/PageHeader";
import { serverApi } from "@/lib/api.server";

export const metadata: Metadata = {
  title: "Build planner",
  description: "Plan a whole PC: one part per slot, a running total, and socket, memory and power checks before you buy.",
};

export const dynamic = "force-dynamic";

export default async function BuildPage() {
  const products = await serverApi.products({}, { cache: "no-store" });
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Build planner" title="Plan a rig">
        One part per slot. The planner checks the socket, the memory generation and the power budget as you go.
      </PageHeader>
      <BuildPlanner products={products} />
    </div>
  );
}
