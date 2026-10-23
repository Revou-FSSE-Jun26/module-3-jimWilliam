import { PORTFOLIO_URL } from "../lib/site";
import { expect, test } from "./fixtures";

/** robots.txt and sitemap.xml (app/robots.ts, app/sitemap.ts), and the /portfolio redirect. */

test("robots.txt lets crawlers into the shop, not the private pages, and points at the sitemap", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const txt = await res.text();
  for (const path of ["/dashboard", "/account", "/checkout", "/api/"]) expect(txt).toContain(`Disallow: ${path}`);
  expect(txt).toContain("Allow: /api/images/");
  expect(txt).toMatch(/^Sitemap: https?:\/\/.+\/sitemap\.xml$/m);
});

test("/portfolio is a temporary redirect to the portfolio, which /about and the footer link to", async ({ page, request }) => {
  const res = await request.get("/portfolio", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toBe(PORTFOLIO_URL);

  await page.goto("/about");
  const button = page.getByTestId("about-portfolio");
  await expect(button).toHaveAttribute("href", PORTFOLIO_URL);
  await expect(button).toHaveAttribute("target", "_blank");
  await expect(page.getByTestId("site-footer").getByRole("link", { name: "My portfolio" })).toHaveAttribute("href", PORTFOLIO_URL);
});

test("sitemap.xml lists the storefront and products for sale, with their images", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/products\/1<\/loc>/);
  expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/about<\/loc>/);
  expect(xml).toContain("<image:loc>");
  // the LG monitor (product 20) is not for sale in the seed data, so it is left out
  expect(xml).not.toMatch(/\/products\/20<\/loc>/);
  expect(xml).not.toContain("/dashboard");
});
