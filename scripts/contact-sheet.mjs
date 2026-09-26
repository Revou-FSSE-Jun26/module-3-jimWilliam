/**
 * Dev helper: renders every product tile into one PNG so the catalogue imagery can be
 * eyeballed in a single glance after running the fetch/generate scripts.
 *
 *   node scripts/contact-sheet.mjs   ->  docs/contact-sheet.avif
 */
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(join(ROOT, "data", "catalog.json"), "utf8"));

const CELL = 300;
const COLS = 5;
const rows = Math.ceil(catalog.products.length / COLS);

const tiles = [];
for (let i = 0; i < catalog.products.length; i++) {
  const buf = await sharp(join(ROOT, "assets", "products", `${catalog.products[i].slug}.avif`))
    .resize(CELL, CELL, { fit: "contain" })
    .png()
    .toBuffer();
  tiles.push({ input: buf, left: (i % COLS) * CELL, top: Math.floor(i / COLS) * CELL });
}

mkdirSync(join(ROOT, "docs"), { recursive: true });
await sharp({ create: { width: COLS * CELL, height: rows * CELL, channels: 3, background: "#060914" } })
  .composite(tiles)
  .avif({ quality: 60 })
  .toFile(join(ROOT, "docs", "contact-sheet.avif"));

console.log(`  ${catalog.products.length} tiles -> docs/contact-sheet.avif`);
