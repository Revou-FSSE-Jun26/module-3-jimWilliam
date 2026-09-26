import { expect, test } from "./fixtures";
import { CUSTOMER_STATE } from "./global-setup";

test.use({ storageState: CUSTOMER_STATE });

test.describe("shopping journey", () => {
  test("search -> product detail -> add to cart -> cart -> checkout -> orders", async ({ page }) => {
    // 1. search from the catalogue: Enter pushes ?search= into the URL
    await page.goto("/products");
    const search = page.getByTestId("search-input").first();
    await search.fill("arctic");
    await search.press("Enter");
    await expect(page).toHaveURL(/search=arctic/);
    await expect(page.getByTestId("product-card")).toHaveCount(1);

    // 2. open it
    await page.getByTestId("product-card").getByRole("link", { name: "Arctic P12 ARGB Case Fan", exact: true }).click();
    await expect(page).toHaveURL(/\/products\/16$/);
    await expect(page.getByTestId("product-title")).toHaveText("Arctic P12 ARGB Case Fan");
    await expect(page).toHaveTitle(/Arctic P12 ARGB Case Fan/); // generateMetadata uses the real name

    // 3. two of them into the cart
    const purchase = page.getByTestId("purchase");
    await purchase.getByRole("button", { name: "Increase quantity" }).click();
    await purchase.getByTestId("add-to-cart").click();
    await expect(page.getByText("2 × Arctic P12 ARGB Case Fan added to cart")).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("2");

    // 4. the cart survives a refresh (localStorage) and shows the right total
    await page.goto("/cart");
    await page.reload();
    await expect(page.getByTestId("cart-row")).toHaveCount(1);
    await expect(page.getByTestId("cart-total")).toHaveText(/300\.000/);

    // 5. checkout: POST /orders, cart cleared, redirected to /orders
    await page.getByTestId("checkout-button").click();
    await expect(page).toHaveURL(/\/checkout$/);
    await page.getByTestId("shipping-address").fill("Jl. Playwright No. 1, Jakarta Selatan");
    await page.getByTestId("confirm-order").click();

    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByTestId("order-row").first()).toContainText("300.000");
    await expect(page.getByTestId("cart-count")).toHaveCount(0);
  });

  test("category filter refetches the list", async ({ page }) => {
    await page.goto("/products");
    await page.getByTestId("category-filter").selectOption({ label: "Graphics Cards" });
    await expect(page).toHaveURL(/category_id=4/);
    await expect(page.getByTestId("product-card")).toHaveCount(3);
  });

  test("an empty cart cannot be checked out", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.getByTestId("cart-empty")).toBeVisible();
    await expect(page.getByTestId("checkout-button")).toBeDisabled();
  });

  test("signing out empties the cart and hides the cart button", async ({ page }) => {
    await page.goto("/products/19");
    await page.getByTestId("purchase").getByTestId("add-to-cart").click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.getByTestId("logout").click();
    await expect(page.getByTestId("header-login")).toBeVisible();
    await expect(page.getByTestId("header-cart")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("revotech:cart"))).toBe("[]");

    await page.reload();
    await expect(page.getByTestId("header-cart")).toHaveCount(0);
  });

  test("removing the last item empties the cart", async ({ page }) => {
    await page.goto("/products/19");
    await page.getByTestId("purchase").getByTestId("add-to-cart").click();
    await page.goto("/cart");
    await page.getByTestId("cart-remove").click();
    await expect(page.getByTestId("cart-empty")).toBeVisible();
  });
});
