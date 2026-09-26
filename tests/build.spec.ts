import { expect, test } from "./fixtures";

test.describe("build planner", () => {
  test("flags a socket clash on the slots and in the dropdown", async ({ page }) => {
    await page.goto("/build");
    const option = async (slot: string, text: string) =>
      (await page.getByTestId(`slot-${slot}`).locator("option").allTextContents()).find((o) => o.includes(text))!;

    await page.getByTestId("slot-cpu").selectOption({ label: await option("cpu", "9850X3D") });

    // before picking: the LGA1851 boards are already marked as not fitting the AM5 CPU
    expect(await option("motherboard", "B860M")).toContain("won't fit the AM5 CPU");
    expect(await option("motherboard", "B850")).not.toContain("✕");

    await page.getByTestId("slot-motherboard").selectOption({ label: await option("motherboard", "B860M") });
    await expect(page.getByTestId("build-slot-motherboard")).toHaveAttribute("data-status", "error");
    await expect(page.getByTestId("build-slot-motherboard-status")).toContainText("Socket mismatch");
    await expect(page.getByTestId("build-add-all")).toHaveCount(0); // logged out: no add button at all

    // fixing the board clears the error
    await page.getByTestId("slot-motherboard").selectOption({ label: await option("motherboard", "B850") });
    await expect(page.getByTestId("build-slot-motherboard")).toHaveAttribute("data-status", "ok");
  });

  test("a fast memory kit warns when the board can't run it at full speed", async ({ page }) => {
    await page.goto("/build");
    const pickRam = async (text: string) =>
      page.getByTestId("slot-ram").selectOption({ label: (await page.getByTestId("slot-ram").locator("option").allTextContents()).find((o) => o.includes(text))! });

    // H810 can't overclock memory: the DDR5-7600 kit falls back to its default 4800 MT/s
    await page.getByTestId("preset-budget").click();
    await pickRam("Dominator Titanium");
    await expect(page.getByTestId("build-slot-ram")).toHaveAttribute("data-status", "warning");
    await expect(page.getByTestId("build-checks")).toContainText("Memory runs at 4800 MT/s");
    await expect(page.getByTestId("build-checks")).toContainText("instead of its rated 7600");

    // an Intel-XMP-only kit on the AM5 board
    await page.getByTestId("preset-amd").click();
    await pickRam("Dominator Titanium");
    await expect(page.getByTestId("build-checks")).toContainText("Intel XMP kit on an AMD board");

    // on a B860 board (memory overclocking allowed) the kit runs at full speed: no warning
    await page.getByTestId("preset-intel").click();
    await pickRam("Dominator Titanium");
    await expect(page.getByTestId("build-checks")).not.toContainText("Memory runs at");
  });

  test("the status bar keeps the verdict visible on narrow screens", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto("/build");
    await page.getByTestId("preset-intel").click();
    const bar = page.getByTestId("build-status-bar");
    await expect(bar).toBeVisible();
    await expect(bar).not.toContainText("problem");
  });
});
