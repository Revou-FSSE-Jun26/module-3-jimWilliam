/**
 * Logo -> SVG. Turns an uploaded raster logo (PNG, JPG, WebP, AVIF, GIF - or an SVG, which is
 * rasterised first) into clean vector paths the store can show at any size and use as its
 * favicon.
 *
 *   1. Background out. Transparent pixels are background; so are the colours along the image's
 *      border - which removes plain backgrounds and also a checkerboard "transparency" pattern
 *      that was saved into the pixels.
 *   2. Mask. Each pixel's distance from the nearest background colour, smoothed, and cut at 45%
 *      of the strongest contrast in the image: solid strokes survive, soft glow and JPEG noise
 *      don't.
 *   3. Colour. Saturated colours are read from a blurred copy, so the white-hot centre of a neon
 *      tube takes the colour of the glow around it; neutral parts (black text, white fills)
 *      keep their own colour. The palette is clustered from pixels well inside the shapes, and
 *      edge pixels snap to it, so anti-aliasing doesn't add washed-out extra colours.
 *   4. Trace. imagetracerjs turns each colour layer into paths; they are cropped to the logo's
 *      bounding box.
 *
 * The output is SVG we write ourselves from path data - nothing from the uploaded file is
 * copied into it - so it is safe to serve and inline. No "@/" imports: scripts/gen-logo.mjs
 * loads this file directly.
 */
import ImageTracer from "imagetracerjs";
import sharp, { type OutputInfo } from "sharp";

export interface LogoPath {
  d: string;
  fill: string;
}

export interface LogoVector {
  /** bounding box of the artwork, in path coordinates */
  box: { x: number; y: number; w: number; h: number };
  paths: LogoPath[];
  colours: string[];
}

export class LogoError extends Error {}

const WORK = 1200; // processing size: plenty for a logo, fast to trace
const MAX_PIXELS = 40_000_000;
const MAX_PATHS = 1500;

