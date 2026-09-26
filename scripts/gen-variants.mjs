/**
 * Pre-generates smaller AVIF variants of every product tile and hero banner, so next/image can
 * serve a responsive srcset without re-encoding anything at request time.
 *
 * Next's built-in optimizer would otherwise decode each AVIF and encode it again per width -
 * AVIF encoding is very CPU-heavy (a single banner took minutes locally), and on Vercel it
 * would spend Image Optimization quota on files that are already optimised. lib/image-loader.ts
 * maps each requested width onto the nearest variant written here.
 *
 *   products/<slug>.avif       1600px  (the master, from fetch-images / gen-product-art)
 *   products/<slug>@800.avif    800px
 *   products/<slug>@400.avif    400px
 *   banners/<id>.avif          2560px  and  banners/<id>@1280.avif (from gen-banners)
 */
import { readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "assets", "products");
const WIDTHS = [800, 400];

const masters = readdirSync(DIR).filter((f) => f.endsWith(".avif") && !f.includes("@") && !f.includes(".blur."));
let bytes = 0;
for (const f of masters) {
  const base = f.slice(0, -".avif".length);
  for (const w of WIDTHS) {
    const out = await sharp(join(DIR, f)).resize(w, w).avif({ quality: 58, effort: 5 }).toBuffer();
    writeFileSync(join(DIR, `${base}@${w}.avif`), out);
    bytes += out.length;
  }
}
console.log(`  ${masters.length} tiles x ${WIDTHS.length} widths -> ${Math.round(bytes / 1024)} KB of variants`);
