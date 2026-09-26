import { test as base } from "@playwright/test";
import { PROMO, PROMO_STORAGE_KEY } from "../lib/promo";
import { SUPERADMIN_ID } from "./global-setup";

/**
 * Every spec imports `test` from here instead of @playwright/test.
 *
 * Why: during server rendering React streams finished Suspense content into hidden
 * `<div hidden id="S:n">` segments and then moves them into place with an inline script. React
 * 19.2 throttles those reveals, so for a few hundred milliseconds after the page's `load` event
 * the same content can exist twice in the DOM - once visible, once in a hidden segment. Users
 * never see it, but Playwright's strict locators count hidden elements too, which made
 * `getByTestId(...)` intermittently resolve to two elements. After each full page load we wait
 * until no pending segment is left.
 *
 * It also marks the first-visit promotion as seen, so the pop-up doesn't cover the page under
 * test (tests/promo.spec.ts checks the pop-up itself, without this fixture), and signs the
 * `request` fixture in as the superadmin - direct API calls in a spec are usually setup or
 * clean-up, not the thing under test. tests/rbac.spec.ts builds its own contexts instead, so it
 * can check what each role is refused.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(([key, id]) => localStorage.setItem(key, id), [PROMO_STORAGE_KEY, PROMO.id]);
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await goto(url, options);
      await page
        .waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'), undefined, { timeout: 5_000 })
        .catch(() => {});
      return response;
    };
    await use(page);
  },

  request: async ({ playwright, baseURL }, use) => {
    const context = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-user-id": String(SUPERADMIN_ID) } });
    await use(context);
    await context.dispose();
  },
});

export { expect } from "@playwright/test";
