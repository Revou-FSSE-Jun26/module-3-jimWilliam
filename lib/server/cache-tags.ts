import "server-only";

/**
 * Cache tags on the Server Components' fetches (lib/api.server.ts). Writes go straight to the
 * Flask API, so after a successful one the browser asks app/api/revalidate to expire the
 * matching tags - with `expire: 0`, so the next request re-renders instead of being served the
 * old page while a new one is built in the background. An admin who saves and refreshes sees
 * their change, even on the ISR home page and the static About page.
 */
export const TAG = {
  /** products and categories: home, categories, product pages, about's live counts */
  catalog: "catalog",
  content: (key: string) => `content-${key}`,
  /** shop name, logo, time settings: read by the root layout, so every page */
  settings: "settings",
} as const;
