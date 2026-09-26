/**
 * Shapes mirror the Module 2 Flask/SQLAlchemy `to_dict()` output field for field, so the
 * frontend can point at the real API later without touching a single component.
 */
import type { Role } from "./roles";
import type { SpecRow } from "./specs";

export type { SpecRow };

export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

export type { Role };

export interface Category {
  category_id: number;
  category_name: string;
  description: string | null;
  created_at: string;
}

export interface CategoryDetail extends Category {
  products: Product[];
  product_count: number;
}

export interface Product {
  product_id: number;
  category_id: number;
  product_name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  /*
   * Frontend extensions - not part of the Module 2 Flask model. Optional so the app still works
   * against the real API; docs/updated-seed.sql adds the matching columns.
   */
  /** the manufacturer's own product page */
  official_url?: string | null;
  /** a short overview, usually the manufacturer's published summary */
  overview?: string | null;
  /** where the overview was taken from, shown as a credit; null if written in-house */
  overview_source?: string | null;
  /** gallery, first = primary. Only this app's own AVIF paths (uploads are converted on arrival) */
  images?: string[];
  /** the manufacturer's technical specifications, as label/value rows */
  specs?: SpecRow[];
  /** the page the specs were taken from - the product page, or a separate spec page */
  specs_source?: string | null;
}

/** Gallery size limit, shared by the API's validation and the dashboard's image manager. */
export const MAX_PRODUCT_IMAGES = 12;

/** What POST /products and PUT /products/:id accept. */
export interface ProductInput {
  product_name: string;
  category_id: number;
  price: number;
  stock_quantity: number;
  description?: string;
  is_active?: boolean;
  official_url?: string | null;
  overview?: string | null;
  overview_source?: string | null;
  images?: string[];
  specs?: SpecRow[];
  specs_source?: string | null;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role?: Role;
}

export interface UserRecord extends User {
  phone_number: string | null;
  address: string | null;
  role: Role;
  created_at: string;
}

export interface OrderItem {
  order_item_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Order {
  order_id: number;
  user_id: number;
  username?: string;
  order_status: OrderStatus;
  total_amount: number;
  shipping_address: string;
  ordered_at: string;
  item_count?: number;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
}

export interface OrderInput {
  user_id: number;
  shipping_address: string;
  items: { product_id: number; quantity: number }[];
}

export interface CartItem {
  product_id: number;
  product_name: string;
  price: number;
  quantity: number;
  stock_quantity: number;
}

/** Every Flask error body carries `error`; the rest depends on the endpoint. */
export interface ApiErrorBody {
  error: string;
  details?: string[];
  fields?: string[];
  id?: number;
  active_orders?: number;
  product_count?: number;
}

/** Availability is derived, never stored - a union so every branch is handled. */
export type Availability = "in-stock" | "low-stock" | "out-of-stock" | "unavailable";
