/**
 * Square product tiles, shared by the image scripts (fetch-images, import-gallery).
 *
 * Every product image in the store is a 1600px AVIF square on the site's surface colour, so
 * the catalogue grid, the gallery and the hover zoom all line up whatever the source was.
 */
import sharp from "sharp";

export const TILE = 1600; // final square tile
export const INNER = 1360; // a cut-out product is fitted inside this, leaving breathing room
export const SURFACE = { r: 13, g: 20, b: 37, alpha: 1 }; // --color-surface #0d1425

/**
 * Product shots usually arrive on a white studio background, which looks wrong on a dark
 * page. Where the corners say the background is near-white, ramp near-white pixels out to
 * transparent so the product sits on the surface colour instead of a white box.
 */
export async function keyOutWhite(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const at = (x, y) => (y * width + x) * channels;
  const corners = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
  ];
  const isWhite = corners.every(([x, y]) => {
    const i = at(x, y);
    return data[i] > 232 && data[i + 1] > 232 && data[i + 2] > 232 && data[i + 3] > 200;
  });
  if (!isWhite) return { buffer: input, keyed: false };

  const LO = 232; // fully opaque at or below this luminance
  const HI = 250; // fully transparent at or above
  for (let i = 0; i < data.length; i += channels) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (lum <= LO) continue;
    const t = Math.min(1, (lum - LO) / (HI - LO));
    data[i + 3] = Math.round(data[i + 3] * (1 - t));
  }
  const out = await sharp(data, { raw: { width, height, channels } }).png().toBuffer();
  return { buffer: out, keyed: true };
}

export async function toTile(input) {
  const { buffer, keyed } = await keyOutWhite(input);
  const trimmed = await sharp(buffer)
    .ensureAlpha()
    .trim({ threshold: 12 })
    .resize(INNER, INNER, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const tile = await sharp({
    create: { width: TILE, height: TILE, channels: 4, background: SURFACE },
  })
    .composite([{ input: trimmed, gravity: "center" }])
    .avif({ quality: 58, effort: 6 })
    .toBuffer();

  const blur = await sharp(tile).resize(32, 32, { fit: "cover" }).blur(4).avif({ quality: 40 }).toBuffer();
  return { tile, blur, keyed };
}

/**
 * A photo or infographic (no transparency): fitted whole onto the square - letterboxed on the
 * surface colour rather than cropped, so text baked into a feature image is never cut off.
 */
export async function toFullFrameTile(input) {
  const fitted = await sharp(input).rotate().resize(TILE, TILE, { fit: "inside", kernel: "lanczos3" }).toBuffer();
  return sharp({ create: { width: TILE, height: TILE, channels: 4, background: SURFACE } })
    .composite([{ input: fitted, gravity: "center" }])
    .avif({ quality: 58, effort: 6 })
    .toBuffer();
}

export const blurOf = async (tile) => sharp(tile).resize(32, 32, { fit: "cover" }).blur(4).avif({ quality: 40 }).toBuffer();
