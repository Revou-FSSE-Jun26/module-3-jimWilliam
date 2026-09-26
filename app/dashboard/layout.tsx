import { AdminRoute } from "@/components/auth/Guards";
import DashboardNav from "@/components/dashboard/DashboardNav";

/**
 * The admin area: full width, no storefront footer (components/layout/ShopOnly), and the
 * dashboard tabs as a sidebar - a 15rem column beside the page from lg up.
 */
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <AdminRoute>
      <div className="px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:py-8 xl:px-8">
        <DashboardNav />
        <div className="min-w-0">{children}</div>
      </div>
    </AdminRoute>
  );
}
