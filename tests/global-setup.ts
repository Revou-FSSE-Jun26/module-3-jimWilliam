import { request, type FullConfig } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const CUSTOMER_STATE = "tests/.auth/customer.json";
/** Budi: the admin role - the catalogue, orders and page content, but not users or settings. */
export const ADMIN_STATE = "tests/.auth/admin.json";
/** Andi: the superadmin - everything, including users, roles and store settings. */
export const SUPERADMIN_STATE = "tests/.auth/superadmin.json";
export const SUPERADMIN_ID = 1;
export const TEST_PASSWORD = "playwright-pass-123";

/**
 * Runs once before the suite. Creates a fresh customer straight through the API - POST /users,
 * no UI - then writes a storage-state file whose localStorage holds { id, username, email }
 * exactly as the app stores it after registering. Specs that need a signed-in user start from
 * that file instead of clicking through the register form every time.
 *
 * The two seeded staff accounts are signed in the same way via POST /auth/login, one per role,
 * so a spec can pick the weaker one and prove that a permission really is missing.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  const api = await request.newContext({ baseURL });

  // unique per run, so repeated runs against the same server never collide on email
  const stamp = Date.now().toString(36);
  const res = await api.post("/api/users", {
    data: { username: `Playwright ${stamp}`, email: `pw-${stamp}@example.com`, password: TEST_PASSWORD },
  });
  if (res.status() !== 201) throw new Error(`POST /api/users -> ${res.status()}: ${await res.text()}`);
  const { user } = await res.json();

  const signIn = async (email: string) => {
    const res = await api.post("/api/auth/login", { data: { email, password: "password123" } });
    if (!res.ok()) throw new Error(`POST /api/auth/login (${email}) -> ${res.status()}: ${await res.text()}`);
    return (await res.json()).user as { id: number; username: string; email: string; role: string };
  };
  const superadmin = await signIn("andi.pratama@example.com");
  const admin = await signIn("budi.santoso@example.com");

  const origin = new URL(baseURL).origin;
  const state = (u: { id: number; username: string; email: string; role?: string }) => ({
    cookies: [],
    origins: [{ origin, localStorage: [{ name: "revotech:user", value: JSON.stringify(u) }] }],
  });

  mkdirSync(dirname(CUSTOMER_STATE), { recursive: true });
  writeFileSync(CUSTOMER_STATE, JSON.stringify(state({ id: user.id, username: user.username, email: user.email }), null, 2));
  writeFileSync(ADMIN_STATE, JSON.stringify(state({ id: admin.id, username: admin.username, email: admin.email, role: admin.role }), null, 2));
  writeFileSync(SUPERADMIN_STATE, JSON.stringify(state({ id: superadmin.id, username: superadmin.username, email: superadmin.email, role: superadmin.role }), null, 2));
  writeFileSync("tests/.auth/user.json", JSON.stringify({ ...user, password: TEST_PASSWORD }, null, 2));

  await api.dispose();
}
