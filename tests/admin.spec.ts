import { readFileSync } from "node:fs";
import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN_STATE, CUSTOMER_STATE } from "./global-setup";

/**
 * Admin tools on the storefront itself: edit a product from its page, edit the homepage and
 * About content in place, and handle orders in Dashboard -> Orders.
 *
 * These write to the shared in-memory store and read the result back, so the specs that
 * change data run locally only (on Vercel the write and the read can hit different instances),
 * and every one puts things back in `finally`.
 */
const isLocal = (baseURL?: string) => /localhost|127\.0\.0\.1/.test(baseURL ?? "");

/** An order from the test customer, so the seeded orders are never touched. */
async function placeOrder(request: APIRequestContext, productId: number) {
  const user = JSON.parse(readFileSync("tests/.auth/user.json", "utf8"));
  const res = await request.post("/api/orders", {
    data: { user_id: user.id, shipping_address: "Jl. Playwright No. 1, Jakarta", items: [{ product_id: productId, quantity: 1 }] },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).order as { order_id: number };
}
const stockOf = async (request: APIRequestContext, id: number) => (await (await request.get(`/api/products/${id}`)).json()).stock_quantity as number;
const orderNo = (id: number) => `#${String(id).padStart(4, "0")}`;

test.describe("navigation by role", () => {
  test.describe("customer", () => {
    test.use({ storageState: CUSTOMER_STATE });
    test("sees Orders, no admin bars", async ({ page }) => {
      await page.goto("/products/15");
      await expect(page.getByTestId("site-header").getByRole("link", { name: "Orders", exact: true })).toBeVisible();
      await expect(page.getByTestId("product-admin")).toHaveCount(0);
    });
  });

  test.describe("admin", () => {
    test.use({ storageState: ADMIN_STATE });
    test("has Dashboard instead of Orders, and an admin bar on editable pages", async ({ page }) => {
      await page.goto("/");
      const header = page.getByTestId("site-header");
      await expect(header.getByRole("link", { name: "Dashboard" })).toBeVisible();
      await expect(header.getByRole("link", { name: "Orders", exact: true })).toHaveCount(0);
      await expect(page.getByTestId("home-admin")).toBeVisible();
      await page.goto("/about");
      await expect(page.getByTestId("about-admin")).toBeVisible();
    });
  });
});

test.describe("admin editing in place", () => {
  test.use({ storageState: ADMIN_STATE });

  test("edit a product from its own page", async ({ page, request, baseURL }) => {
    test.skip(!isLocal(baseURL), "writes to the in-memory store");
    const before = await (await request.get("/api/products/15")).json();
    try {
      await page.goto("/products/15");
      await page.getByTestId("product-admin-edit").click();
      const modal = page.getByTestId("product-admin-modal");
      await expect(modal.getByTestId("pf-name")).toHaveValue(before.product_name);
      await modal.getByTestId("pf-price").fill("455000");
      await modal.getByTestId("pf-submit").click();
      await expect(page.getByTestId("product-detail-price")).toHaveText(/455\.000/);
      await page.goto("/products/15"); // a fresh load: the static page was re-rendered, not served stale
      await expect(page.getByTestId("product-detail-price")).toHaveText(/455\.000/);
    } finally {
      await request.put("/api/products/15", { data: { price: before.price } });
    }
  });

  test("edit the homepage", async ({ page, request, baseURL }) => {
    test.skip(!isLocal(baseURL), "writes to the in-memory store");
    const before = await (await request.get("/api/content/home")).json();
    try {
      await page.goto("/");
      await page.getByTestId("home-admin-edit").click();
      const editor = page.getByTestId("home-editor");

      // the same validation as the API, before anything is sent
      await editor.getByTestId("slide-0-title").fill("");
      await editor.getByTestId("home-editor-save").click();
      await expect(editor.getByTestId("home-editor-errors")).toContainText("Slide 1 title is required");

      await editor.getByTestId("slide-0-title").fill("Just landed — now in stock");
      await editor.getByTestId("home-heading-input").fill("Fresh parts, checked sockets");
      // five are featured already (the maximum): drop the first pick to make room, then add another
      const picker = editor.getByTestId("featured-picker");
      await picker.getByText("Corsair iCUE LINK TITAN II 360 RX LCD").click();
      await picker.getByText("AMD Ryzen 7 9850X3D").click();
      await editor.getByTestId("home-editor-save").click();

      await expect(page.getByText("Homepage saved")).toBeVisible();
      await expect(page.getByTestId("home-heading")).toHaveText("Fresh parts, checked sockets");
      await page.goto("/"); // a fresh load of the ISR page
      await expect(page.getByTestId("home-heading")).toHaveText("Fresh parts, checked sockets");
      await expect(page.getByTestId("hero-slider")).toContainText("Just landed — now in stock");
      // the featured grid follows the picks, in order
      await expect(page.getByRole("region", { name: "Fresh parts, checked sockets" }).getByRole("heading", { level: 3 })).toHaveText([
        "Corsair Dominator Titanium RGB DDR5 32GB",
        "MSI GeForce RTX 5070 12G Gaming Trio OC",
        "SanDisk Optimus GX PRO 850X 1TB Heatsink",
        "WD_BLACK SN850X 1TB Heatsink",
        "AMD Ryzen 7 9850X3D",
      ]);
    } finally {
      await request.put("/api/content/home", { data: before });
    }
  });

  test("edit the About page", async ({ page, request, baseURL }) => {
    test.skip(!isLocal(baseURL), "writes to the in-memory store");
    const before = await (await request.get("/api/content/about")).json();
    try {
      await page.goto("/about");
      await page.getByTestId("about-admin-edit").click();
      const editor = page.getByTestId("about-editor");
      await editor.getByTestId("about-name-input").fill("Jim W.");
      await editor.getByTestId("about-intro-input").fill("Frontend developer from Indonesia.");
      await editor.getByRole("button", { name: "Remove Testing" }).click();
      await editor.getByTestId("about-editor-save").click();

      await expect(page.getByText("About page saved")).toBeVisible();
      await page.goto("/about"); // still a static page - rebuilt once after the save
      await expect(page.getByTestId("about-name")).toHaveText("Jim W.");
      await expect(page.getByTestId("about-intro")).toHaveText("Frontend developer from Indonesia.");
      await expect(page.getByRole("heading", { name: "Testing", exact: true })).toHaveCount(0);
    } finally {
      await request.put("/api/content/about", { data: before });
    }
  });

  test("content is validated by the API too", async ({ request }) => {
    const home = await (await request.get("/api/content/home")).json();
    const bad = await request.put("/api/content/home", {
      data: { ...home, slides: home.slides.map((s: object) => ({ ...s, visible: false })), featured_ids: [999] },
    });
    expect(bad.status()).toBe(400);
    const { details } = await bad.json();
    expect(details).toContain("at least one slide must be visible");
    expect(details).toContain("featured_ids: no product 999");
    expect((await request.put("/api/content/about", { data: { name: "" } })).status()).toBe(400);
    expect((await request.get("/api/content/footer")).status()).toBe(404);
  });
});

test.describe("order handling", () => {
  test.use({ storageState: ADMIN_STATE });

  test("PUT /orders/[id] follows the Flask contract", async ({ request }) => {
    expect(await (await request.put("/api/orders/1", { data: {} })).json()).toEqual({ error: "no fields to update" });
    const badStatus = await request.put("/api/orders/1", { data: { order_status: "lost" } });
    expect(badStatus.status()).toBe(400);
    expect((await badStatus.json()).details[0]).toContain("order_status must be one of");
    const blank = await request.put("/api/orders/1", { data: { shipping_address: "   " } });
    expect((await blank.json()).details).toEqual(["shipping_address must not be blank"]);
    expect((await request.put("/api/orders/999999", { data: { order_status: "paid" } })).status()).toBe(404);
  });

  test("move an order along, cancel it and reopen it", async ({ page, request, baseURL }) => {
    test.skip(!isLocal(baseURL), "writes to the in-memory store");
    const productId = 16; // Arctic P12, plenty of stock
    const stock = await stockOf(request, productId);
    const { order_id } = await placeOrder(request, productId);
    expect(await stockOf(request, productId)).toBe(stock - 1);

    await page.goto("/dashboard/orders");
    const row = page.getByTestId("admin-order-row").filter({ hasText: orderNo(order_id) });
    await expect(row.getByTestId("admin-order-status")).toHaveText("Pending");

    // one click to the next step
    await row.getByTestId("order-next").click();
    await expect(page.getByText(`${orderNo(order_id)} marked as paid`)).toBeVisible();
    await expect(row.getByTestId("admin-order-status")).toHaveText("Paid");
    await expect(row.getByTestId("order-next")).toHaveText("Mark shipped");

    // the dialog: cancel (confirm) puts the item back in stock, reopen takes it again
    await row.getByTestId("order-manage").click();
    const manager = page.getByTestId("order-manager");
    page.once("dialog", (d) => d.accept());
    await manager.getByTestId("om-cancel").click();
    await expect(manager.getByTestId("om-reopen")).toBeVisible();
    await expect(row.getByTestId("admin-order-status")).toHaveText("Cancelled");
    expect(await stockOf(request, productId)).toBe(stock);

    await manager.getByTestId("om-reopen").click();
    await expect(manager.getByTestId("om-cancel")).toBeVisible();
    expect(await stockOf(request, productId)).toBe(stock - 1);

    await manager.getByTestId("om-address").fill("Jl. Playwright No. 2, Bandung");
    await manager.getByTestId("om-save-address").click();
    await expect(page.getByText(`${orderNo(order_id)} address updated`)).toBeVisible();
    expect((await (await request.get(`/api/orders/${order_id}`)).json()).shipping_address).toBe("Jl. Playwright No. 2, Bandung");

    // leave it cancelled, so the stock is back where it started
    await request.put(`/api/orders/${order_id}`, { data: { order_status: "cancelled" } });
    expect(await stockOf(request, productId)).toBe(stock);
  });
});
