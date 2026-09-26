import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { del, list, put } from "@vercel/blob";
import sharp from "sharp";
import type { Metadata } from "sharp";

/**
 * Product image uploads. Whatever arrives - JPG, PNG, WebP, GIF, TIFF, AVIF - leaves as AVIF:
 *
 *   <id>.avif       1600px square tile   (the master)
 *   <id>@800.avif    800px
 *   <id>@400.avif    400px              - picked per srcset width by lib/image-loader.ts
 *
 * The same treatment as the seeded photos (scripts/fetch-images.mjs): EXIF rotation applied,
 * a white studio background keyed out, the product centred on the store's surface colour.
 *
 * Nothing else is kept. The uploaded original is converted in memory and never written anywhere -
 * not to disk, not to /tmp, not to Blob - so once the three AVIFs are stored it is simply gone.
 * Uploads that no product uses any more are deleted too (see "Cleanup" below), so storage only
 * ever holds images that are on a product.
 *
 * Where the three files go:
 *   Vercel Blob   when BLOB_READ_WRITE_TOKEN is set (production) - a public CDN URL,
 *                 https://<store>.public.blob.vercel-storage.com/uploads/<id>.avif
 *   local disk    otherwise (development) - .data/uploads, served by /api/images/<id>.avif
 */

export class UploadError extends Error {}

const TILE = 1600;
const INNER = 1360;
const SURFACE = { r: 13, g: 20, b: 37, alpha: 1 }; // --color-surface
const VARIANTS = [800, 400];
// Vercel refuses a function request body over 4.5 MB before our code even runs, so stay under it
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_PIXELS = 40_000_000; // ~ 7000 x 5700: refuse decompression bombs before decoding

/** sharp's `format` for a file, which comes from its contents - never trust the filename or MIME type. */
const ACCEPTED: Record<string, string> = { jpeg: "JPG", png: "PNG", webp: "WebP", gif: "GIF", tiff: "TIFF", heif: "AVIF" };

// Local storage only. Its paths carry /*turbopackIgnore*/ (see inDir) because the folder can come
// from an env var: without that the build cannot tell what it reads and bundles the whole project
// into every function that imports this file.
const DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), ".data", "uploads");
const inDir = (name: string) => join(/*turbopackIgnore: true*/ DIR, name);
const blobStorage = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
/** a year: file names are random and never reused, so the bytes behind a URL never change */
const CACHE_SECONDS = 31_536_000;
const FILE_NAME = /^[a-f0-9]{16}(?:@(?:400|800))?\.avif$/;

export interface UploadResult {
  url: string;
  bytes: number;
  source: { format: string; width: number; height: number; bytes: number };
}

/** Near-white pixels ramped out to transparent, when the corners say the background is white. */
async function keyOutWhite(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const at = (x: number, y: number) => (y * width + x) * channels;
  const corners: [number, number][] = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
  ];
  const white = corners.every(([x, y]) => {
    const i = at(Math.max(0, x), Math.max(0, y));
    return data[i] > 232 && data[i + 1] > 232 && data[i + 2] > 232 && data[i + 3] > 200;
  });
  if (!white) return input;
  for (let i = 0; i < data.length; i += channels) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (lum <= 232) continue;
    data[i + 3] = Math.round(data[i + 3] * (1 - Math.min(1, (lum - 232) / 18)));
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

