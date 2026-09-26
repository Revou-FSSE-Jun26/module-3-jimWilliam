import "server-only";

import { memoryData } from "./memory";
import { postgresData } from "./postgres";
import type { DataSource } from "./types";

/**
 * The data source for this process: PostgreSQL when DATABASE_URL is set (production on Vercel,
 * pointing at Supabase), otherwise the in-memory catalogue (local development and the tests).
 */
let source: DataSource | undefined;

export function data(): DataSource {
  if (!source) {
    const url = process.env.DATABASE_URL?.trim();
    source = url ? postgresData(url) : memoryData();
  }
  return source;
}

export type { DataSource, StoredOrder, StoredOrderItem, StoredUser } from "./types";
