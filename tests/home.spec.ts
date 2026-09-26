import { expect, test } from "./fixtures";

test.describe("home page", () => {
  // The first test, written against visible text and roles.
  test("shows the heading and navigates to products (role locators)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Fresh drops for the next build" })).toBeVisible();

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Products" }).click();
    await expect(page).toHaveURL(/\/products$/);
  });

  // The same test after adding data-testid attributes: copy changes no longer break it.
  test("shows the heading and navigates to products (test ids)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-heading")).toBeVisible();
    await expect(page.getByTestId("product-card")).toHaveCount(5);

    await page.getByTestId("nav-products").click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByTestId("product-grid")).toBeVisible();
  });

  test("hero slider changes slide from its controls", async ({ page }) => {
    await page.goto("/");
    const slider = page.getByTestId("hero-slider");
    await expect(slider.getByRole("tab", { selected: true })).toHaveAccessibleName(/Slide 1/);
    await slider.getByRole("button", { name: "Next slide" }).click();
    await expect(slider.getByRole("tab", { selected: true })).toHaveAccessibleName(/Slide 2/);
  });

  test("hero slider autoplays, and the pause button stops it", async ({ page }) => {
    await page.clock.install(); // drive the autoplay timer without real waiting
    await page.goto("/");
    await page.mouse.move(5, 5); // keep the pointer off the slider - hovering pauses it
    const slider = page.getByTestId("hero-slider");

    await page.clock.runFor(7_000);
    await expect(slider.getByRole("tab", { selected: true })).toHaveAccessibleName(/Slide 2/);

    await slider.getByTestId("hero-playpause").click();
    await expect(slider.getByTestId("hero-playpause")).toHaveAccessibleName("Play slideshow");
    await page.mouse.move(5, 5);
    await page.clock.runFor(20_000);
    await expect(slider.getByRole("tab", { selected: true })).toHaveAccessibleName(/Slide 2/);
  });
});
