/**
 * Phase 1 - hero slider banners.
 *
 * Product shots are square cutouts and stretch badly at 21:9, so the hero frames are composed
 * here instead: a neon gradient mesh, a perspective grid, and the product tiles inset as
 * floating cards. The left third is deliberately left quiet so HeroSlider can lay headline and
 * CTA over it as real HTML - keeping the copy accessible, translatable and responsive rather
 * than baking text into the image.
 *
 *   node scripts/gen-banners.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "assets", "products");
const OUT = join(ROOT, "assets", "banners");

const W = 2560;
const H = 1080;

const catalog = JSON.parse(readFileSync(join(ROOT, "data", "catalog.json"), "utf8"));
const bySlug = Object.fromEntries(catalog.products.map((p) => [p.slug, p]));

/** Each frame: which products to show, and the two bloom colours behind them. */
const FRAMES = [
  {
    id: "new-arrivals",
    products: ["corsair-icue-link-titan-ii-360-rx-lcd", "corsair-dominator-titanium-rgb-32gb"],
    colors: ["#22d3ee", "#e879f9"],
  },
  {
    id: "rtx-50",
    products: ["msi-geforce-rtx-5070-12g-gaming-trio-oc", "nvidia-geforce-rtx-5060-8gb"],
    colors: ["#22d3ee", "#60a5fa"],
  },
  {
    id: "x3d-gaming",
    products: ["amd-ryzen-7-9850x3d", "msi-mag-b850-tomahawk-wifi"],
    colors: ["#e879f9", "#22d3ee"],
  },
  {
    id: "nvme-speed",
    products: ["samsung-9100-pro-nvme-1tb", "corsair-vengeance-ddr5-16gb"],
    colors: ["#a3e635", "#22d3ee"],
  },
  {
    id: "peripherals",
    products: ["keychron-k8-pro", "logitech-g502-x", "lg-ultragear-27gs60f"],
    colors: ["#c084fc", "#e879f9"],
  },
  {
    id: "build-your-rig",
    products: ["asus-prime-b860m-a-wifi", "corsair-rm650e-650w", "arctic-p12-argb"],
    colors: ["#fbbf24", "#22d3ee"],
  },
];

const backdrop = ([a, b]) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bloomA" cx="72%" cy="34%" r="46%">
      <stop offset="0%" stop-color="${a}" stop-opacity="0.42"/>
      <stop offset="70%" stop-color="${a}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${a}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bloomB" cx="36%" cy="78%" r="44%">
      <stop offset="0%" stop-color="${b}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${b}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#060914" stop-opacity="0.94"/>
      <stop offset="46%" stop-color="#060914" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#060914" stop-opacity="0"/>
    </linearGradient>
    <pattern id="grid" width="96" height="96" patternUnits="userSpaceOnUse">
      <path d="M96 0 L0 0 0 96" fill="none" stroke="#1c2740" stroke-width="2"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${H}" fill="#060914"/>
  <rect width="${W}" height="${H}" fill="url(#grid)" opacity="0.5"/>
  <rect width="${W}" height="${H}" fill="url(#bloomA)"/>
  <rect width="${W}" height="${H}" fill="url(#bloomB)"/>

  <!-- perspective floor: lines converging toward a vanishing point -->
  <g opacity="0.45">
    ${Array.from({ length: 26 }, (_, i) => {
      const x = (i / 25) * W * 2 - W / 2;
      return `<line x1="${x}" y1="${H}" x2="${W * 0.62}" y2="${H * 0.52}" stroke="${a}" stroke-width="1.6" opacity="${0.5 - i * 0.012}"/>`;
    }).join("")}
    ${Array.from({ length: 9 }, (_, i) => {
      const t = (i + 1) / 10;
      const y = H * 0.52 + (H - H * 0.52) * t * t;
      return `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${a}" stroke-width="1.6" opacity="${0.12 + t * 0.3}"/>`;
    }).join("")}
  </g>

  <!-- keeps the left third quiet for the HTML headline overlay -->
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
</svg>`);

const roundedMask = (w, h, r) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);

const cardFrame = (w, h, r, accent) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="${r}" ry="${r}"
          fill="none" stroke="${accent}" stroke-width="3" opacity="0.75"/>
  </svg>`);

mkdirSync(OUT, { recursive: true });
const index = [];

for (const frame of FRAMES) {
  const n = frame.products.length;
  const card = n === 3 ? 470 : 560;
  const gap = 56;
  const totalW = n * card + (n - 1) * gap;
  const startX = Math.round(W - 150 - totalW);
  const baseY = Math.round((H - card) / 2);

  const layers = [];
  for (let i = 0; i < n; i++) {
    const slug = frame.products[i];
    const accent = frame.colors[i % frame.colors.length];
    // stagger the cards vertically so the row does not read as a flat strip
    const lift = i % 2 === 0 ? -34 : 34;

    const tile = await sharp(join(SRC, `${slug}.avif`))
      .resize(card, card)
      .composite([{ input: roundedMask(card, card, 40), blend: "dest-in" }])
      .png()
      .toBuffer();

    // soft accent glow behind each card
    const glow = await sharp(tile).resize(card + 90, card + 90, { fit: "fill" }).blur(36).png().toBuffer();

    layers.push({ input: glow, left: startX + i * (card + gap) - 45, top: baseY + lift - 45, blend: "screen" });
    layers.push({ input: tile, left: startX + i * (card + gap), top: baseY + lift });
    layers.push({
      input: cardFrame(card, card, 40, accent),
      left: startX + i * (card + gap),
      top: baseY + lift,
    });
  }

  const full = await sharp(backdrop(frame.colors)).composite(layers).avif({ quality: 56, effort: 6 }).toBuffer();
  const small = await sharp(full).resize(1280, 540).avif({ quality: 54, effort: 6 }).toBuffer();

  writeFileSync(join(OUT, `${frame.id}.avif`), full);
  writeFileSync(join(OUT, `${frame.id}@1280.avif`), small);

  index.push({
    id: frame.id,
    products: frame.products.map((s) => ({ slug: s, product_id: bySlug[s]?.product_id ?? null })),
    colors: frame.colors,
    full: `${frame.id}.avif`,
    small: `${frame.id}@1280.avif`,
    bytes: full.length,
  });
  console.log(`  ${frame.id.padEnd(18)} ${Math.round(full.length / 1024)} KB  +  ${Math.round(small.length / 1024)} KB`);
}

writeFileSync(join(OUT, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(`\n  ${index.length} hero frames -> assets/banners/`);
