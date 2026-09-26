/**
 * Reads the short summary a manufacturer publishes for its own product page - the
 * og:description / meta description that link previews show - so an admin can import it as a
 * product overview with a credit and a link, instead of copying the whole marketing page.
 *
 * Deliberately dependency-free (no "@/" imports) so scripts/fetch-overviews.mjs can import it
 * directly with Node's built-in TypeScript support, as well as the /api/official-preview route.
 *
 * Because it fetches a URL that someone typed in, it refuses anything that is not a public
 * http(s) address - checked again on every redirect - so it cannot be used to probe
 * localhost or the private network (SSRF).
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface PageSummary {
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
}

export class SummaryError extends Error {}

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function isPrivateIp(ip: string): boolean {
  if (ip.startsWith("::ffff:")) return isPrivateIp(ip.slice(7));
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

/** Throws unless the URL is http(s) and every address its host resolves to is public. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SummaryError("That is not a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new SummaryError("Only http and https links are allowed.");
  if (url.username || url.password) throw new SummaryError("Links with credentials are not allowed.");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new SummaryError("That address is not a public website.");
  }
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new SummaryError("That website could not be found.");
  if (addresses.some(isPrivateIp)) throw new SummaryError("That address is not a public website.");
  return url;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", trade: "™", reg: "®", copy: "©", hellip: "…", mdash: "—", ndash: "–" };

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, key: string): string | null {
  // attribute order varies between sites: content before or after property/name
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']`, "i").exec(html);
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`, "i").exec(html);
  const v = (a ?? b)?.[1];
  return v ? decode(v) : null;
}

/**
 * Meta descriptions are written to sell and to rank in search, not to describe: "Shop X.",
 * "Buy now!", "5% off your first order", a store name after a pipe, company history after a
 * dash, and often a sentence cut off at the character limit. Keep only the sentences that
 * actually describe the product. Returns "" when nothing descriptive is left.
 */
const JUNK = [
  /^shop\b/i,
  /\b(buy|shop|order) now\b/i,
  /\b\d+\s?% off\b/i,
  /\bfirst order\b/i,
  /\bfree (shipping|delivery)\b/i,
  /\bfast processing\b/i,
  /\bavailable now\b/i,
  /\bquick reference with specifications\b/i,
  /\b(was )?founded\b.*\bmission\b/i,
  /\bstore$/i,
];

export function cleanSummary(raw: string): string {
  const pieces = raw
    .split(/\s+\|\s+/) // "CODE | real text | Store name"
    .flatMap((part) => part.split(/\s+-\s+(?=[A-Z][\w]*\s+(?:was|is|has)\b)/)) // "... - DeepCool was founded ..."
    .flatMap((part) => part.split(/(?<=[.!?])\s+/)) // sentences
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^pictures, reviews and tech information for (the )?/i, ""))
    .filter((s) => !JUNK.some((re) => re.test(s)))
    .filter((s) => !/^[A-Z0-9-]{6,}$/.test(s)); // bare part numbers
  // the last sentence is often cut off at the site's character limit
  if (pieces.length > 1 && !/[.!?)"™®]$/.test(pieces[pieces.length - 1])) pieces.pop();
  const text = pieces.join(" ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

export function extractSummary(html: string, url: string): PageSummary {
  const titleTag = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1];
  const title = meta(html, "og:title") ?? (titleTag ? decode(titleTag) : null);
  const description = meta(html, "og:description") ?? meta(html, "description") ?? meta(html, "twitter:description");
  return {
    url,
    title: title || null,
    description: description ? description.slice(0, 1000) : null,
    siteName: meta(html, "og:site_name"),
  };
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * Download a public HTML page: up to a few redirects, each re-checked with assertPublicUrl,
 * with a timeout and a size cap. Shared by the summary and spec importers.
 */
export async function fetchPage(raw: string, what = "the overview"): Promise<{ url: URL; html: string }> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new SummaryError(`${url.hostname} did not respond.`);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).href);
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      throw new SummaryError(`${url.hostname} blocks automated requests - add ${what} by hand.`);
    }
    if (!res.ok) throw new SummaryError(`${url.hostname} answered ${res.status}.`);
    if (!(res.headers.get("content-type") ?? "").includes("html")) throw new SummaryError("That link is not a web page.");
    return { url, html: await readCapped(res) };
  }
  throw new SummaryError("Too many redirects.");
}

/** Fetch a page and pull its summary. */
export async function fetchSummary(raw: string): Promise<PageSummary> {
  const { url, html } = await fetchPage(raw);
  const summary = extractSummary(html, url.href);
  if (!summary.description) throw new SummaryError(`${url.hostname} does not publish a summary for this page.`);
  const cleaned = cleanSummary(summary.description);
  if (!cleaned) throw new SummaryError(`${url.hostname} only publishes a sales tagline or boilerplate for this page - write the overview by hand.`);
  return { ...summary, description: cleaned };
}
