import sharp from "sharp";
import { expect, test } from "./fixtures";
import { SUPERADMIN_STATE } from "./global-setup";

/**
 * Dashboard -> Settings: shop name, time zone and format, contact details, and the logo, which
 * is converted to SVG on upload. Specs that change settings put them back in `finally`.
 */
const isLocal = (baseURL?: string) => /localhost|127\.0\.0\.1/.test(baseURL ?? "");

/** A flat two-colour logo on white, like a typical PNG an admin would upload. */
const flatLogo = () =>
  sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240"><rect width="600" height="240" fill="#fff"/><circle cx="110" cy="120" r="80" fill="#e11d48"/><rect x="230" y="60" width="320" height="120" rx="20" fill="#111"/></svg>`
    )
  )
    .png()
    .toBuffer();

test.describe("settings API", () => {
  test("validates settings", async ({ request }) => {
    const current = await (await request.get("/api/settings")).json();
    const res = await request.put("/api/settings", { data: { ...current, shop_name: " ", timezone: "Mars/Olympus", support_email: "nope" } });
    expect(res.status()).toBe(400);
    const { details } = await res.json();
    expect(details).toEqual(expect.arrayContaining(["shop_name is required", "timezone is not one of the supported zones", "support_email must be an email address"]));
  });

  test("serves the logo as a locked-down SVG, in full and square icon variants", async ({ request }) => {
    for (const url of ["/api/settings/logo", "/api/settings/logo?variant=icon"]) {
      const res = await request.get(url);
      expect(res.headers()["content-type"]).toContain("image/svg+xml");
      expect(res.headers()["content-security-policy"]).toContain("default-src 'none'");
      expect(await res.text()).toMatch(/^<svg[^>]*viewBox=/);
    }
    const icon = await (await request.get("/api/settings/logo?variant=icon")).text();
    const [, , w, h] = icon.match(/viewBox="([^"]+)"/)![1].split(" ").map(Number);
    expect(w).toBe(h); // square, for the browser tab
  });

  test("converts an uploaded image to SVG paths with its real colours", async ({ request }) => {
    const res = await request.post("/api/settings/logo", { multipart: { file: { name: "logo.png", mimeType: "image/png", buffer: await flatLogo() } } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.colours.sort()).toEqual(["#111111", "#e11d48"]);
    expect(body.svg).toMatch(/<path fill="#e11d48" d="M /);
  });

  test("never copies anything from an uploaded SVG into the logo", async ({ request }) => {
    const hostile = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><script>alert(1)</script><rect width="400" height="200" fill="#fff"/><rect x="50" y="50" width="300" height="100" fill="#2563eb" onload="alert(2)"/></svg>`
    );
    const res = await request.post("/api/settings/logo", { multipart: { file: { name: "logo.svg", mimeType: "image/svg+xml", buffer: hostile } } });
    expect(res.status()).toBe(200);
    const { svg } = await res.json();
    expect(svg).not.toMatch(/script|onload|alert/i);
    expect(svg).toContain('fill="#2563eb"');
  });

  test("rejects files that aren't logos", async ({ request }) => {
    const res = await request.post("/api/settings/logo", { multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("not an image") } } });
    expect(res.status()).toBe(400);
  });
});

test.describe("settings page", () => {
  test.use({ storageState: SUPERADMIN_STATE });

  test("rename the shop and change the time zone", async ({ page, request, baseURL }) => {
    test.skip(!isLocal(baseURL), "writes to the in-memory store");
    const before = await (await request.get("/api/settings")).json();
    try {
      await page.goto("/dashboard/settings");
      const form = page.getByTestId("settings-form");
      await form.getByTestId("set-name").fill("JW Tech Store");
      await form.getByTestId("set-timezone").selectOption("Asia/Makassar");
      await form.getByTestId("set-clock-12h").check({ force: true });
      await expect(form.getByTestId("set-time-preview")).toContainText(/(am|pm) WITA/);
      await form.getByTestId("settings-save").click();
      await expect(page.getByText("Settings saved")).toBeVisible();

      await page.goto("/");
      await expect(page).toHaveTitle(/^JW Tech Store — /);
      await expect(page.getByTestId("site-header").getByTestId("brand-name")).toHaveText("JW Tech Store");
      await page.goto("/dashboard/orders");
      await expect(page.getByTestId("admin-order-row").first().locator("td").nth(2)).toContainText(/(am|pm) WITA$/);
    } finally {
      await request.put("/api/settings", { data: before });
    }
  });

  test("upload a logo: preview, apply, and the favicon follows", async ({ page, request, baseURL }) => {
    test.skip(!isLocal(baseURL), "writes to the in-memory store");
    try {
      await page.goto("/dashboard/settings");
      const version = (await (await request.get("/api/settings")).json()).logo_version;
      await page.getByTestId("logo-input").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: await flatLogo() });
      await expect(page.getByTestId("logo-preview")).toContainText("#e11d48");
      await page.getByTestId("logo-apply").click();
      await expect(page.getByText("Logo updated")).toBeVisible();

      await page.goto("/");
      await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", `/api/settings/logo?variant=icon&v=${version + 1}`);
      expect(await (await request.get("/api/settings/logo")).text()).toContain('fill="#e11d48"');
    } finally {
      await request.delete("/api/settings/logo");
    }
  });
});
