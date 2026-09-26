/**
 * Pulls a manufacturer's technical specifications out of HTML - either a product page fetched
 * by the server, or the HTML an admin copied from the spec table in their own browser and
 * pasted into the product form.
 *
 * Spec tables come in a handful of shapes, all handled here in document order, with the most
 * recent heading (h2-h6, caption, figcaption, a single-cell row) as the group:
 *   - <table> rows of label/value cells (Intel, Corsair, Deepcool, MSI)
 *   - comparison tables with one column per model (NVIDIA): the column is picked by matching
 *     its header against the product name - "RTX 5070" fits "NVIDIA GeForce RTX 5070 12GB",
 *     "RTX 5070 Ti" does not
 *   - <dl> term/description lists (AMD)
 *   - lists of "Label: value" items (Arctic)
 *   - schema.org additionalProperty in JSON-LD (LG)
 *   - div grids of name/value pairs (Samsung, ASUS once rendered) - only inside a container
 *     that says "spec" in its id or class, or anywhere in a pasted fragment, since on a whole
 *     page the same shape also matches menus and promos
 *
 * Imports only node-html-parser and ../specs.ts, so scripts/fetch-specs.mjs can load it.
 */
import { parse, type HTMLElement } from "node-html-parser";
import { cleanSpecRows, SPEC_LIMITS, type SpecRow } from "../specs.ts";
import { fetchPage, SummaryError } from "./page-summary.ts";

const DROP = "script, style, noscript, template, svg, nav, header, footer, button, select, iframe, [role=tooltip], [aria-hidden=true]";
const HEADING = /^(h[2-6]|caption|figcaption|legend)$/;
const INLINE = /^(a|abbr|b|br|code|em|i|small|span|strong|sub|sup|u|img|wbr|font)$/;
const SPECISH = /spec/i;

const clean = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
/**
 * Text of an element with its lines kept apart - <br>, list items and block children become
 * ", " - so "4x USB 2.0 (Rear)<br>4x USB 2.0 (Front)" doesn't run together.
 */
function textOf(el: HTMLElement): string {
  return el.structuredText
    .split("\n")
    .map(clean)
    .filter(Boolean)
    .join(", ");
}
const elements = (el: HTMLElement) => el.childNodes.filter((n): n is HTMLElement => n.nodeType === 1);
const tag = (el: HTMLElement) => (el.rawTagName ?? "").toLowerCase();

/** Model-ish tokens of a name: lower-case words, minus the brand words headers leave out. */
const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[®™]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !["nvidia", "geforce", "amd", "radeon", "intel", "core", "gb", "the"].includes(t));

/** Index of the header cell naming this product, or -1. Every token of the header must be in the name. */
export function productColumn(headers: string[], productName: string): number {
  const name = new Set(tokens(productName));
  let best = -1;
  let bestScore = 0;
  headers.forEach((h, i) => {
    const t = tokens(h);
    if (!t.length || !t.some((w) => /\d/.test(w)) || !t.every((w) => name.has(w))) return;
    if (t.length > bestScore) [best, bestScore] = [i, t.length];
  });
  return best;
}

function fromJsonLd(root: HTMLElement): SpecRow[] {
  const rows: SpecRow[] = [];
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    const rec = o as Record<string, unknown>;
    if (Array.isArray(rec.additionalProperty)) {
      for (const p of rec.additionalProperty as Record<string, unknown>[]) {
        if (p?.name && p.value != null) rows.push({ label: String(p.name), value: `${p.value}${p.unitText ? ` ${p.unitText}` : ""}` });
      }
    }
    Object.values(rec).forEach(walk);
  };
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      walk(JSON.parse(s.text));
    } catch {
      /* malformed JSON-LD is common; skip it */
    }
  }
  return rows;
}

/**
 * `fragment` is for pasted HTML: the admin selected the spec table, so everything in it counts.
 * On a whole page only blocks of 3+ rows are kept - a real spec table is dense, while the
 * label/value shapes elsewhere on a page (feature call-outs, promos) come in ones and twos.
 */