export async function processUpload(file: Buffer): Promise<UploadResult> {
  if (file.byteLength > MAX_UPLOAD_BYTES) throw new UploadError(`Images must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller.`);

  let meta: Metadata;
  try {
    meta = await sharp(file, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw new UploadError("That file is not an image this store can read.");
  }
  const format = meta.format ?? "";
  // AVIF and HEIC share the HEIF container; only AV1 (AVIF) can be decoded - HEVC (iPhone HEIC) cannot
  if (format === "heif" && meta.compression !== "av1") {
    throw new UploadError("HEIC photos aren't supported. Export the photo as JPG (or set your camera to 'Most Compatible') and upload that.");
  }
  if (!ACCEPTED[format]) throw new UploadError(`${format.toUpperCase() || "That"} files aren't supported. Use JPG, PNG, WebP, GIF, TIFF or AVIF.`);
  if ((meta.width ?? 0) < 200 || (meta.height ?? 0) < 200) throw new UploadError("Images must be at least 200 × 200 pixels.");

  try {
    // .rotate() with no argument applies the EXIF orientation, so phone photos come out upright
    const upright = await sharp(file, { limitInputPixels: MAX_PIXELS }).rotate().toBuffer();
    const product = await sharp(await keyOutWhite(upright))
      .ensureAlpha()
      .trim({ threshold: 12 })
      .resize(INNER, INNER, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    const master = await sharp({ create: { width: TILE, height: TILE, channels: 4, background: SURFACE } })
      .composite([{ input: product, gravity: "center" }])
      .avif({ quality: 58, effort: 4 })
      .toBuffer();

    const id = randomBytes(8).toString("hex");
    const files: [string, Buffer][] = [[`${id}.avif`, master]];
    for (const w of VARIANTS) files.push([`${id}@${w}.avif`, await sharp(master).resize(w, w).avif({ quality: 58, effort: 4 }).toBuffer()]);
    const url = await save(files);

    return {
      url,
      bytes: master.byteLength,
      source: { format: ACCEPTED[format], width: meta.width ?? 0, height: meta.height ?? 0, bytes: file.byteLength },
    };
  } catch (e) {
    if (e instanceof UploadError) throw e;
    throw new UploadError("The image could not be converted. Try exporting it again as JPG or PNG.");
  }
}

/* ------------------------------------------------------------------ storage */

/** Stores the three sizes and returns the master's URL - the one a product's `images` holds. */
async function save(files: [string, Buffer][]): Promise<string> {
  if (blobStorage()) {
    const stored = await Promise.all(
      files.map(([name, bytes]) =>
        put(`uploads/${name}`, bytes, { access: "public", contentType: "image/avif", addRandomSuffix: false, cacheControlMaxAge: CACHE_SECONDS })
      )
    );
    return stored[0].url;
  }
  await mkdir(/*turbopackIgnore: true*/ DIR, { recursive: true });
  for (const [name, bytes] of files) await writeFile(inDir(name), bytes);
  return `/api/images/${files[0][0]}`;
}

/* ------------------------------------------------------------------ cleanup */

/**
 * Uploads nobody links to are deleted, so storage only ever holds images that are in use:
 *   - as soon as a product is saved without an uploaded image, or deleted (deleteUploads);
 *   - after a successful upload, a sweep removes any unused upload older than the grace period
 *     (sweepUploads) - images uploaded and then abandoned in a form that was never saved. The
 *     grace period keeps an image that is still in an open, unsaved form from vanishing, and the
 *     sweep runs at most every few minutes per server so it costs next to nothing.
 */
const ORPHAN_GRACE_MS = Number(process.env.UPLOAD_ORPHAN_GRACE_MINUTES ?? 60) * 60_000;
const SWEEP_EVERY_MS = 10 * 60_000;
const UPLOAD_URL = /^(?:\/api\/images\/|https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/uploads\/)([a-f0-9]{16})\.avif$/;

/** True for an uploaded image's URL (either storage); false for the seeded /products/... photos. */
export const isUpload = (url: string) => UPLOAD_URL.test(url);
const idOf = (url: string) => UPLOAD_URL.exec(url)?.[1] ?? null;
/** the master's URL -> the master plus its two smaller sizes */
const sizesOf = (url: string) => [url, ...VARIANTS.map((w) => url.replace(/\.avif$/, `@${w}.avif`))];

export interface CleanupResult {
  removed: number;
  bytes: number;
}

/** Delete these uploads (master URLs) - the caller has checked nothing uses them. */
export async function deleteUploads(urls: Iterable<string>): Promise<CleanupResult> {
  const targets = [...new Set(urls)].filter(isUpload);
  if (!targets.length) return { removed: 0, bytes: 0 };
  let bytes = 0;
  if (blobStorage()) {
    await del(targets.flatMap(sizesOf));
  } else {
    for (const url of targets) {
      for (const name of sizesOf(`${idOf(url)}.avif`)) {
        const path = inDir(name);
        bytes += await stat(/*turbopackIgnore: true*/ path).then((st) => st.size, () => 0);
        await rm(/*turbopackIgnore: true*/ path, { force: true });
      }
    }
  }
  return { removed: targets.length, bytes };
}

let lastSweep = 0;

/** Delete every upload that no product uses and that is older than the grace period. */
export async function sweepUploads(inUse: Set<string>, graceMs = ORPHAN_GRACE_MS): Promise<CleanupResult> {
  if (graceMs === ORPHAN_GRACE_MS && Date.now() - lastSweep < SWEEP_EVERY_MS) return { removed: 0, bytes: 0 };
  lastSweep = Date.now();
  const cutoff = Date.now() - graceMs;
  const inUseIds = new Set([...inUse].map(idOf).filter(Boolean));
  const stale: string[] = [];

  if (blobStorage()) {
    let bytes = 0;
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: "uploads/", cursor, limit: 1000 });
      for (const b of page.blobs) {
        const id = /^uploads\/([a-f0-9]{16})\.avif$/.exec(b.pathname)?.[1];
        if (!id || inUseIds.has(id) || b.uploadedAt.getTime() >= cutoff) continue;
        stale.push(b.url);
        bytes += b.size;
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return { ...(await deleteUploads(stale)), bytes };
  }

  const names = await readdir(/*turbopackIgnore: true*/ DIR).catch(() => [] as string[]);
  for (const name of names) {
    const id = /^([a-f0-9]{16})\.avif$/.exec(name)?.[1];
    if (!id || inUseIds.has(id)) continue;
    const { mtimeMs } = await stat(inDir(name));
    if (mtimeMs < cutoff) stale.push(`/api/images/${name}`);
  }
  return deleteUploads(stale);
}

export const describeCleanup = ({ removed, bytes }: CleanupResult) =>
  `uploads: deleted ${removed} unused image${removed === 1 ? "" : "s"}${bytes ? ` (${Math.round(bytes / 1024)} KB freed)` : ""}`;

/** Local storage only: the stored AVIF for a served file name, or null. The name is validated, so no path tricks. */
export async function readUpload(name: string): Promise<Buffer | null> {
  if (!FILE_NAME.test(name)) return null;
  try {
    return await readFile(inDir(name));
  } catch {
    return null;
  }
}
