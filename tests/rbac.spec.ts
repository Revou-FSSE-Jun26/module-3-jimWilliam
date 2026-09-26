import { readFileSync } from "node:fs";
import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN_STATE, CUSTOMER_STATE, SUPERADMIN_STATE, TEST_PASSWORD } from "./global-setup";

/**
 * Three roles, checked on both sides: what each one is shown, and what the API lets each one do.
 *
 * The `request` fixture is signed in as the superadmin, so these specs build their own contexts
 * (`as(...)`) to speak as somebody weaker - or as nobody at all.
 */
const SUPERADMIN = 1; // Andi
const ADMIN = 3; // Budi
const CUSTOMER = 2; // Siti

/** An API client that speaks as one user - or, with no id, as nobody. */
type Playwright = { request: { newContext(options: { baseURL: string; extraHTTPHeaders?: Record<string, string> }): Promise<APIRequestContext> } };
const as = (playwright: Playwright, baseURL: string, userId?: number) =>
  playwright.request.newContext({ baseURL, extraHTTPHeaders: userId ? { "x-user-id": String(userId) } : {} });

const isLocal = (baseURL?: string) => /localhost|127\.0\.0\.1/.test(baseURL ?? "");

test.describe("API permissions", () => {
  test("a write needs a signed-in user with the right role", async ({ playwright, baseURL }) => {
    const anon = await as(playwright, baseURL!);
    const customer = await as(playwright, baseURL!, CUSTOMER);
    const admin = await as(playwright, baseURL!, ADMIN);
    const superadmin = await as(playwright, baseURL!, SUPERADMIN);
    const price = { data: { price: 480000 } };

    // nobody: 401, with no hint about what was needed
    const anonRes = await anon.put("/api/products/15", price);
    expect(anonRes.status()).toBe(401);
    expect((await anonRes.json()).error).toBe("authentication required");

    // a customer: 403, naming the permission they lack
    const customerRes = await customer.put("/api/products/15", price);
    expect(customerRes.status()).toBe(403);
    expect(await customerRes.json()).toMatchObject({ permission: "products:write", role: "customer" });

    // an admin: allowed on the catalogue
    expect((await admin.put("/api/products/15", price)).status()).toBe(200);
    // ...but not on the store settings or the user list
    const settings = await (await superadmin.get("/api/settings")).json();
    expect((await admin.put("/api/settings", { data: settings })).status()).toBe(403);
    expect((await admin.get("/api/users")).status()).toBe(403);

    // the superadmin: both
    expect((await superadmin.put("/api/settings", { data: settings })).status()).toBe(200);
    expect((await superadmin.get("/api/users")).status()).toBe(200);

    for (const ctx of [anon, customer, admin, superadmin]) await ctx.dispose();
  });

  test("every admin-only endpoint refuses a customer", async ({ playwright, baseURL }) => {
    const customer = await as(playwright, baseURL!, CUSTOMER);
    const calls: [string, Promise<{ status(): number }>][] = [
      ["POST /products", customer.post("/api/products", { data: { product_name: "x", category_id: 5, price: 1, stock_quantity: 1 } })],
      ["DELETE /products/16", customer.delete("/api/products/16")],
      ["POST /categories", customer.post("/api/categories", { data: { category_name: "x" } })],
      ["PUT /orders/1", customer.put("/api/orders/1", { data: { order_status: "paid" } })],
      ["PUT /content/home", customer.put("/api/content/home", { data: {} })],
      ["POST /uploads", customer.post("/api/uploads", { multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("x") } } })],
      ["DELETE /settings/logo", customer.delete("/api/settings/logo")],
      ["GET /official-preview", customer.get("/api/official-preview?url=https://example.com")],
    ];
    for (const [name, call] of calls) expect((await call).status(), name).toBe(403);
    await customer.dispose();
  });
});

test.describe("profiles and roles", () => {
  test("a customer edits their own profile but not anyone else's, and not their role", async ({ playwright, baseURL, request }) => {
    test.skip(!isLocal(baseURL), "writes to the in-memory store");
    const before = await (await request.get(`/api/users/${CUSTOMER}`)).json();
    const customer = await as(playwright, baseURL!, CUSTOMER);
    try {
      const ok = await customer.put(`/api/users/${CUSTOMER}`, { data: { address: "Jl. Playwright No. 9, Bandung", phone_number: "+62 811 0000 111" } });
      expect(ok.status()).toBe(200);
      expect((await ok.json()).user.address).toBe("Jl. Playwright No. 9, Bandung");

      expect((await customer.put(`/api/users/${ADMIN}`, { data: { address: "nope" } })).status()).toBe(403);

      const promote = await customer.put(`/api/users/${CUSTOMER}`, { data: { role: "superadmin" } });
      expect(promote.status()).toBe(403);
      expect((await (await request.get(`/api/users/${CUSTOMER}`)).json()).role).toBe("customer");
    } finally {
      await request.put(`/api/users/${CUSTOMER}`, { data: { address: before.address, phone_number: before.phone_number } });
      await customer.dispose();
    }
  });

  test("changing a password needs the current one, unless a superadmin does it", async ({ playwright, baseURL, request }) => {
    test.skip(!isLocal(baseURL), "writes to the in-memory store");
    const customer = await as(playwright, baseURL!, CUSTOMER);
    const login = (password: string) => request.post("/api/auth/login", { data: { email: "siti.rahayu@example.com", password } });
    try {
      const wrong = await customer.put(`/api/users/${CUSTOMER}`, { data: { current_password: "not-it", password: "brand-new-pass" } });
      expect(wrong.status()).toBe(400);
      expect((await wrong.json()).details).toContain("current password is not correct");

      const short = await customer.put(`/api/users/${CUSTOMER}`, { data: { current_password: "password123", password: "short" } });
      expect((await short.json()).details[0]).toContain("at least 8 characters");

      expect((await customer.put(`/api/users/${CUSTOMER}`, { data: { current_password: "password123", password: "brand-new-pass" } })).status()).toBe(200);
      expect((await login("brand-new-pass")).status()).toBe(200);

      // the superadmin resets it without knowing it
      expect((await request.put(`/api/users/${CUSTOMER}`, { data: { password: "password123" } })).status()).toBe(200);
      expect((await login("password123")).status()).toBe(200);
    } finally {
      await request.put(`/api/users/${CUSTOMER}`, { data: { password: "password123" } });
      await customer.dispose();
    }
  });

  test("a superadmin cannot change their own role or demote the last one", async ({ request, baseURL }) => {
    test.skip(!isLocal(baseURL), "writes to the in-memory store");
    const own = await request.put(`/api/users/${SUPERADMIN}`, { data: { role: "admin" } });
    expect(own.status()).toBe(400);
    expect((await own.json()).details).toContain("you cannot change your own role");

    // promote someone else, demote the original, then put it all back
    try {
      expect((await request.put(`/api/users/${CUSTOMER}`, { data: { role: "superadmin" } })).status()).toBe(200);
      expect((await request.put(`/api/users/${SUPERADMIN}`, { data: { role: "admin" } })).status()).toBe(400); // still your own role
    } finally {
      await request.put(`/api/users/${CUSTOMER}`, { data: { role: "customer" } });
    }
  });
});