export function extractSpecs(html: string, productName = "", { fragment = false } = {}): SpecRow[] {
  // every <br> spelling, including the invalid </br> some sites use, becomes a line break
  const root = parse(html.replace(/<\/?br\s*\/?>/gi, "\n"), { comment: false });
  const jsonLd = fromJsonLd(root);
  for (const el of root.querySelectorAll(DROP)) el.remove();

  const rows: SpecRow[] = [];
  const minBlock = fragment ? 1 : 3;
  const nameTokens = tokens(productName).join(" ");
  // a heading labels the block right after it only, so a promo heading can't leak onto the specs
  let group: string | undefined;
  let fresh = false;
  let block: SpecRow[] = [];

  const setGroup = (text: string) => {
    if (!text || text.length > SPEC_LIMITS.group) return;
    group = tokens(text).join(" ") === nameTokens ? undefined : text; // "MAG B850 TOMAHAWK WIFI" is not a group
    fresh = true;
  };
  const startBlock = () => {
    block = [];
  };
  // only a block that produced rows uses the heading up; an empty one (a list that turned out
  // not to be specs) leaves it for the next
  const endBlock = () => {
    if (block.length >= minBlock) rows.push(...block);
    if (block.length) fresh = false;
    block = [];
  };
  // "1 x PCIe 4.0 x16" or "27\" Full HD" is a feature line split in two, not a label
  const push = (label: string, value: string) => {
    if (!fresh) group = undefined;
    if (!/^\d/.test(label.trim())) block.push({ group, label, value });
  };

  function table(t: HTMLElement) {
    const trs = t.querySelectorAll("tr").filter((tr) => tr.closest("table") === t);
    const grid = trs.map((tr) => elements(tr).filter((c) => /^t[hd]$/.test(tag(c))));
    // a comparison table: find the header row and the column for this product
    let col = -1;
    let firstValueCol = -1;
    const header = grid.find((cells) => cells.length >= 3);
    if (header) {
      const texts = header.map((c) => clean(c.text));
      col = productColumn(texts, productName);
      firstValueCol = texts.findIndex((t) => t !== "");
    }
    grid.forEach((cells, i) => {
      const texts = cells.map(textOf);
      const filled = texts.filter(Boolean);
      if (trs[i].closest("thead") || cells === header) return;
      if (filled.length === 1 && (cells.length === 1 || cells.some((c) => Number(c.getAttribute("colspan")) > 1))) {
        setGroup(filled[0]);
        return;
      }
      if (cells.length >= 3 && col > 0 && firstValueCol > 0) {
        const labels = texts.slice(0, firstValueCol).filter(Boolean);
        if (labels.length >= 2) setGroup(labels[0]);
        if (labels.length && texts[col]) push(labels[labels.length - 1], texts[col]);
        return;
      }
      if (filled.length === 2) push(filled[0], filled[1]);
    });
  }

  function dl(d: HTMLElement) {
    // a menu written as a <dl> of links (ASUS) is navigation, not specifications
    const dds = d.querySelectorAll("dd");
    if (dds.filter((dd) => dd.querySelector("a") && clean(dd.text) === clean(dd.querySelectorAll("a").map((a) => a.text).join(" "))).length > dds.length / 2) return;
    let label = "";
    for (const el of d.querySelectorAll("dt, dd")) {
      if (tag(el) === "dt") label = textOf(el);
      else if (label) push(label, textOf(el));
    }
  }

  const COLON = /^([^:]{2,80}):\s*(.+)$/;
  function list(l: HTMLElement): boolean {
    const items = elements(l).filter((c) => tag(c) === "li");
    const matches = items.map((li) => COLON.exec(clean(li.text)));
    if (items.length < 2 || matches.filter(Boolean).length < Math.max(2, items.length / 2)) return false;
    for (const m of matches) if (m) push(m[1], m[2]);
    return true;
  }

  /** <div><div>Label</div><div>Value</div></div>, where both halves are short, text-only blocks. */
  function pair(el: HTMLElement): boolean {
    if (el.childNodes.some((n) => n.nodeType === 3 && n.text.trim())) return false;
    const kids = elements(el).filter((c) => clean(c.text));
    if (kids.length !== 2) return false;
    const leafy = (c: HTMLElement) => c.querySelectorAll("*").filter((d) => !INLINE.test(tag(d))).length <= 3 && !c.querySelector("table, dl, ul, ol");
    if (!kids.every(leafy)) return false;
    const [label, value] = kids.map(textOf);
    if (label.length > SPEC_LIMITS.label || value.length > SPEC_LIMITS.value || /[.!?]$/.test(label)) return false;
    push(label, value);
    return true;
  }

  // each table, dl or list is one block; so is a run of sibling name/value pairs
  const asBlock = (fn: () => boolean | void) => {
    startBlock();
    const handled = fn() !== false;
    endBlock();
    return handled;
  };

  function walk(node: HTMLElement, pairs: boolean) {
    let inPairs = false;
    for (const el of elements(node)) {
      const t = tag(el);
      if (pairs && (inPairs ? pair(el) : (startBlock(), pair(el)))) {
        inPairs = true;
        continue;
      }
      if (inPairs) {
        endBlock();
        inPairs = false;
      }
      if (HEADING.test(t) || el.getAttribute("role") === "heading") setGroup(clean(el.text));
      else if (t === "table") asBlock(() => table(el));
      else if (t === "dl") asBlock(() => dl(el));
      else if ((t === "ul" || t === "ol") && asBlock(() => list(el))) continue;
      else walk(el, pairs || SPECISH.test(`${el.id} ${el.getAttribute("class") ?? ""}`));
    }
    if (inPairs) endBlock();
  }
  walk(root, fragment);
  // JSON-LD specs duplicate the visible table when there is one; use them only as a fallback
  return cleanSpecRows(rows.length >= 3 ? rows : [...rows, ...jsonLd]);
}

/** Fetch a spec page and extract its rows; throws SummaryError with advice when there are none. */
export async function fetchSpecs(raw: string, productName: string): Promise<{ url: string; specs: SpecRow[] }> {
  const { url, html } = await fetchPage(raw, "the specifications");
  const specs = extractSpecs(html, productName);
  if (specs.length < 3) {
    throw new SummaryError(
      `${url.hostname} builds its spec table in the browser, so it can't be read from here. Open the page, select the whole spec table, copy it and paste it into the box below.`
    );
  }
  return { url: url.href, specs };
}
