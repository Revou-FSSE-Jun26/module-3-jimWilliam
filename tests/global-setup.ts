import { request, type FullConfig } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const CUSTOMER_STATE = "tests/.auth/customer.json";
/** Budi: the admin role - the catalogue, orders and page content, but not users or settings. */
export const ADMIN_STATE = "tests/.auth/admin.json";
/** Andi: the superadmin - everything, including users, roles and store settings. */
export const SUPERADMIN_STATE = "tests/.auth/superadmin.json";
/** The access tokens of the three sessions above, for direct API calls in specs. */
export const TOKENS_FILE = "tests/.auth/tokens.json";
export const SUPERADMIN_ID = 1;
export const TEST_PASSWORD = "playwright-pass-123";

export type Role = "superadmin" | "admin" | "customer";

/**
 * Runs once before the suite.
 *
 * Locally it first reseeds the end-to-end database (scripts/e2e-backend.mjs), so every run starts
 * from the same catalogue, users and orders. Against production it never does.
 *
 * Then, through the API exactly as the app does it: a fresh customer is registered (POST /users,
 * no UI) and signed in, and the two seeded staff accounts sign in - one per role, so a spec can
 * pick the weaker one and prove a permission really is missing. Each session is written as a
 * storage-state file whose localStorage holds { id, username, email, role, token }, the same
 * shape the app stores after logging in, and the tokens are kept for direct API calls.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  const isLocal = /localhost|127\.0\.0\.1/.test(baseURL);

  if (isLocal) {
    const seeded = spawnSync(process.execPath, ["scripts/e2e-backend.mjs"], { encoding: "utf8" });
    if (seeded.status !== 0) throw new Error(`reseeding the e2e database failed:\n${seeded.stdout}\n${seeded.stderr}`);
  }

  const api = await request.newContext({ baseURL });

  // unique per run, so repeated runs against the same database never collide on email
  const stamp = Date.now().toString(36);
  const res = await api.post("/api/users", {
    data: { username: `Playwright ${stamp}`, email: `pw-${stamp}@example.com`, password: TEST_PASSWORD },
  });
  if (res.status() !== 201) throw new Error(`POST /api/users -> ${res.status()}: ${await res.text()}`);
  const { user } = await res.json();

  const signIn = async (email: string, password: string) => {
    const res = await api.post("/api/auth/login", { data: { email, password } });
    if (!res.ok()) throw new Error(`POST /api/auth/login (${email}) -> ${res.status()}: ${await res.text()}`);
    const body = (await res.json()) as { access_token: string; user: { id: number; username: string; email: string; role: Role } };
    return { ...body.user, token: body.access_token };
  };
  const sessions: Record<Role, Awaited<ReturnType<typeof signIn>>> = {
    customer: await signIn(user.email, TEST_PASSWORD),
    admin: await signIn("budi.santoso@example.com", "password123"),
    superadmin: await signIn("andi.pratama@example.com", "password123"),
  };

  // The reseed changed the data behind the cached catalogue, content and settings pages.
  if (isLocal) {
    await api.post("/api/revalidate", {
      headers: { authorization: `Bearer ${sessions.superadmin.token}` },
      data: { tags: ["catalog", "content-home", "content-about", "settings"] },
    });
  }

  const origin = new URL(baseURL).origin;
  const state = (s: (typeof sessions)[Role]) => ({
    cookies: [],
    origins: [{ origin, localStorage: [{ name: "revotech:user", value: JSON.stringify(s) }] }],
  });

  mkdirSync(dirname(CUSTOMER_STATE), { recursive: true });
  writeFileSync(CUSTOMER_STATE, JSON.stringify(state(sessions.customer), null, 2));
  writeFileSync(ADMIN_STATE, JSON.stringify(state(sessions.admin), null, 2));
  writeFileSync(SUPERADMIN_STATE, JSON.stringify(state(sessions.superadmin), null, 2));
  writeFileSync(TOKENS_FILE, JSON.stringify(Object.fromEntries(Object.entries(sessions).map(([role, s]) => [role, s.token])), null, 2));
  writeFileSync("tests/.auth/user.json", JSON.stringify({ ...user, password: TEST_PASSWORD }, null, 2));

  await api.dispose();
}