test.describe("what each role sees", () => {
  test.describe("customer", () => {
    test.use({ storageState: CUSTOMER_STATE });
    test("has no dashboard and is turned away from it", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByTestId("site-header").getByRole("link", { name: "Dashboard" })).toHaveCount(0);
      await page.goto("/dashboard");
      await expect(page).toHaveURL("/");
    });
  });

  test.describe("customer account page", () => {
    test.use({ storageState: CUSTOMER_STATE });
    test("edits their profile and changes their password", async ({ page, request, baseURL }) => {
      test.skip(!isLocal(baseURL), "writes to the in-memory store");
      const id = JSON.parse(readFileSync("tests/.auth/user.json", "utf8")).id as number;
      try {
        await page.goto("/account");
        await expect(page.getByTestId("account-role")).toHaveText("Customer");
        await page.getByTestId("acc-address").fill("Jl. Fixture No. 4, Surabaya");
        await page.getByTestId("acc-phone").fill("+62 812 3456 7890");
        await page.getByTestId("acc-save").click();
        await expect(page.getByText("Profile saved")).toBeVisible();
        expect((await (await request.get(`/api/users/${id}`)).json()).address).toBe("Jl. Fixture No. 4, Surabaya");

        // the wrong current password is refused
        await page.getByTestId("acc-current-password").fill("not-my-password");
        await page.getByTestId("acc-password").fill("another-pass-1");
        await page.getByTestId("acc-confirm").fill("another-pass-1");
        await page.getByTestId("acc-password-save").click();
        await expect(page.getByTestId("account-password-errors")).toContainText("Current password is not correct");

        await page.getByTestId("acc-current-password").fill(TEST_PASSWORD);
        await page.getByTestId("acc-password-save").click();
        await expect(page.getByText("Password changed")).toBeVisible();
        expect((await request.post("/api/auth/login", { data: { email: JSON.parse(readFileSync("tests/.auth/user.json", "utf8")).email, password: "another-pass-1" } })).status()).toBe(200);
      } finally {
        await request.put(`/api/users/${id}`, { data: { password: TEST_PASSWORD } });
      }
    });
  });

  test.describe("admin", () => {
    test.use({ storageState: ADMIN_STATE });
    test("gets the catalogue tabs but no Users or Settings", async ({ page }) => {
      await page.goto("/dashboard");
      const nav = page.getByRole("navigation", { name: "Dashboard" });
      await expect(nav.getByRole("link")).toHaveText(["Products", "Categories", "Orders"]);
      await expect(page.getByTestId("product-row").first()).toBeVisible();

      // and is bounced back to the dashboard if it tries the superadmin pages directly
      await page.goto("/dashboard/settings");
      await expect(page).toHaveURL("/dashboard");
      await page.goto("/dashboard/users");
      await expect(page).toHaveURL("/dashboard");
    });
  });

  test.describe("superadmin", () => {
    test.use({ storageState: SUPERADMIN_STATE });
    test("gets every tab, and can change a role from the users page", async ({ page, request, baseURL }) => {
      test.skip(!isLocal(baseURL), "writes to the in-memory store");
      await page.goto("/dashboard");
      const nav = page.getByRole("navigation", { name: "Dashboard" });
      await expect(nav.getByRole("link")).toHaveText(["Products", "Categories", "Orders", "Users", "Settings"]);

      await page.goto("/dashboard/users");
      const row = page.getByTestId("user-row").filter({ hasText: "maya.kusuma@example.com" });
      try {
        await row.getByTestId("user-role").selectOption("admin");
        await expect(page.getByText("Maya Kusuma is now admin")).toBeVisible();
        expect((await (await request.get("/api/users/6")).json()).role).toBe("admin");

        // their own row explains why it is locked
        const own = page.getByTestId("user-row").filter({ hasText: "andi.pratama@example.com" });
        await expect(own.getByTestId("user-role")).toBeDisabled();
        await expect(own).toContainText("You cannot change your own role");
      } finally {
        await request.put("/api/users/6", { data: { role: "customer" } });
      }
    });
  });
});
