import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN_STATE } from "./global-setup";

test.use({ storageState: ADMIN_STATE });

/**
 * On Vercel the mock API's in-memory store lives per serverless instance, so a product created
 * by one request may be unknown to the instance that serves the next. When the suite runs
 * against a remote deployment, the endpoints for *the product this test creates* are answered
 * by a small stateful page.route() mock instead; locally every call goes to the real API.
 */
async function pinCreatedProduct(page: Page) {
  let created: Record<string, unknown> | null = null;
  await page.route("**/api/products", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = route.request().postDataJSON();
    created = { product_id: 900001, created_at: new Date().toISOString().slice(0, 19), description: null, ...body };
    await route.fulfill({ status: 201, json: { message: "product created", product: created } });
  });
  await page.route("**/api/products/900001", async (route) => {
    const method = route.request().method();
    if (method === "GET") return route.fulfill({ json: created });
    if (method === "PUT") {
      created = { ...created, ...route.request().postDataJSON() };
      return route.fulfill({ json: { message: "product updated", product: created } });
    }
    if (method === "DELETE") return route.fulfill({ json: { message: "product deleted", id: 900001 } });
    return route.fallback();
  });
}

test.describe("admin dashboard", () => {
  test("create -> edit price -> delete a product", async ({ page, baseURL }) => {
    if (!/localhost|127\.0\.0\.1/.test(baseURL ?? "")) await pinCreatedProduct(page);
    const name = `PW Test Cooler ${Date.now().toString(36)}`;

    await page.goto("/dashboard");
    await expect(page.getByTestId("stats-hud")).toBeVisible();

    // create
    await page.getByTestId("new-product").click();
    const modal = page.getByTestId("create-modal");
    await modal.getByTestId("pf-name").fill(name);
    await modal.getByTestId("pf-category").selectOption({ label: "Power and Cooling" });
    await modal.getByTestId("pf-price").fill("750000");
    await modal.getByTestId("pf-stock").fill("12");
    await modal.getByTestId("pf-submit").click();

    await expect(page.getByText(`Created ${name}`)).toBeVisible(); // success toast
    const row = page.getByTestId("product-row").filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByTestId("row-price")).toHaveText(/750\.000/);

    // edit the price
    await row.getByTestId("edit-product").click();
    const edit = page.getByTestId("edit-modal");
    await expect(edit.getByTestId("pf-name")).toHaveValue(name); // pre-populated from GET /products/[id]
    await edit.getByTestId("pf-price").fill("699000");
    await edit.getByTestId("pf-submit").click();
    await expect(page.getByText(`Saved ${name}`)).toBeVisible();
    await expect(row.getByTestId("row-price")).toHaveText(/699\.000/);

    // delete, with the inline confirmation
    await row.getByTestId("delete-product").click();
    await expect(row.getByTestId("confirm-delete")).toContainText("Are you sure?");
    await row.getByTestId("confirm-delete-yes").click();
    await expect(page.getByText(`Deleted ${name}`)).toBeVisible();
    await expect(page.getByTestId("product-row").filter({ hasText: name })).toHaveCount(0);
  });

  test("client-side validation blocks an incomplete product", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("new-product").click();
    await page.getByTestId("create-modal").getByTestId("pf-submit").click();
    await expect(page.getByTestId("pf-error-product_name")).toBeVisible();
    await expect(page.getByTestId("pf-error-category_id")).toBeVisible();
    await expect(page.getByTestId("pf-error-price")).toBeVisible();
  });

  test("a product with active orders cannot be deleted", async ({ page }) => {
    await page.goto("/dashboard");
    // the RTX 5070 is in a pending order in the seed data
    const row = page.getByTestId("product-row").filter({ hasText: "MSI GeForce RTX 5070 12G Gaming Trio OC" });
    await row.getByTestId("delete-product").click();
    await row.getByTestId("confirm-delete-yes").click();
    await expect(row.getByTestId("row-error")).toContainText("active orders");
    await expect(row).toBeVisible();
  });
});
