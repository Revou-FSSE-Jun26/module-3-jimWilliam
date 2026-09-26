import "server-only";

import { revalidateTag } from "next/cache";

/**
 * Cache tags on the Server Components' fetches (lib/api.server.ts), expired by the route
 * handlers after a successful write.
 *
 * `expire: 0` means the next request re-renders instead of being served the old page while a
 * new one is built in the background - so an admin who saves and refreshes sees their change,
 * even on the ISR home page and the static About page.
 */
export const TAG = {
  /** products and categories: home, categories, product pages, about's live counts */
  catalog: "catalog",
  content: (key: string) => `content-${key}`,
  /** shop name, logo, time settings: read by the root layout, so every page */
  settings: "settings",
} as const;

export function expire(tag: string) {
  revalidateTag(tag, { expire: 0 });
}

/** Pass a store result through, expiring `tag` when the write succeeded. */
export function expiring<R extends { status: number }>(result: R, tag: string): R {
  if (result.status < 300) expire(tag);
  return result;
}
