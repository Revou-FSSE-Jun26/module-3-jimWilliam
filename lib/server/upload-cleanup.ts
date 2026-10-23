import "server-only";

import { after } from "next/server";
import { backendUrl } from "@/lib/api";
import { deleteUploads, describeCleanup, isUpload, sweepUploads, type CleanupResult } from "@/lib/server/uploads";
import type { Product } from "@/lib/types";

/*
 * Keeps upload storage down to the images products actually use. Product edits go straight to
 * the Flask API, so "in use" always comes from the API's product list - and when that can't be
 * read, nothing is deleted: every upload would look unused.
 */

/** Every image URL any product uses, from the API - or null if the API can't be asked. */
async function imagesInUse(): Promise<Set<string> | null> {
  try {
    const res = await fetch(`${backendUrl()}/products`, { cache: "no-store", headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return new Set(((await res.json()) as Product[]).flatMap((p) => p.images ?? []));
  } catch {
    return null;
  }
}

const report = (r: CleanupResult) => r.removed > 0 && console.info(describeCleanup(r));

/**
 * A product just stopped using these image URLs (saved without them, or deleted): delete the
 * uploads among them that no product still uses. Returns what was removed.
 */
export async function releaseUploads(urls: string[]): Promise<CleanupResult> {
  const uploads = [...new Set(urls)].filter(isUpload);
  if (!uploads.length) return { removed: 0, bytes: 0 };
  const inUse = await imagesInUse();
  if (!inUse) return { removed: 0, bytes: 0 };
  const result = await deleteUploads(uploads.filter((url) => !inUse.has(url)));
  report(result);
  return result;
}

/** After a successful upload: sweep out unused uploads older than the grace period. Runs with
 * after(), so the admin's request answers first. */
export function sweepAfterUpload() {
  after(async () => {
    const inUse = await imagesInUse();
    if (inUse) report(await sweepUploads(inUse));
  });
}
