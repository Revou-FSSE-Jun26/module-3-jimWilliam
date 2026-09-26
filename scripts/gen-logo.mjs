/**
 * Builds the default brand logo from assets/brand/logo-source.jpg with the same converter the
 * admin "Logo" setting uses (lib/server/logo.ts):
 *
 *   data/logo.json   the traced paths - the store's default logo (and favicon), until an admin uploads another
 *
 *   node scripts/gen-logo.mjs [path/to/logo.png]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { vectorizeLogo } from "../lib/server/logo.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2] ?? join(ROOT, "assets", "brand", "logo-source.jpg");
const vector = await vectorizeLogo(readFileSync(src));
writeFileSync(join(ROOT, "data", "logo.json"), JSON.stringify(vector) + "\n");
console.log(`  ${vector.paths.length} paths, colours ${vector.colours.join(" ")} -> data/logo.json`);
