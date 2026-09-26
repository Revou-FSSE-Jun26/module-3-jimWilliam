/**
 * Phase 1 - generated product art.
 *
 * Fallback for products whose manufacturer image could not be sourced (Kingston and Seagate
 * block automated requests outright; a few others serve only marketing composites). The art
 * is deliberately rendered in brushed-metal greys with a single accent edge light rather than
 * flat neon line art, so a generated tile sits next to a real product photo without clashing.
 *
 *   node scripts/gen-product-art.mjs                 every product missing a manufacturer image
 *   node scripts/gen-product-art.mjs --only=slug     just these
 *   node scripts/gen-product-art.mjs --all           regenerate art for every product
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "assets", "products");
const MANIFEST = join(OUT_DIR, "manifest.json");
const SIZE = 1600;

const ACCENT = {
  1: "#22d3ee", // Processors
  2: "#e879f9", // Motherboards
  3: "#a3e635", // Memory and Storage
  4: "#60a5fa", // Graphics Cards
  5: "#fbbf24", // Power and Cooling
  6: "#c084fc", // Peripherals
};

// brushed-metal ramp, so generated tiles read as hardware rather than as icons
const METAL = { dark: "#151c2b", body: "#2b3446", mid: "#3f4a60", light: "#7a879c", hi: "#c3cddb" };

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",").filter(Boolean);
const all = args.includes("--all");

const catalog = JSON.parse(readFileSync(join(ROOT, "data", "catalog.json"), "utf8"));
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};

/* ------------------------------------------------------------------ shapes */

const screws = (x, y, w, h, r = 12) =>
  [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]
    .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${METAL.dark}" stroke="${METAL.light}" stroke-width="3"/>`)
    .join("");

const repeat = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join("");

