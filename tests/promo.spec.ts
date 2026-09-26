import { expect, test } from "@playwright/test";

/**
 * The first-visit pop-up. Uses @playwright/test directly rather than ./fixtures, because the
 * shared fixture switches the pop-up off for every other spec.
 */
test.describe("new arrivals pop-up", () => {
  test("shows once, on the first page a visitor opens, promoting the iCUE LINK TITAN II", async ({ page }) => {
    await page.goto("/products");
    const promo = page.getByTestId("promo");
    await expect(promo).toBeVisible();
    await expect(promo.getByTestId("promo-product")).toHaveText("Corsair iCUE LINK TITAN II 360 RX LCD");
    await expect(promo.getByTestId("promo-also")).toHaveCount(4);

    await promo.getByTestId("promo-cta").click();
    await expect(page).toHaveURL(/\/products\/21$/);
    await expect(promo).toBeHidden();

    // seen: neither a reload nor another page brings it back
    await page.goto("/");
    await page.waitForTimeout(2000);
    await expect(page.getByTestId("promo")).toBeHidden();
  });

  test("closes with Esc and stays closed", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("promo")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("promo")).toBeHidden();
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(page.getByTestId("promo")).toBeHidden();
  });

  test("never interrupts sign-in or checkout", async ({ page }) => {
    await page.goto("/login");
    await page.waitForTimeout(2000);
    await expect(page.getByTestId("promo")).toBeHidden();
  });
});
