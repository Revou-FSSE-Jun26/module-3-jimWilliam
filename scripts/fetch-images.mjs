/**
 * Phase 1 - product imagery.
 *
 * For each product in data/catalog.json, visit the manufacturer product pages listed in
 * scripts/image-sources.json, pull the best product shot the page advertises (og:image,
 * JSON-LD, or the largest srcset candidate), upgrade the URL to the highest resolution the
 * CDN will serve, then normalise it onto a square tile and encode AVIF.
 *
 * Anything that cannot be sourced cleanly is left for gen-banners.mjs to render instead and
 * is reported at the end, so the README can say exactly which products used a fallback.
 *
 *   node scripts/fetch-images.mjs                  all products
 *   node scripts/fetch-images.mjs --only=slug,slug just these
 *   node scripts/fetch-images.mjs --force          re-fetch even if the AVIF already exists
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { TILE, toTile } from "./lib/tile.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "assets", "products");
const MANIFEST = join(OUT_DIR, "manifest.json");

const MIN_SOURCE_PX = 320; // anything smaller is not a usable product shot

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",").filter(Boolean);
const force = args.includes("--force");

const catalog = JSON.parse(readFileSync(join(ROOT, "data", "catalog.json"), "utf8"));
const { sources } = JSON.parse(readFileSync(join(ROOT, "scripts", "image-sources.json"), "utf8"));

/* ------------------------------------------------------------------ discovery */

function absolutise(url, base) {
  try {
    return new URL(url.replace(/&amp;/g, "&").trim(), base).href;
  } catch {
    return null;
  }
}

/** Ask each CDN for the biggest version it will serve rather than the thumbnail the page used. */
function upgradeResolution(url) {
  // Cloudinary (Corsair): c_scale,q_auto,w_96 -> q_auto,w_1600
  if (/\/image\/upload\//.test(url)) {
    return url.replace(/\/image\/upload\/[^/]*\//, "/image/upload/q_auto,w_1600/");
  }
  // Shopify (Keychron and friends): strip _600x600 suffixes, then request a width
  if (/cdn\/shop\//.test(url)) {
    const clean = url.split("?")[0].replace(/_(\d+x\d*|\d*x\d+)(?=\.[a-z]+$)/i, "");
    return `${clean}?width=1600`;
  }
  // Scene7 (some vendors)
  if (/\/is\/image\//.test(url)) return `${url.split("?")[0]}?wid=1600&fmt=png-alpha`;
  // Generic ?width= / ?w= query params
  return url.replace(/([?&])(w|wid|width)=\d+/gi, "$1$2=1600");
}

/**
 * Distinctive tokens from a slug - model numbers mostly. A candidate URL containing one of
 * these is almost certainly the real product shot, whereas og:image is usually a social card
 * (a brand logo, a lifestyle photo, or a marketing banner for the whole product family).
 */
function modelTokens(slug) {
  // Brand and family words match far too much (ASUS serves one "geforce-rtx-50.png" for every
  // card it makes), so prefer model numbers and only fall back to words when there are none.
  const BRAND = new Set([
    "intel", "amd", "nvidia", "asus", "msi", "gigabyte", "corsair", "kingston", "samsung",
    "seagate", "logitech", "keychron", "arctic", "deepcool", "thermal", "geforce", "radeon",
    "ryzen", "core", "ultra", "prime", "series", "gaming", "desktop", "plus", "pro",
  ]);
  const parts = slug.split("-").filter((t) => t.length >= 2 && !BRAND.has(t));
  const numeric = parts.filter((t) => /\d/.test(t) && t.length >= 4);
  return numeric.length ? numeric : parts.filter((t) => t.length >= 5);
}

function pickFromHtml(html, baseUrl, tokens = []) {
  const candidates = [];

  const meta = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,
  ];
  for (const re of meta) {
    for (const m of html.matchAll(re)) candidates.push({ url: m[1], score: 1000 });
  }

  // JSON-LD "image": "..." or "image": ["...", ...]
  for (const m of html.matchAll(/"image"\s*:\s*(\[[^\]]*\]|"[^"]+")/gi)) {
    const raw = m[1];
    const urls = raw.startsWith("[") ? [...raw.matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [raw.slice(1, -1)];
    for (const u of urls) candidates.push({ url: u, score: 900 });
  }

  // srcset entries, scored by their declared width
  for (const m of html.matchAll(/srcset=["']([^"']+)["']/gi)) {
    for (const part of m[1].split(",")) {
      const [u, w] = part.trim().split(/\s+/);
      const width = w && w.endsWith("w") ? parseInt(w) : 0;
      if (u) candidates.push({ url: u, score: width });
    }
  }

  // lazy-loaded images - plenty of vendor pages never put a real src in the markup
  for (const m of html.matchAll(/data-(?:src|original|lazy|image)=["']([^"']+)["']/gi)) {
    candidates.push({ url: m[1], score: 400 });
  }
  for (const m of html.matchAll(/data-srcset=["']([^"']+)["']/gi)) {
    for (const part of m[1].split(",")) {
      const [u, w] = part.trim().split(/\s+/);
      const width = w && w.endsWith("w") ? parseInt(w) : 0;
      if (u) candidates.push({ url: u, score: width });
    }
  }
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) candidates.push({ url: m[1], score: 150 });

  // Do NOT require a file extension: many CDNs serve images from extensionless,
  // transform-style URLs. getBuffer() checks the content-type, so a wrong guess is cheap.
  const seen = new Set();
  return candidates
    .map((c) => ({ ...c, url: absolutise(c.url, baseUrl) }))
    .filter((c) => c.url && !/\.(svg|gif|js|css|json|woff2?|mp4|webm)(\?|$)/i.test(c.url))
    .filter((c) => !/(logo|icon|sprite|placeholder|badge|favicon|spinner|loader|flag|arrow|thumb_|avatar)/i.test(c.url))
    .filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)))
    .map((c) => {
      const u = c.url.toLowerCase();
      const hits = tokens.filter((t) => u.includes(t)).length;
      // a model-number match beats anything og:image can offer
      return { ...c, score: c.score + hits * 2500 };
    })
    .sort((a, b) => b.score - a.score);
}