const SHAPES = {
  cpu: (a) => `
    <rect x="460" y="460" width="680" height="680" rx="28" fill="${METAL.body}" stroke="${METAL.hi}" stroke-width="6"/>
    <rect x="530" y="530" width="540" height="540" rx="14" fill="${METAL.mid}" stroke="${a}" stroke-width="5"/>
    <rect x="596" y="596" width="408" height="408" rx="8" fill="${METAL.light}" opacity="0.5"/>
    ${repeat(6, (i) => `<rect x="${620 + i * 64}" y="640" width="40" height="320" rx="4" fill="${METAL.dark}" opacity="0.55"/>`)}
    <path d="M492 1108 l0 -44 44 44 z" fill="${a}"/>
    ${repeat(16, (i) => `<rect x="${478 + i * 41}" y="1160" width="26" height="14" rx="4" fill="${a}" opacity="0.45"/>`)}
    ${repeat(16, (i) => `<rect x="${478 + i * 41}" y="424" width="26" height="14" rx="4" fill="${a}" opacity="0.45"/>`)}`,

  motherboard: (a) => `
    <rect x="330" y="250" width="940" height="1100" rx="24" fill="${METAL.body}" stroke="${a}" stroke-width="5"/>
    ${screws(374, 296, 852, 1008)}
    <rect x="620" y="330" width="330" height="330" rx="14" fill="${METAL.mid}" stroke="${METAL.hi}" stroke-width="5"/>
    <rect x="676" y="386" width="218" height="218" rx="8" fill="${METAL.light}" opacity="0.55"/>
    ${repeat(4, (i) => `<rect x="${1000 + i * 58}" y="330" width="34" height="520" rx="8" fill="${METAL.dark}" stroke="${a}" stroke-width="3"/>`)}
    ${repeat(2, (i) => `<rect x="400" y="${900 + i * 130}" width="620" height="46" rx="10" fill="${METAL.dark}" stroke="${METAL.light}" stroke-width="3"/>`)}
    <rect x="400" y="700" width="480" height="26" rx="8" fill="${a}" opacity="0.5"/>
    <rect x="1040" y="940" width="190" height="190" rx="12" fill="${METAL.mid}" stroke="${METAL.hi}" stroke-width="4"/>
    <rect x="370" y="300" width="200" height="150" rx="10" fill="${METAL.dark}" stroke="${METAL.light}" stroke-width="4"/>`,

  ram: (a) => `
    ${repeat(2, (i) => `
      <g transform="translate(${i * 120}, ${i * -150})">
        <rect x="270" y="700" width="1060" height="230" rx="12" fill="${METAL.body}" stroke="${METAL.hi}" stroke-width="5"/>
        ${repeat(22, (j) => `<path d="M${300 + j * 46} 700 l24 -78 l24 78 z" fill="${METAL.mid}" stroke="${a}" stroke-width="2"/>`)}
        <rect x="320" y="770" width="960" height="70" rx="8" fill="${METAL.mid}" opacity="0.8"/>
        <rect x="320" y="786" width="960" height="14" rx="7" fill="${a}" opacity="0.65"/>
        ${repeat(34, (j) => `<rect x="${296 + j * 30}" y="930" width="18" height="26" fill="${METAL.light}" opacity="0.7"/>`)}
        <rect x="690" y="930" width="26" height="30" fill="${METAL.dark}"/>
      </g>`)}`,

  ssd: (a) => `
    <rect x="240" y="690" width="1120" height="220" rx="14" fill="${METAL.body}" stroke="${METAL.hi}" stroke-width="5"/>
    ${repeat(3, (i) => `<rect x="${330 + i * 300}" y="740" width="230" height="120" rx="8" fill="${METAL.mid}" stroke="${a}" stroke-width="3"/>`)}
    <rect x="1240" y="740" width="90" height="120" rx="8" fill="${METAL.dark}" stroke="${METAL.light}" stroke-width="3"/>
    ${repeat(20, (i) => `<rect x="${262 + i * 22}" y="880" width="12" height="30" fill="${a}" opacity="0.6"/>`)}
    <circle cx="1310" cy="800" r="22" fill="none" stroke="${METAL.light}" stroke-width="5"/>`,

  hdd: (a) => `
    <rect x="330" y="450" width="940" height="700" rx="18" fill="${METAL.body}" stroke="${METAL.hi}" stroke-width="6"/>
    ${screws(378, 498, 844, 604, 14)}
    <circle cx="800" cy="800" r="270" fill="${METAL.mid}" stroke="${a}" stroke-width="5"/>
    <circle cx="800" cy="800" r="180" fill="${METAL.dark}" opacity="0.6"/>
    <circle cx="800" cy="800" r="54" fill="${METAL.light}"/>
    <circle cx="800" cy="800" r="20" fill="${METAL.dark}"/>
    <path d="M1180 560 L1150 760 L860 800" fill="none" stroke="${METAL.light}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="1180" cy="560" r="46" fill="${METAL.mid}" stroke="${METAL.hi}" stroke-width="4"/>
    <rect x="360" y="480" width="360" height="90" rx="10" fill="${METAL.dark}" opacity="0.8"/>
    <rect x="388" y="508" width="200" height="14" rx="7" fill="${a}" opacity="0.55"/>`,

  gpu: (a) => `
    <rect x="200" y="560" width="1200" height="520" rx="22" fill="${METAL.body}" stroke="${METAL.hi}" stroke-width="6"/>
    <rect x="200" y="560" width="1200" height="60" rx="18" fill="${METAL.mid}"/>
    ${repeat(2, (i) => `
      <circle cx="${520 + i * 440}" cy="830" r="190" fill="${METAL.dark}" stroke="${a}" stroke-width="5"/>
      <circle cx="${520 + i * 440}" cy="830" r="62" fill="${METAL.mid}" stroke="${METAL.light}" stroke-width="4"/>
      ${repeat(9, (j) => `<path d="M${520 + i * 440} ${830 - 62} q 70 -40 120 40" transform="rotate(${j * 40} ${520 + i * 440} 830)" fill="none" stroke="${METAL.light}" stroke-width="10" opacity="0.65"/>`)}`)}
    <rect x="150" y="520" width="56" height="600" rx="10" fill="${METAL.mid}" stroke="${METAL.hi}" stroke-width="4"/>
    ${repeat(12, (i) => `<rect x="${330 + i * 62}" y="1080" width="40" height="46" rx="4" fill="${a}" opacity="0.55"/>`)}
    <rect x="1150" y="500" width="150" height="60" rx="10" fill="${METAL.dark}" stroke="${a}" stroke-width="4"/>`,

  psu: (a) => `
    <rect x="300" y="520" width="1000" height="620" rx="20" fill="${METAL.body}" stroke="${METAL.hi}" stroke-width="6"/>
    ${screws(348, 568, 904, 524, 13)}
    <circle cx="800" cy="830" r="250" fill="${METAL.dark}" stroke="${a}" stroke-width="5"/>
    ${repeat(18, (i) => `<line x1="800" y1="830" x2="${800 + 250 * Math.cos((i * Math.PI) / 9)}" y2="${830 + 250 * Math.sin((i * Math.PI) / 9)}" stroke="${METAL.light}" stroke-width="7" opacity="0.5"/>`)}
    <circle cx="800" cy="830" r="250" fill="none" stroke="${METAL.light}" stroke-width="6" opacity="0.7"/>
    <circle cx="800" cy="830" r="150" fill="none" stroke="${METAL.light}" stroke-width="5" opacity="0.5"/>
    <circle cx="800" cy="830" r="70" fill="${METAL.mid}" stroke="${a}" stroke-width="4"/>
    <rect x="330" y="560" width="230" height="70" rx="10" fill="${METAL.dark}"/>
    <rect x="358" y="586" width="140" height="16" rx="8" fill="${a}" opacity="0.6"/>`,

  cooler: (a) => `
    ${repeat(16, (i) => `<rect x="440" y="${330 + i * 34}" width="720" height="18" rx="4" fill="${METAL.mid}" stroke="${METAL.light}" stroke-width="2" opacity="0.9"/>`)}
    ${repeat(4, (i) => `<circle cx="${560 + i * 160}" cy="322" r="26" fill="${METAL.light}" stroke="${METAL.hi}" stroke-width="4"/>`)}
    <rect x="400" y="900" width="800" height="380" rx="16" fill="${METAL.body}" stroke="${a}" stroke-width="5"/>
    <circle cx="800" cy="1090" r="165" fill="${METAL.dark}" stroke="${METAL.light}" stroke-width="5"/>
    ${repeat(9, (i) => `<path d="M800 925 q 78 46 128 128" transform="rotate(${i * 40} 800 1090)" fill="none" stroke="${METAL.light}" stroke-width="12" opacity="0.6"/>`)}
    <circle cx="800" cy="1090" r="58" fill="${METAL.mid}" stroke="${a}" stroke-width="4"/>
    <rect x="470" y="1290" width="660" height="40" rx="10" fill="${METAL.mid}" stroke="${METAL.hi}" stroke-width="4"/>`,

  fan: (a) => `
    <rect x="300" y="300" width="1000" height="1000" rx="60" fill="${METAL.body}" stroke="${METAL.hi}" stroke-width="6"/>
    ${screws(370, 370, 860, 860, 22)}
    <circle cx="800" cy="800" r="440" fill="${METAL.dark}"/>
    <circle cx="800" cy="800" r="440" fill="none" stroke="${a}" stroke-width="14" opacity="0.85"/>
    ${repeat(7, (i) => `<path d="M800 800 q 210 -150 400 -40 q -150 210 -400 40 z" transform="rotate(${i * 51.4} 800 800)" fill="${METAL.mid}" stroke="${METAL.light}" stroke-width="5" opacity="0.92"/>`)}
    <circle cx="800" cy="800" r="150" fill="${METAL.body}" stroke="${METAL.hi}" stroke-width="5"/>
    <circle cx="800" cy="800" r="92" fill="${METAL.mid}" stroke="${a}" stroke-width="4"/>`,

  paste: (a) => `
    <g transform="rotate(-18 800 800)">
      <rect x="420" y="700" width="700" height="210" rx="42" fill="${METAL.body}" stroke="${METAL.hi}" stroke-width="6"/>
      <rect x="470" y="745" width="470" height="120" rx="20" fill="${METAL.mid}" opacity="0.85"/>
      <rect x="500" y="782" width="330" height="18" rx="9" fill="${a}" opacity="0.7"/>
      <path d="M1120 745 l120 40 l0 40 l-120 40 z" fill="${METAL.mid}" stroke="${METAL.hi}" stroke-width="5"/>
      <rect x="1240" y="770" width="90" height="70" rx="14" fill="${METAL.light}" stroke="${METAL.hi}" stroke-width="4"/>
      <rect x="330" y="730" width="95" height="150" rx="18" fill="${METAL.light}" stroke="${METAL.hi}" stroke-width="5"/>
      <rect x="250" y="768" width="86" height="74" rx="14" fill="${METAL.mid}" stroke="${METAL.hi}" stroke-width="4"/>
    </g>
    <ellipse cx="1180" cy="1060" rx="120" ry="52" fill="${METAL.hi}" opacity="0.55"/>
    <ellipse cx="1180" cy="1050" rx="78" ry="32" fill="${a}" opacity="0.35"/>`,

  mouse: (a) => `
    <path d="M800 330 C1010 330 1130 470 1130 700 L1130 1030 C1130 1240 990 1330 800 1330
             C610 1330 470 1240 470 1030 L470 700 C470 470 590 330 800 330 Z"
          fill="${METAL.body}" stroke="${METAL.hi}" stroke-width="7"/>
    <path d="M800 330 C700 330 620 400 580 500 L780 560 L780 330 Z" fill="${METAL.mid}" opacity="0.85"/>
    <line x1="800" y1="340" x2="800" y2="620" stroke="${METAL.hi}" stroke-width="6"/>
    <rect x="762" y="430" width="76" height="150" rx="38" fill="${METAL.mid}" stroke="${a}" stroke-width="5"/>
    <rect x="470" y="700" width="70" height="170" rx="20" fill="${METAL.mid}" stroke="${METAL.light}" stroke-width="4"/>
    <rect x="470" y="890" width="70" height="120" rx="20" fill="${METAL.mid}" stroke="${METAL.light}" stroke-width="4"/>
    <ellipse cx="800" cy="1180" rx="150" ry="60" fill="${a}" opacity="0.25"/>
    <path d="M800 330 C760 250 780 190 800 140" fill="none" stroke="${METAL.light}" stroke-width="12" stroke-linecap="round"/>`,

  keyboard: (a) => `
    <rect x="180" y="560" width="1240" height="480" rx="30" fill="${METAL.body}" stroke="${METAL.hi}" stroke-width="6"/>
    <rect x="220" y="600" width="1160" height="400" rx="16" fill="${METAL.dark}" opacity="0.6"/>
    ${repeat(5, (row) =>
      repeat(row === 4 ? 8 : 14, (col) => {
        const w = row === 4 && col === 3 ? 260 : 70;
        const x = 250 + col * 80 + (row === 4 && col > 3 ? 190 : 0);
        return `<rect x="${x}" y="${630 + row * 76}" width="${w}" height="64" rx="10" fill="${METAL.mid}" stroke="${METAL.light}" stroke-width="3"/>`;
      })
    )}
    <rect x="250" y="630" width="70" height="64" rx="10" fill="${a}" opacity="0.6"/>
    <rect x="1250" y="934" width="70" height="64" rx="10" fill="${a}" opacity="0.6"/>
    <rect x="180" y="1030" width="1240" height="26" rx="13" fill="${a}" opacity="0.3"/>`,

  monitor: (a) => `
    <rect x="240" y="330" width="1120" height="700" rx="22" fill="${METAL.body}" stroke="${METAL.hi}" stroke-width="7"/>
    <rect x="288" y="378" width="1024" height="590" rx="10" fill="${METAL.dark}"/>
    <rect x="288" y="378" width="1024" height="590" rx="10" fill="${a}" opacity="0.18"/>
    ${repeat(5, (i) => `<rect x="${330 + i * 200}" y="${430 + (i % 2) * 120}" width="150" height="${260 - (i % 3) * 60}" rx="10" fill="${a}" opacity="${0.12 + (i % 3) * 0.06}"/>`)}
    <rect x="700" y="1030" width="200" height="150" rx="10" fill="${METAL.mid}" stroke="${METAL.hi}" stroke-width="5"/>
    <path d="M540 1290 L1060 1290 L1000 1200 L600 1200 Z" fill="${METAL.mid}" stroke="${METAL.hi}" stroke-width="5"/>
    <rect x="760" y="990" width="80" height="16" rx="8" fill="${a}" opacity="0.7"/>`,
};

