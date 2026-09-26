import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/Guards";
import UserManager from "@/components/dashboard/UserManager";
import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Users · Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function DashboardUsersPage() {
  // The list is loaded in the browser: GET /users is superadmin-only and the permission check
  // reads the signed-in user's id from the request, which only the browser can supply.
  return (
    <RequirePermission permission="users:manage">
      <PageHeader eyebrow="Admin" title="Users & roles">
        Who can sign in, and what each of them may do. Roles decide it — nobody gets a permission of their own.
      </PageHeader>
      <UserManager />
    </RequirePermission>
  );
}
