import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/Guards";
import SettingsForm from "@/components/dashboard/SettingsForm";
import PageHeader from "@/components/ui/PageHeader";
import { serverApi } from "@/lib/api.server";

export const metadata: Metadata = { title: "Settings · Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DashboardSettingsPage() {
  // no-store: the form edits what the API has now, never a cached copy
  const settings = await serverApi.settings({ cache: "no-store" });
  return (
    <RequirePermission permission="settings:write">
      <PageHeader eyebrow="Admin" title="Settings">
        The shop&apos;s name, logo, time zone and contact details. Changes show on every page as soon as they are saved.
      </PageHeader>
      <SettingsForm initial={settings} />
    </RequirePermission>
  );
}
