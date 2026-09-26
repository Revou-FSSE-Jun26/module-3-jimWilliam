import sharp from "sharp";
import { expect, test } from "./fixtures";
import { ADMIN_STATE } from "./global-setup";

/**
 * Official links, credited overviews, and admin image uploads (converted to AVIF on the server).
 * Uploads are written to the instance's disk, so the upload specs only run locally - on Vercel
 * the file and the request that reads it back may land on different instances.
 */
const isLocal = (baseURL?: string) => /localhost|127\.0\.0\.1/.test(baseURL ?? "");

const png = (color: string, size = 400) =>
  sharp({ create: { width: size, height: size, channels: 3, background: color } }).png().toBuffer();

test.describe("official page and overview", () => {
  test("the product page links to the manufacturer and credits the overview", async ({ page }) => {
    await page.goto("/products/4");
    const link = page.getByTestId("official-link");
    await expect(link).toHaveAttribute("href", /^https:\/\/www\.asus\.com\//);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);

    const overview = page.getByTestId("product-overview");
    await expect(overview).toContainText("PRIME B860M-A WIFI");
    await expect(overview).toContainText("Summary from");
  });

  test("the summary fetcher refuses private and non-http addresses", async ({ request }) => {
    for (const url of ["http://127.0.0.1:8100/", "http://localhost/", "http://192.168.1.1/", "file:///etc/passwd"]) {
      const res = await request.get(`/api/official-preview?url=${encodeURIComponent(url)}`);
      expect(res.status(), url).toBe(400);
      expect((await res.json()).error, url).toBeTruthy();
    }
  });
});

test.describe("product gallery", () => {
  test("hovering the main image zooms in under the pointer", async ({ page }) => {
    await page.goto("/products/12");
    const frame = page.getByTestId("gallery-frame");
    const box = (await frame.boundingBox())!;
    await expect(page.getByTestId("gallery-zoom")).toHaveCount(0);

    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5);
    const zoom = page.getByTestId("gallery-zoom");
    await expect(zoom).toHaveAttribute("style", /background-position: 25% 50%/);
    // the full-resolution master, not the responsive variant shown on screen
    await expect(zoom).toHaveAttribute("style", /url\("\/products\/msi-geforce-rtx-5070-12g-gaming-trio-oc\.avif"\)/);

    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.2);
    await expect(zoom).toHaveAttribute("style", /background-position: 75% 20%/);

    await page.mouse.move(box.x - 40, box.y - 40);
    await expect(page.getByTestId("gallery-zoom")).toHaveCount(0);
  });
});

test.describe("product images API", () => {
  test("a product cannot point at an image hosted elsewhere", async ({ request }) => {
    const res = await request.put("/api/products/4", { data: { images: ["https://example.com/board.jpg"] } });
    expect(res.status()).toBe(400);
    expect((await res.json()).details.join(" ")).toContain("images must be uploaded");
  });

  test("a product holds at most 12 images", async ({ request }) => {
    const images = (n: number) => Array.from({ length: n }, (_, i) => `/api/images/${i.toString(16).padStart(16, "0")}.avif`);
    const res = await request.put("/api/products/4", { data: { images: images(13) } });
    expect(res.status()).toBe(400);
    expect((await res.json()).details.join(" ")).toContain("at most 12");
  });

  test("uploads are converted to AVIF and non-images are rejected", async ({ request, baseURL }) => {
    test.skip(!isLocal(baseURL), "uploads live on one serverless instance's disk");

    const bad = await request.post("/api/uploads", {
      multipart: { file: { name: "notes.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not really a jpeg") } },
    });
    expect(bad.status()).toBe(400);

    const ok = await request.post("/api/uploads", {
      multipart: { file: { name: "red.png", mimeType: "image/png", buffer: await png("#e11d48") } },
    });
    expect(ok.status()).toBe(201);
    const body = await ok.json();
    expect(body.url).toMatch(/^\/api\/images\/[a-f0-9]{16}\.avif$/);
    expect(body.source.format).toBe("PNG");

    for (const variant of [body.url, body.url.replace(".avif", "@400.avif")]) {
      const img = await request.get(variant);
      expect(img.status(), variant).toBe(200);
      expect(img.headers()["content-type"]).toBe("image/avif");
    }
    expect((await request.get("/api/images/..%2F..%2Fpackage.json")).status()).toBe(404);
  });
});

