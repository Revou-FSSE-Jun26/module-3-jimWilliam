import { readFileSync } from "node:fs";
import { test as base, type APIRequestContext } from "@playwright/test";
import { PROMO, PROMO_STORAGE_KEY } from "../lib/promo";
import { TOKENS_FILE, type Role } from "./global-setup";

/** `Authorization: Bearer <token>` for one of the sessions tests/global-setup.ts signed in. */
export function bearer(role: Role): Record<string, string> {
  const tokens = JSON.parse(readFileSync(TOKENS_FILE, "utf8")) as Record<Role, string>;
  return { authorization: `Bearer ${tokens[role]}` };
}

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
      let response;
      try {
        response = await goto(url, options);
      } catch (e) {
        // Firefox and WebKit abort a goto that races the app's own navigation still settling (the
        // router.push after a login, the router.refresh after a save); Chromium lets it through.
        // Once that navigation has landed, go where the spec asked.
        if (!/interrupted by another navigation|NS_BINDING_ABORTED|frame was detached/.test(String(e))) throw e;
        await page.waitForLoadState("load").catch(() => {});
        response = await goto(url, options);
      }
      await page
        .waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'), undefined, { timeout: 5_000 })
        .catch(() => {});
      // Typing into a form before React hydrates it is lost: hydration resets controlled inputs
      // (slower engines like WebKit show it). React tags each hydrated element with a
      // `__reactFiber$...` key, so wait for that on the header and on any form on the page.
      await page
        .waitForFunction(
          () =>
            [document.querySelector('[data-testid="site-header"]'), ...document.querySelectorAll("main form")]
              .filter((el) => el !== null)
              .every((el) => Object.keys(el!).some((k) => k.startsWith("__reactFiber$"))),
          undefined,
          { timeout: 10_000 }
        )
        .catch(() => {});
      return response;
    };
    await use(page);
  },

  request: async ({ playwright, baseURL }, use) => {
    const context = await playwright.request.newContext({ baseURL, extraHTTPHeaders: bearer("superadmin") });
    await use(context);
    await context.dispose();
  },
});

export { expect } from "@playwright/test";

/**
 * Specs that change data straight through the API (setup, or putting things back in `finally`)
 * must also refresh the cached pages that show it, as the app does after its own writes -
 * otherwise a later spec could be served the changed page. `request` is the superadmin fixture.
 */
export async function refreshPages(request: { post: APIRequestContext["post"] }, tags: string[]) {
  await request.post("/api/revalidate", { data: { tags } });
}
