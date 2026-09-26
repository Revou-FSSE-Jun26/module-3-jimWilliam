/** Everything this app keeps in the browser's localStorage, in one place. */
export const STORAGE_KEYS = {
  /** the signed-in user: { id, username, email, role } */
  user: "revotech:user",
  cart: "revotech:cart",
  build: "revotech:build",
  promo: "revotech:promo-seen",
  /** the dashboard theme a staff member picked: "dark" (default) or "light" */
  theme: "revotech:theme",
} as const;
