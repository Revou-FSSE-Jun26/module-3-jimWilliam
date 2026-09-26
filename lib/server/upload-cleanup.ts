import "server-only";

import { after } from "next/server";
import { imagesInUse } from "@/lib/server/store";
import { deleteUploads, describeCleanup, isUpload, sweepUploads, type CleanupResult } from "@/lib/server/uploads";

/*
 * Keeps upload storage down to the images products actually use. Both run with after(), so the
 * admin's request answers first and the deleting happens once it has been sent.
 */

const report = (r: CleanupResult) => r.removed > 0 && console.info(describeCleanup(r));

/** A write just stopped using these image URLs: delete the uploads among them that no product still uses. */
export function releaseImages(urls: string[]) {
  const uploads = urls.filter(isUpload);
  if (!uploads.length) return;
  after(async () => {
    const inUse = await imagesInUse();
    report(await deleteUploads(uploads.filter((url) => !inUse.has(url))));
  });
}

/** After a successful upload: sweep out unused uploads older than the grace period. */
export function sweepAfterUpload() {
  after(async () => report(await sweepUploads(await imagesInUse())));
}
