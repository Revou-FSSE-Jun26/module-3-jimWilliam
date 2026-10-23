"use client";

import OrdersTable from "@/components/dashboard/OrdersTable";
import { Skeleton } from "@/components/ui/Skeleton";
import { useApiData } from "@/hooks/useApiData";
import { api } from "@/lib/api.client";

/** Every customer's order, loaded in the browser with the admin's token, into the orders table. */
export default function AllOrders() {
  const { data: orders, error } = useApiData("all-orders", api.orders);
  if (error) throw error; // -> app/dashboard/error.tsx
  if (!orders) return <Skeleton className="h-96 rounded-card" />;
  return <OrdersTable orders={orders} />;
}
