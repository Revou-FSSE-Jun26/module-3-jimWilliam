import type { ContentKey, SiteContent } from "@/lib/content";
import type { Role } from "@/lib/roles";
import type { LogoVector } from "@/lib/server/logo";
import type { SiteSettings } from "@/lib/settings";
import type { Category, OrderStatus, Product, UserRecord } from "@/lib/types";

/** A user as stored - the public shape plus the password hash, which never leaves the server. */
export interface StoredUser extends UserRecord {
  password_hash: string;
}

export interface StoredOrderItem {
  order_item_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface StoredOrder {
  order_id: number;
  user_id: number;
  order_status: OrderStatus;
  shipping_address: string;
  ordered_at: string;
  items: StoredOrderItem[];
}

/**
 * Where the data actually lives. Two implementations:
 *
 *   memory.ts    arrays seeded from data/catalog.json - `npm run dev` with no setup, and the
 *                Playwright suite, which needs a known state every run
 *   postgres.ts  a real database (Supabase in production), so data survives a deploy
 *
 * lib/server/db/index.ts picks one from DATABASE_URL. All the rules - validation, stock,
 * permissions - live in lib/server/store.ts and run the same either way; this interface only
 * reads and writes rows.
 */
export interface DataSource {
  readonly kind: "memory" | "postgres";

  categories(): Promise<Category[]>;
  category(id: number): Promise<Category | null>;
  addCategory(row: Omit<Category, "category_id">): Promise<Category>;
  saveCategory(id: number, patch: Partial<Category>): Promise<Category>;
  removeCategory(id: number): Promise<void>;

  products(): Promise<Product[]>;
  product(id: number): Promise<Product | null>;
  addProduct(row: Omit<Product, "product_id">): Promise<Product>;
  saveProduct(id: number, patch: Partial<Product>): Promise<Product>;
  removeProduct(id: number): Promise<void>;
  /** Stock moves as one unit of work: a whole order's lines, or none of them. */
  adjustStock(changes: { product_id: number; delta: number }[]): Promise<void>;

  users(): Promise<StoredUser[]>;
  user(id: number): Promise<StoredUser | null>;
  userByEmail(email: string): Promise<StoredUser | null>;
  addUser(row: Omit<StoredUser, "id">): Promise<StoredUser>;
  saveUser(id: number, patch: Partial<StoredUser>): Promise<StoredUser>;

  orders(): Promise<StoredOrder[]>;
  order(id: number): Promise<StoredOrder | null>;
  addOrder(row: Omit<StoredOrder, "order_id">): Promise<StoredOrder>;
  saveOrder(id: number, patch: { order_status?: OrderStatus; shipping_address?: string }): Promise<StoredOrder>;

  content<K extends ContentKey>(key: K): Promise<SiteContent[K]>;
  saveContent<K extends ContentKey>(key: K, doc: SiteContent[K]): Promise<void>;

  settings(): Promise<SiteSettings>;
  saveSettings(settings: SiteSettings): Promise<void>;
  logo(): Promise<LogoVector>;
  saveLogo(logo: LogoVector): Promise<void>;
}

export type { Role };