test.describe("upload cleanup", () => {
  test("uploads a product stops using are deleted, unless another product still uses them", async ({ request, baseURL }) => {
    test.skip(!isLocal(baseURL), "uploads live on one serverless instance's disk");
    const upload = async (color: string) =>
      (await (await request.post("/api/uploads", { multipart: { file: { name: "x.png", mimeType: "image/png", buffer: await png(color) } } })).json()).url as string;
    const [solo, shared] = [await upload("#16a34a"), await upload("#9333ea")];
    const create = async (images: string[]) =>
      (await (await request.post("/api/products", { data: { product_name: `PW cleanup ${Date.now()}`, category_id: 5, price: 1000, stock_quantity: 1, images } })).json()).product.product_id as number;
    const a = await create([solo, shared]);
    const b = await create([shared]);
    const status = async (url: string) => (await request.get(url)).status();

    try {
      // A drops both images: its own upload is deleted (all sizes), the shared one stays for B
      await request.put(`/api/products/${a}`, { data: { images: [] } });
      await expect.poll(() => status(solo)).toBe(404);
      expect(await status(solo.replace(".avif", "@400.avif"))).toBe(404);
      expect(await status(shared)).toBe(200);

      // deleting B, the last product using it, deletes the shared upload too
      await request.delete(`/api/products/${b}`);
      await expect.poll(() => status(shared)).toBe(404);
    } finally {
      await request.delete(`/api/products/${a}`);
      await request.delete(`/api/products/${b}`);
    }
  });
});

test.describe("admin image manager", () => {
  test.use({ storageState: ADMIN_STATE });

  test("upload, reorder and save a gallery", async ({ page, request, baseURL }) => {
    test.skip(!isLocal(baseURL), "uploads live on one serverless instance's disk");

    // a throwaway product, so the seeded catalogue is left untouched
    const name = `PW Gallery Fan ${Date.now().toString(36)}`;
    const created = await request.post("/api/products", {
      data: { product_name: name, category_id: 5, price: 150000, stock_quantity: 5, is_active: true },
    });
    expect(created.status()).toBe(201);
    const { product } = await created.json();

    try {
      await page.goto("/dashboard");
      await page.getByTestId("product-row").filter({ hasText: name }).getByTestId("edit-product").click();
      const edit = page.getByTestId("edit-modal");
      const manager = edit.getByTestId("image-manager");

      await manager.getByTestId("image-input").setInputFiles([
        { name: "IMG_0001.HEIC", mimeType: "image/heic", buffer: Buffer.from("heic") },
        { name: "front.png", mimeType: "image/png", buffer: await png("#16a34a") },
        { name: "back.png", mimeType: "image/png", buffer: await png("#2563eb") },
      ]);

      const status = manager.getByTestId("image-status");
      await expect(status).toContainText("HEIC isn't supported");
      await expect(status).toContainText(/front\.png.*PNG → .* AVIF/);
      await expect(status).toContainText(/back\.png.*PNG → .* AVIF/);
      await expect(manager.getByTestId("image-tile")).toHaveCount(2);

      await manager.getByRole("button", { name: "Make image 2 the primary image" }).click();
      await edit.getByTestId("pf-submit").click();
      await expect(page.getByText(`Saved ${name}`)).toBeVisible();

      const saved = await (await request.get(`/api/products/${product.product_id}`)).json();
      expect(saved.images).toHaveLength(2);

      await page.goto(`/products/${product.product_id}`);
      await expect(page.getByTestId("gallery-thumb")).toHaveCount(2);
      const main = page.getByTestId("gallery-main");
      await expect(main).toHaveAttribute("src", new RegExp(saved.images[0].replace(".avif", "")));
      await page.getByTestId("gallery-thumb").nth(1).click();
      await expect(main).toHaveAttribute("src", new RegExp(saved.images[1].replace(".avif", "")));
    } finally {
      await request.delete(`/api/products/${product.product_id}`);
    }
  });
});
