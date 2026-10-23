/**
 * The site's public address - the production domain on Vercel, localhost in development. Used
 * wherever an absolute URL is published: metadataBase, robots.txt and sitemap.xml. (The server's
 * own API calls resolve against a different origin; see serverOrigin() in lib/api.ts.)
 */
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:8100";

/** The author's full portfolio, linked from /about and the footer; /portfolio redirects to it. */
export const PORTFOLIO_URL = "https://jimwilliam.vercel.app/";

/** An absolute URL on this site for a path like "/products/3". */
export const absoluteUrl = (path: string) => new URL(path, SITE_URL).toString();
