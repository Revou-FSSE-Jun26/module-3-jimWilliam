import { expect, test } from "./fixtures";
import { ADMIN_STATE } from "./global-setup";

/** A spec grid as a browser puts it on the clipboard when the admin copies it from a page. */
const COPIED_HTML = `<meta charset="utf-8"><div>
  <h3>Performance</h3>
  <div><div>Fan Speed</div><div>200 - 2000 rpm<br>PWM controlled</div></div>
  <div><div>Airflow</div><div>48.8 cfm</div></div>
  <h3>Physical</h3>
  <div><div>Size</div><div>120 x 120 x 25 mm</div></div>
</div>`;

test.describe("technical specifications", () => {
  test("the product page shows the grouped spec table with its source", async ({ page }) => {
    await page.goto("/products/11"); // RTX 5060: specs seeded from nvidia.com's comparison table
    const section = page.getByTestId("tech-specs");
    await expect(section.getByRole("heading", { name: "Technical specifications" })).toBeVisible();
    await expect(section.getByTestId("specs-source")).toHaveAttribute("href", /nvidia\.com/);
    // the comparison table's RTX 5060 column, not the 5060 Ti's
    await expect(section.getByRole("row", { name: /CUDA/ })).toContainText("3840");

    const rows = section.getByTestId("spec-row");
    const collapsed = await rows.count();
    await section.getByTestId("spec-toggle").click();
    await expect(section.getByTestId("spec-toggle")).toHaveText("Show fewer");
    expect(await rows.count()).toBeGreaterThan(collapsed);
  });

  test("pasted HTML is turned into grouped rows", async ({ request }) => {
    const res = await request.post("/api/official-specs", { data: { html: COPIED_HTML, name: "Arctic P12" } });
    expect(res.status()).toBe(200);
    expect((await res.json()).specs).toEqual([
      { group: "Performance", label: "Fan Speed", value: "200 - 2000 rpm, PWM controlled" },
      { group: "Performance", label: "Airflow", value: "48.8 cfm" },
      { group: "Physical", label: "Size", value: "120 x 120 x 25 mm" },
    ]);
  });

  test("the spec fetcher refuses private addresses, and bad rows are rejected", async ({ request }) => {
    const res = await request.get(`/api/official-specs?url=${encodeURIComponent("http://127.0.0.1:8100/")}`);
    expect(res.status()).toBe(400);

    const put = await request.put("/api/products/4", { data: { specs: [{ label: "", value: "x" }] } });
    expect(put.status()).toBe(400);
    expect((await put.json()).details.join(" ")).toContain("specs row 1");
  });
});

test.describe("admin specifications editor", () => {
  test.use({ storageState: ADMIN_STATE });

  test("paste a spec table, edit a row and save", async ({ page, request, baseURL }) => {
    test.skip(!/localhost|127\.0\.0\.1/.test(baseURL ?? ""), "the saved product is read back from the same in-memory store");

    const name = `PW Spec Fan ${Date.now().toString(36)}`;
    const created = await request.post("/api/products", {
      data: { product_name: name, category_id: 5, price: 150000, stock_quantity: 5, official_url: "https://www.arctic.de/en/P12-PWM-PST-A-RGB" },
    });
    const { product } = await created.json();

    try {
      await page.goto("/dashboard");
      await page.getByTestId("product-row").filter({ hasText: name }).getByTestId("edit-product").click();
      const editor = page.getByTestId("edit-modal").getByTestId("specs-editor");
      await expect(editor.getByTestId("pf-specs-count")).toHaveText("0/150");

      // what Ctrl V delivers: HTML plus plain text
      await editor.getByTestId("pf-specs-paste").evaluate((el, html) => {
        const data = new DataTransfer();
        data.setData("text/html", html);
        data.setData("text/plain", "Fan Speed\n200 - 2000 rpm");
        el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
      }, COPIED_HTML);
      await expect(editor.getByTestId("pf-specs-count")).toHaveText("3/150");
      await expect(editor.getByTestId("pf-specs-note")).toContainText("3 rows from the pasted table");

      await editor.getByRole("button", { name: "Remove Airflow" }).click();
      await editor.getByLabel("Value 2").fill("120 x 120 x 25 mm, 159 g");
      await page.getByTestId("edit-modal").getByTestId("pf-submit").click();
      await expect(page.getByText(`Saved ${name}`)).toBeVisible();

      const saved = await (await request.get(`/api/products/${product.product_id}`)).json();
      expect(saved.specs).toHaveLength(2);
      expect(saved.specs_source).toBe("https://www.arctic.de/en/P12-PWM-PST-A-RGB");

      await page.goto(`/products/${product.product_id}`);
      const section = page.getByTestId("tech-specs");
      await expect(section.getByTestId("spec-row")).toHaveCount(2);
      await expect(section.getByRole("row", { name: /Size/ })).toContainText("159 g");
      await expect(section.getByTestId("specs-source")).toHaveAttribute("href", /arctic\.de/);
    } finally {
      await request.delete(`/api/products/${product.product_id}`);
    }
  });

  test("plain 'Label: value' text becomes rows", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("new-product").click();
    const editor = page.getByTestId("create-modal").getByTestId("specs-editor");
    await editor.getByTestId("pf-specs-paste").fill("Warranty: 6 years\nConnector: 4-pin PWM\nBearing: Fluid dynamic");
    await editor.getByTestId("pf-specs-parse").click();
    await expect(editor.getByTestId("pf-specs-count")).toHaveText("3/150");
    await expect(editor.getByLabel("Label 2")).toHaveValue("Connector");
  });
});
