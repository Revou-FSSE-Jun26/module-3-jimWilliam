/**
 * Captures the screenshots used in the README (docs/screenshots/*.avif).
 *
 *   node scripts/screenshots.mjs                          every page, desktop + mobile
 *   node scripts/screenshots.mjs --base=http://localhost:3100
 *   node scripts/screenshots.mjs --only=dashboard-users,account   just these pages
 *   node scripts/screenshots.mjs --state=loading --base=... throttles the network for the products page
 *   node scripts/screenshots.mjs --state=error   --base=... needs the app running with the Flask API stopped
 *
 * Signed-in pages use real sessions: each demo account signs in through the API first, so the
 * stored session carries the API's token, exactly as after logging in.
 */
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs", "screenshots");
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const BASE = arg("base", "http://localhost:8100");
const STATE = arg("state", "pages");
const ONLY = arg("only")?.split(",");

/** Sign a demo account in through the API: { id, username, email, role, token } - the stored session. */
async function signIn(email) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  if (!res.ok) throw new Error(`login ${email} -> ${res.status}: ${await res.text()}`);
  const { user, access_token } = await res.json();
  return { id: user.id, username: user.username, email: user.email, role: user.role, token: access_token };
}
const needsSession = STATE === "pages";
const SUPERADMIN = needsSession ? await signIn("andi.pratama@example.com") : null;
const ADMIN = needsSession ? await signIn("budi.santoso@example.com") : null;
const CUSTOMER = needsSession ? await signIn("siti.rahayu@example.com") : null;
const CART = [
  { product_id: 12, product_name: "MSI GeForce RTX 5070 12G Gaming Trio OC", price: 13450000, quantity: 1, stock_quantity: 6 },
  { product_id: 3, product_name: "AMD Ryzen 7 9850X3D", price: 9650000, quantity: 1, stock_quantity: 8 },
  { product_id: 8, product_name: "Corsair Dominator Titanium RGB DDR5 32GB", price: 13550000, quantity: 1, stock_quantity: 10 },
];
const BUILD = { cpu: 3, motherboard: 5, ram: 8, storage: 22, gpu: 12, psu: 14, cooler: 21 };

/** [name, path, who, viewports, dashboard theme (default dark)] */
const PAGES = [
  ["home", "/", null, ["desktop", "mobile", "wide"]],
  ["products", "/products", null, ["desktop", "mobile"]],
  ["products-search", "/products?search=nvidia", null, ["desktop"]],
  ["products-category", "/products?category_id=2", null, ["desktop"]],
  ["product-detail", "/products/12", CUSTOMER, ["desktop", "mobile"]],
  ["categories", "/categories", null, ["desktop"]],
  ["about", "/about", null, ["desktop", "mobile"]],
  ["checkpoint-1-static", "/checkpoint-1/index.html", null, ["desktop", "mobile"]],
  ["register", "/register", null, ["desktop"]],
  ["login", "/login", null, ["desktop"]],
  ["cart", "/cart", CUSTOMER, ["desktop", "mobile"]],
  ["checkout", "/checkout", CUSTOMER, ["desktop"]],
  ["orders", "/orders", CUSTOMER, ["desktop"]],
  ["account", "/account", CUSTOMER, ["desktop", "mobile"]],
  ["build", "/build", CUSTOMER, ["desktop"]],
  ["dashboard", "/dashboard", ADMIN, ["desktop", "mobile"]],
  ["dashboard-light", "/dashboard", SUPERADMIN, ["desktop"], "light"],
  ["dashboard-categories", "/dashboard/categories", ADMIN, ["desktop"]],
  ["dashboard-orders", "/dashboard/orders", ADMIN, ["desktop"]],
  ["dashboard-users", "/dashboard/users", SUPERADMIN, ["desktop"]],
  ["dashboard-settings", "/dashboard/settings", SUPERADMIN, ["desktop"]],
];

// wide = a 4K monitor at Windows' default 150 % scaling
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 }, wide: { width: 2560, height: 1440 } };

/**
 * Waits until every image on the page has really loaded. next/image lazy-loads anything below the
 * fold and a full-page screenshot doesn't scroll, so those would be captured blank or as their blur
 * placeholder: switch them to eager, walk down the page (for anything that loads on scroll), then
 * wait for each image to finish. A broken image fails the run instead of ending up in the README.
 */
async function settle(page) {
  await page.evaluate(async () => {
    for (const img of document.images) img.loading = "eager";
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    scrollTo(0, 0);
    await document.fonts.ready;
  });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), undefined, { timeout: 30_000 });
  const broken = await page.evaluate(() =>
    [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src)
  );
  if (broken.length) throw new Error(`${page.url()}: images failed to load:\n  ${broken.join("\n  ")}`);
  await page.waitForTimeout(400); // blur placeholders fade out
}

async function save(page, name, fullPage = true) {
  await settle(page);
  const png = await page.screenshot({ fullPage });
  const file = join(OUT, `${name}.avif`);
  // AVIF caps each side at 16384px - long mobile pages at 2x would exceed it
  await sharp(png)
    .resize({ width: 16000, height: 16000, fit: "inside", withoutEnlargement: true })
    .avif({ quality: 60, effort: 5 })
    .toFile(file);
  console.log(`  ${name}.avif`);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

async function context(viewport, who, theme = "dark") {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[viewport], deviceScaleFactor: viewport === "mobile" ? 2 : 1, reducedMotion: "reduce" });
  await ctx.addInitScript(
    ([user, cart, build, theme]) => {
      if (user) localStorage.setItem("revotech:user", JSON.stringify(user));
      else localStorage.removeItem("revotech:user");
      localStorage.setItem("revotech:cart", JSON.stringify(user ? cart : []));
      localStorage.setItem("revotech:build", JSON.stringify(build));
      localStorage.setItem("revotech:promo-seen", "new-arrivals-2026-09"); // keep the first-visit pop-up out of the shots
      localStorage.setItem("revotech:theme", theme);
    },
    [who, CART, BUILD, theme]
  );
  return ctx;
}

if (STATE === "pages") {
  for (const [name, path, who, viewports, theme] of PAGES.filter(([name]) => !ONLY || ONLY.includes(name))) {
    for (const vp of viewports) {
      const ctx = await context(vp, who, theme);
      const page = await ctx.newPage();
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      await save(page, `${name}-${vp}`);
      await ctx.close();
    }
  }
  // the command palette, open, mid-search
  if (ONLY && !ONLY.includes("command-palette")) process.exit(0);
  const ctx = await context("desktop", ADMIN);
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.keyboard.press("Control+k");
  await page.getByTestId("command-input").fill("5070");
  await page.waitForTimeout(700);
  await save(page, "command-palette-desktop", false);
  await ctx.close();
}

if (STATE === "loading") {
  // client-side navigation into /products while it is slow -> app/products/loading.tsx
  const ctx = await context("desktop", null);
  const page = await ctx.newPage();
  await page.goto(BASE + "/about", { waitUntil: "networkidle" });
  // hold back the page's server-component payload for a few seconds
  await page.route(/\/products(\?|$)/, async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.continue();
  });
  await page.getByTestId("nav-products").click();
  await page.getByTestId("products-loading").waitFor();
  await save(page, "state-loading-desktop", false);
  await ctx.close();
}

if (STATE === "error") {
  const ctx = await context("desktop", null);
  const page = await ctx.newPage();
  await page.goto(BASE + "/products", { waitUntil: "networkidle" });
  await page.getByTestId("error-boundary").waitFor();
  await save(page, "state-error-desktop", false);
  await ctx.close();
}

await browser.close();
