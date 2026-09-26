import { AdminRoute } from "@/components/auth/Guards";
import DashboardNav from "@/components/dashboard/DashboardNav";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <AdminRoute>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <DashboardNav />
        {children}
      </div>
    </AdminRoute>
  );
}