/* ------------------------------------------------------------------ render */

function tileSvg(kind, accent, seed) {
  const art = (SHAPES[kind] || SHAPES.cpu)(accent);
  const rot = ((seed % 5) - 2) * 1.2; // tiny per-product variation so no two tiles are identical
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <radialGradient id="glow" cx="50%" cy="46%" r="52%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.30"/>
        <stop offset="60%" stop-color="${accent}" stop-opacity="0.07"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
      <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
        <path d="M80 0 L0 0 0 80" fill="none" stroke="#1c2740" stroke-width="2"/>
      </pattern>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="#0d1425"/>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#grid)" opacity="0.55"/>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#glow)"/>
    <g transform="rotate(${rot} ${SIZE / 2} ${SIZE / 2})">${art}</g>
  </svg>`;
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = catalog.products.filter((p) => {
  if (only) return only.includes(p.slug);
  if (all) return true;
  return manifest[p.slug]?.origin !== "manufacturer";
});

/*
 * Category fallbacks: products created later from the admin dashboard have no photo, so the
 * storefront shows the art for their category instead (category-<id>.avif).
 */
if (args.includes("--categories")) {
  const REP_KIND = { 1: "cpu", 2: "motherboard", 3: "ram", 4: "gpu", 5: "psu", 6: "keyboard" };
  for (const c of catalog.categories) {
    const accent = ACCENT[c.category_id] || "#22d3ee";
    const kind = REP_KIND[c.category_id] || "cpu";
    const tile = await sharp(Buffer.from(tileSvg(kind, accent, c.category_id + 40))).avif({ quality: 62, effort: 6 }).toBuffer();
    const blur = await sharp(tile).resize(32, 32, { fit: "cover" }).blur(4).avif({ quality: 40 }).toBuffer();
    writeFileSync(join(OUT_DIR, `category-${c.category_id}.avif`), tile);
    writeFileSync(join(OUT_DIR, `category-${c.category_id}.blur.avif`), blur);
    manifest[`category-${c.category_id}`] = {
      origin: "generated",
      kind,
      accent,
      tile: `${SIZE}x${SIZE}`,
      bytes: tile.length,
      blurDataURL: `data:image/avif;base64,${blur.toString("base64")}`,
    };
    console.log(`  category-${c.category_id}  ${c.category_name.padEnd(20)} ${kind}`);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  process.exit(0);
}

if (!targets.length) {
  console.log("  nothing to generate - every product has a manufacturer image");
  process.exit(0);
}

for (const p of targets) {
  const accent = ACCENT[p.category_id] || "#22d3ee";
  const svg = Buffer.from(tileSvg(p.kind, accent, p.product_id));
  const tile = await sharp(svg).avif({ quality: 62, effort: 6 }).toBuffer();
  const blur = await sharp(tile).resize(32, 32, { fit: "cover" }).blur(4).avif({ quality: 40 }).toBuffer();

  writeFileSync(join(OUT_DIR, `${p.slug}.avif`), tile);
  writeFileSync(join(OUT_DIR, `${p.slug}.blur.avif`), blur);
  manifest[p.slug] = {
    origin: "generated",
    kind: p.kind,
    accent,
    tile: `${SIZE}x${SIZE}`,
    bytes: tile.length,
    blurDataURL: `data:image/avif;base64,${blur.toString("base64")}`,
  };
  console.log(`  ${p.slug.padEnd(32)} generated ${p.kind.padEnd(12)} ${Math.round(tile.length / 1024)} KB`);
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

const fromVendor = Object.values(manifest).filter((m) => m.origin === "manufacturer").length;
const generated = Object.values(manifest).filter((m) => m.origin === "generated").length;
console.log(`\n  manufacturer photos: ${fromVendor}   generated art: ${generated}`);
