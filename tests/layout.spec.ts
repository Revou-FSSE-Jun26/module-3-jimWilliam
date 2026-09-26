import { expect, test } from "./fixtures";
import { ADMIN_STATE, CUSTOMER_STATE, SUPERADMIN_STATE } from "./global-setup";

/**
 * Screen sizes up to 4K, the full-width admin area with its sidebar, and the dashboard's
 * dark / light theme.
 */

const rootFontSize = (page: import("@playwright/test").Page) =>
  page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
const theme = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.dataset.theme ?? "dark");

test.describe("large screens", () => {
  for (const [width, px] of [
    [1440, 16],
    [1920, 16],
    [2560, 18.67],
    [3840, 24],
  ] as const) {
    test(`the layout scales at ${width}px wide`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1200 });
      await page.goto("/");
      expect(await rootFontSize(page)).toBeCloseTo(px, 1);
      // the page column is 80rem, so it grows with the screen instead of staying 1280px
      const column = await page.getByTestId("site-header").locator(":scope > div").last().boundingBox();
      expect(column!.width).toBeCloseTo(Math.min(width, px * 80), -1);
    });
  }
});

test.describe("admin area", () => {
  test.use({ storageState: ADMIN_STATE });

  test("full width, no footer, tabs in a vertical sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation", { name: "Dashboard" });
    const [first, second] = await Promise.all([0, 1].map((i) => nav.getByRole("link").nth(i).boundingBox()));
    expect(second!.y).toBeGreaterThan(first!.y); // stacked, not side by side
    expect(second!.x).toBeCloseTo(first!.x, 0);
    expect(first!.x).toBeLessThan(80); // at the left edge, not in a centred column
    await expect(page.getByTestId("site-footer")).toHaveCount(0);

    // the storefront keeps its footer
    await page.getByTestId("site-header").getByRole("link", { name: "Products", exact: true }).click();
    await expect(page.getByTestId("site-footer")).toBeVisible();
  });

  test("on a phone the tabs scroll sideways above the page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation", { name: "Dashboard" });
    const [first, second] = await Promise.all([0, 1].map((i) => nav.getByRole("link").nth(i).boundingBox()));
    expect(second!.y).toBeCloseTo(first!.y, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test.describe("dashboard theme", () => {
  test.use({ storageState: SUPERADMIN_STATE });

  test("switch to light: remembered, dashboard only, back to dark on the storefront", async ({ page }) => {
    await page.goto("/dashboard");
    const toggle = page.getByTestId("theme-toggle");
    await expect(toggle.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    expect(await theme(page)).toBe("dark");

    await toggle.getByRole("button", { name: "Light" }).click();
    await expect(toggle.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    expect(await theme(page)).toBe("light");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(243, 246, 251)");

    // a reload is light from the first paint - set by the inline script, before React runs
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await theme(page)).toBe("light");

    // the storefront stays dark, and the dashboard is light again on the way back
    await page.getByTestId("site-header").getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => theme(page)).toBe("dark");
    await page.getByTestId("site-header").getByRole("link", { name: "Dashboard" }).click();
    await expect.poll(() => theme(page)).toBe("light");

    await toggle.getByRole("button", { name: "Dark" }).click();
    await expect.poll(() => theme(page)).toBe("dark");
  });

  test.describe("a customer", () => {
    test.use({ storageState: CUSTOMER_STATE });
    test("never gets the light theme, even with it saved in the browser", async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("revotech:theme", "light"));
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      expect(await theme(page)).toBe("dark");
      await expect(page).toHaveURL(/\/$/); // and is sent away from the dashboard
      expect(await theme(page)).toBe("dark");
    });
  });
});
