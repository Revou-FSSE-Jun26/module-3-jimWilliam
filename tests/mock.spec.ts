import { expect, test } from "./fixtures";

/**
 * page.route() intercepts the browser's own requests, so these tests control what the client
 * receives from GET /api/products without touching the server's data. (The first paint of
 * /products is server-rendered; ProductList then refetches in the browser, and that request is
 * the one being mocked.)
 */
test.describe("mocked API responses", () => {
  test("renders whatever GET /products returns", async ({ page }) => {
    await page.route("**/api/products*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            product_id: 9001,
            category_id: 4,
            product_name: "Mocked Quantum GPU 99GB",
            description: "does not exist, served by page.route",
            price: 123456789,
            stock_quantity: 3,
            is_active: true,
            created_at: "2026-09-01T00:00:00",
          },
        ]),
      })
    );

    await page.goto("/products");
    await expect(page.getByText("Mocked Quantum GPU 99GB")).toBeVisible();
    await expect(page.getByTestId("product-card")).toHaveCount(1);
    await expect(page.getByTestId("result-count")).toContainText("1 result");
  });

  test("shows an inline error when the API answers 500", async ({ page }) => {
    await page.route("**/api/products*", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "database unavailable" }) })
    );
    await page.goto("/products");
    // scoped by text: Next's own route announcer is also role="alert"
    await expect(page.getByText("Could not refresh results")).toContainText("Database unavailable");
    // the server-rendered results are still on screen - a failed refresh never blanks the page
    await expect(page.getByTestId("product-card").first()).toBeVisible();
  });

  test("an empty result shows the empty state", async ({ page }) => {
    await page.route("**/api/products*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.goto("/products?search=zzz-nothing");
    await expect(page.getByTestId("empty-products")).toBeVisible();
  });
});