type RGB = [number, number, number];
const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sat = ([r, g, b]: RGB) => {
  const mx = Math.max(r, g, b);
  return mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
};
const hex = ([r, g, b]: RGB) => `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/** k-means on colours; returns centres with their share of the points. */
function kmeans(pts: RGB[], k: number, iters = 12): { c: RGB; n: number }[] {
  if (!pts.length) return [];
  const step = Math.max(1, Math.floor(pts.length / k));
  let centres: RGB[] = pts.filter((_, i) => i % step === 0).slice(0, k).map((p) => [...p] as RGB);
  let counts: number[] = [];
  for (let it = 0; it < iters; it++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < centres.length; i++) {
        const d = dist(p, centres[i]);
        if (d < bd) [bd, bi] = [d, i];
      }
      const s = sums[bi];
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3]++;
    }
    centres = sums.map((s, i) => (s[3] ? ([s[0] / s[3], s[1] / s[3], s[2] / s[3]] as RGB) : centres[i]));
    counts = sums.map((s) => s[3]);
  }
  return centres.map((c, i) => ({ c, n: counts[i] }));
}

/** Drop clusters that are too small or too close to a bigger one. */
function palette(clusters: { c: RGB; n: number }[], total: number, minShare: number, minGap: number): RGB[] {
  return clusters
    .filter((x) => x.n > total * minShare)
    .sort((a, b) => b.n - a.n)
    .reduce<RGB[]>((acc, x) => (acc.some((a) => dist(a, x.c) < minGap) ? acc : [...acc, x.c]), []);
}

const nearest = (px: RGB, list: RGB[]) => {
  let bi = 0;
  let bd = Infinity;
  for (let i = 0; i < list.length; i++) {
    const d = dist(px, list[i]);
    if (d < bd) [bd, bi] = [d, i];
  }
  return bi;
};

/** Brightest version of a saturated colour - neon strokes should read as light, not as their muddy glow. */
const vivid = ([r, g, b]: RGB): RGB => {
  const mx = Math.max(r, g, b) || 1;
  return [r, g, b].map((c) => Math.round((c / mx) * 255)) as RGB;
};

export async function vectorizeLogo(input: Buffer): Promise<LogoVector> {
  let raw: { data: Buffer; info: OutputInfo };
  try {
    raw = await sharp(input, { limitInputPixels: MAX_PIXELS, density: 300 })
      .rotate()
      .resize(WORK, WORK, { fit: "inside", withoutEnlargement: false })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new LogoError("That file is not an image this store can read.");
  }
  const { data, info } = raw;
  const W = info.width;
  const H = info.height;
  const N = W * H;
  const rgb = (p: number): RGB => [data[p * 4], data[p * 4 + 1], data[p * 4 + 2]];
  const alpha = (p: number) => data[p * 4 + 3];

  // 1. background colours from the border (opaque pixels only)
  const border: RGB[] = [];
  for (let x = 0; x < W; x += 2) for (const p of [x, (H - 1) * W + x]) if (alpha(p) > 128) border.push(rgb(p));
  for (let y = 0; y < H; y += 2) for (const p of [y * W, y * W + W - 1]) if (alpha(p) > 128) border.push(rgb(p));
  const bg = palette(kmeans(border, 3), border.length, 0.05, 20);

  // 2. distance-from-background map -> smoothed -> adaptive threshold
  const dmap = Buffer.alloc(N);
  for (let p = 0; p < N; p++) {
    if (alpha(p) < 128) continue;
    const px = rgb(p);
    let d = bg.length ? Infinity : 255;
    for (const b of bg) d = Math.min(d, dist(px, b));
    dmap[p] = Math.min(255, d);
  }
  const { data: smooth } = await sharp(dmap, { raw: { width: W, height: H, channels: 1 } })
    .blur(Math.max(0.5, W / 420))
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sorted = Uint8Array.from(smooth).sort();
  const strongest = sorted[Math.floor(N * 0.995)];
  if (strongest < 24) throw new LogoError("No logo found - the image looks like a plain background.");
  const threshold = strongest * 0.45;
  const mask = new Uint8Array(N);
  let inked = 0;
  for (let p = 0; p < N; p++) {
    if (smooth[p] > threshold) {
      mask[p] = 1;
      inked++;
    }
  }
  if (inked > N * 0.9) throw new LogoError("The logo needs a plain or transparent background to be separated from it.");

  // 3. colours. A glowing logo (neon tubes) has white-hot cores whose real colour is the glow
  // around them - read from a blurred copy - and dim glow colours that should be brightened. A
  // flat logo keeps its own colours exactly. Tell them apart by how much of the solid artwork
  // is near-white while its surroundings are strongly coloured.
  const blurred = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .removeAlpha()
    .blur(Math.max(2, W / 100))
    .raw()
    .toBuffer();
  const brgb = (p: number): RGB => [blurred[p * 3], blurred[p * 3 + 1], blurred[p * 3 + 2]];
  // the palette comes from pixels well inside the shapes: anti-aliased edges are blends of a
  // colour and the background, and would otherwise turn up as extra, washed-out colours
  const core = strongest * 0.8;
  let coreCount = 0;
  let tintedCores = 0;
  for (let p = 0; p < N; p += 2) {
    if (!mask[p] || smooth[p] < core) continue;
    coreCount++;
    if (sat(rgb(p)) < 0.25 && Math.max(...rgb(p)) > 200 && sat(brgb(p)) > 0.3) tintedCores++;
  }
  const glowing = tintedCores > coreCount * 0.2;
  /** the colour a pixel stands for: in a glowing logo the glow around it, otherwise its own */
  const source = glowing ? brgb : rgb;

  const vividPts: RGB[] = [];
  const neutralPts: RGB[] = [];
  for (let p = 0; p < N; p += 2) {
    if (!mask[p] || smooth[p] < core) continue;
    const c = source(p);
    (sat(c) > 0.25 ? vividPts : neutralPts).push(c);
  }
  const satPal = vividPts.length > 50 ? palette(kmeans(vividPts, 5), vividPts.length, 0.03, 70) : [];
  const neuPal = neutralPts.length > 50 ? palette(kmeans(neutralPts, 3), neutralPts.length, 0.05, 50) : [];
  const allPal: RGB[] = [...satPal, ...neuPal];
  const colours: RGB[] = [...satPal.map((c) => (glowing ? vivid(c) : (c.map(Math.round) as RGB))), ...neuPal.map((c) => c.map(Math.round) as RGB)];
  if (!colours.length) {
    colours.push([255, 255, 255]);
    allPal.push([255, 255, 255]);
  }

  /**
   * An anti-aliased edge pixel is a blend of the background and one palette colour, so it lies
   * on the line between them: pick the colour whose direction from the background matches best
   * (a grey edge of black text on white belongs to the black, not to a red that happens to be
   * nearer in plain distance).
   */
  const edgeColour = (px: RGB) => {
    const b = bg[nearest(px, bg)];
    const v = [px[0] - b[0], px[1] - b[1], px[2] - b[2]];
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    let best = 0;
    let bestCos = -Infinity;
    allPal.forEach((q, i) => {
      const w = [q[0] - b[0], q[1] - b[1], q[2] - b[2]];
      const cos = (v[0] * w[0] + v[1] * w[1] + v[2] * w[2]) / (len * (Math.hypot(w[0], w[1], w[2]) || 1));
      if (cos > bestCos) [bestCos, best] = [cos, i];
    });
    return best;
  };

  const layered = new Uint8ClampedArray(N * 4);
  for (let p = 0; p < N; p++) {
    if (!mask[p]) continue;
    const c = colours[core <= smooth[p] || glowing || !bg.length ? nearest(source(p), allPal) : edgeColour(rgb(p))];
    layered[p * 4] = c[0];
    layered[p * 4 + 1] = c[1];
    layered[p * 4 + 2] = c[2];
    layered[p * 4 + 3] = 255;
  }

  // 4. trace each colour layer
  const svg: string = ImageTracer.imagedataToSVG(
    { width: W, height: H, data: layered },
    {
      pal: [{ r: 0, g: 0, b: 0, a: 0 }, ...colours.map(([r, g, b]) => ({ r, g, b, a: 255 }))],
      ltres: 1,
      qtres: 1,
      pathomit: Math.round(W / 80),
      roundcoords: 1,
      linefilter: true,
      rightangleenhance: false,
      viewbox: true,
      strokewidth: 0,
    }
  );
  const paths: LogoPath[] = [];
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const m of svg.matchAll(/<path[^>]*fill="rgb\((\d+),(\d+),(\d+)\)"[^>]*opacity="([\d.]+)"[^>]*d="([^"]+)"/g)) {
    if (Number(m[4]) === 0) continue; // the transparent background layer
    const d = m[5].trim();
    const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      x0 = Math.min(x0, nums[i]);
      x1 = Math.max(x1, nums[i]);
      y0 = Math.min(y0, nums[i + 1]);
      y1 = Math.max(y1, nums[i + 1]);
    }
    paths.push({ d, fill: hex([Number(m[1]), Number(m[2]), Number(m[3])]) });
  }
  if (!paths.length) throw new LogoError("No logo shapes could be traced from that image.");
  if (paths.length > MAX_PATHS) throw new LogoError("That image is too detailed for a logo - use one with a plain background.");

  return {
    box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    paths,
    colours: [...new Set(paths.map((p) => p.fill))],
  };
}

/**
 * The SVG document for a traced logo.
 *   variant "full": cropped to the artwork (header, settings preview)
 *   variant "icon": a square canvas around it (favicon), no glow - it only blurs at 16px
 */
export function logoSvg(v: LogoVector, { glow = false, variant = "full" }: { glow?: boolean; variant?: "full" | "icon" } = {}): string {
  const { x, y, w, h } = v.box;
  const useGlow = glow && variant === "full";
  const pad = Math.max(w, h) * (useGlow ? 0.08 : 0.04);
  let vb = [x - pad, y - pad, w + pad * 2, h + pad * 2];
  if (variant === "icon") {
    const side = Math.max(w, h) + pad * 2;
    vb = [x + w / 2 - side / 2, y + h / 2 - side / 2, side, side];
  }
  const r = (n: number) => Math.round(n * 10) / 10;
  const body = v.paths.map((p) => `<path fill="${p.fill}" d="${p.d}"/>`).join("");
  const defs = useGlow
    ? `<defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${r(h * 0.018)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(r).join(" ")}" role="img">${defs}<g${useGlow ? ' filter="url(#glow)"' : ""}>${body}</g></svg>`;
}