async function getBuffer(url) {
  const r = await fetch(url, {
    headers: { "user-agent": UA, accept: "image/avif,image/webp,image/*,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const type = r.headers.get("content-type") || "";
  if (!type.startsWith("image/")) throw new Error(`not an image (${type})`);
  return Buffer.from(await r.arrayBuffer());
}

async function discover(slug) {
  const pages = sources[slug] || [];
  const tried = [];
  for (const page of pages) {
    let html;
    try {
      const r = await fetch(page, {
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) {
        tried.push(`${new URL(page).host} HTTP ${r.status}`);
        continue;
      }
      html = await r.text();
    } catch (e) {
      tried.push(`${new URL(page).host} ${e.message}`);
      continue;
    }

    for (const cand of pickFromHtml(html, page, modelTokens(slug)).slice(0, 12)) {
      const target = upgradeResolution(cand.url);
      try {
        const buf = await getBuffer(target);
        const meta = await sharp(buf).metadata();
        const w = meta.width || 0;
        const h = meta.height || 0;
        if (Math.max(w, h) < MIN_SOURCE_PX || Math.min(w, h) < 200) {
          tried.push(`too small ${w}x${h}`);
          continue;
        }
        // Banner strips and hero ribbons are never product shots.
        const ratio = Math.max(w, h) / Math.min(w, h);
        if (ratio > 2.6) {
          tried.push(`bad aspect ${w}x${h}`);
          continue;
        }
        return { buf, meta, imageUrl: target, pageUrl: page, tried };
      } catch (e) {
        tried.push(`${e.message}`);
      }
    }
  }
  return { buf: null, tried };
}

/* ------------------------------------------------------------------ processing */

/* ------------------------------------------------------------------ main */

mkdirSync(OUT_DIR, { recursive: true });
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};

const targets = catalog.products.filter((p) => (only ? only.includes(p.slug) : true));
const results = [];

for (const p of targets) {
  const outFile = join(OUT_DIR, `${p.slug}.avif`);
  if (!force && existsSync(outFile) && manifest[p.slug]?.origin === "manufacturer") {
    results.push({ slug: p.slug, status: "cached" });
    continue;
  }

  process.stdout.write(`  ${p.slug.padEnd(32)} `);
  const { buf, meta, imageUrl, pageUrl, tried } = await discover(p.slug);

  if (!buf) {
    results.push({ slug: p.slug, status: "no-source", tried: tried.slice(0, 3) });
    console.log("no usable source");
    continue;
  }

  try {
    const { tile, blur, keyed } = await toTile(buf);
    writeFileSync(outFile, tile);
    writeFileSync(join(OUT_DIR, `${p.slug}.blur.avif`), blur);
    manifest[p.slug] = {
      origin: "manufacturer",
      pageUrl,
      imageUrl,
      sourceSize: `${meta.width}x${meta.height}`,
      tile: `${TILE}x${TILE}`,
      bytes: tile.length,
      whiteKeyed: keyed,
      blurDataURL: `data:image/avif;base64,${blur.toString("base64")}`,
    };
    results.push({ slug: p.slug, status: "ok", from: `${meta.width}x${meta.height}`, kb: Math.round(tile.length / 1024) });
    console.log(`ok  ${meta.width}x${meta.height} -> ${Math.round(tile.length / 1024)} KB${keyed ? "  (white keyed)" : ""}`);
  } catch (e) {
    results.push({ slug: p.slug, status: "process-failed", error: e.message });
    console.log(`process failed: ${e.message}`);
  }
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

const ok = results.filter((r) => r.status === "ok" || r.status === "cached");
const missing = results.filter((r) => r.status !== "ok" && r.status !== "cached");
console.log(`\n  sourced from manufacturer: ${ok.length}/${targets.length}`);
if (missing.length) {
  console.log(`  needs generated fallback:  ${missing.length}`);
  for (const m of missing) console.log(`    - ${m.slug}  (${m.status})`);
}
