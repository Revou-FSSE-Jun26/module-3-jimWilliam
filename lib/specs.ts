/**
 * Technical specification rows - the manufacturer's spec table, as label/value pairs with an
 * optional group ("Memory Specs", "Connectivity"). Shared by the API validation, the admin
 * editor, the product page and the server-side extractor, so it has no imports: Node scripts
 * load it directly with type stripping.
 */
export interface SpecRow {
  group?: string;
  label: string;
  value: string;
}

export const SPEC_LIMITS = { rows: 150, group: 60, label: 80, value: 400 } as const;

/** Link texts and store widgets that spec tables often contain but that aren't specifications. */
const JUNK_VALUE = /^(view now|download|learn more|see more|see all specs|more info|details|compare|click here|print|share|datasheet|n\/a|-|—|\?)$/i;
const JUNK_LABEL = /\b(price|msrp|buy|shop|add to cart|compare)\b/i;
/** Promo and page headings that sit right above a spec table without naming a section of it. */
const JUNK_GROUP = /^(specifications?|spesifikasi|specs|tech(nical)? spec(ification)?s|key specs?|overview|notes?)$|\b(bundle|featured|offer|deal|promo|buy|shop)\b/i;

const tidy = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/[‡†]+/g, "")
    .replace(/^[*\s]+|[*\s]+$/g, "")
    .trim();

/**
 * Normalise rows from any source: tidy whitespace and footnote marks, drop link texts and
 * prices, strip a trailing colon from labels, de-duplicate (a label can repeat in different
 * groups), and cap at SPEC_LIMITS.
 */
export function cleanSpecRows(rows: SpecRow[]): SpecRow[] {
  const seen = new Set<string>();
  const out: SpecRow[] = [];
  for (const r of rows) {
    const label = tidy(r.label).replace(/:$/, "").trim();
    const value = tidy(r.value);
    const rawGroup = r.group ? tidy(r.group).replace(/:$/, "").trim() : "";
    const group = JUNK_GROUP.test(rawGroup) ? "" : rawGroup;
    if (!label || !value || label.length > SPEC_LIMITS.label || value.length > SPEC_LIMITS.value) continue;
    if (JUNK_VALUE.test(value) || JUNK_LABEL.test(label) || label.toLowerCase() === value.toLowerCase()) continue;
    const key = `${group}\u0000${label}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(group && group.length <= SPEC_LIMITS.group ? { group, label, value } : { label, value });
    if (out.length === SPEC_LIMITS.rows) break;
  }
  return out;
}

/**
 * Plain-text spec paste, for when the clipboard has no HTML. Understands the three shapes a
 * copied spec table usually turns into:
 *   "Label<TAB>Value"          a copied <table>
 *   "Label: Value"             a copied list
 *   "Label\nValue\nLabel\n..." a copied grid of divs - lines paired up in order
 * A line on its own that ends in ":" (or sits between blank lines in tab/colon mode) becomes
 * the group for the rows after it.
 */
export function parseSpecText(text: string): SpecRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/ /g, " ").trimEnd())
    .filter((l) => l.trim() && l.trim() !== "?");
  const rows: SpecRow[] = [];
  let group: string | undefined;

  const tabbed = lines.filter((l) => l.includes("\t")).length;
  const colon = lines.filter((l) => /^[^:\t]{2,80}:\s+\S/.test(l.trim())).length;

  if (tabbed >= 2 || colon >= 2) {
    for (const line of lines) {
      if (tabbed >= 2 && line.includes("\t")) {
        const cells = line.split("\t").map((c) => c.trim()).filter(Boolean);
        if (cells.length === 1) group = cells[0];
        else if (cells.length === 2) rows.push({ group, label: cells[0], value: cells[1] });
        else {
          group = cells[0];
          rows.push({ group, label: cells[1], value: cells.slice(2).join(" · ") });
        }
        continue;
      }
      const m = /^([^:\t]{2,80}):\s+(.+)$/.exec(line.trim());
      if (m) rows.push({ group, label: m[1], value: m[2] });
      else if (line.trim().length <= SPEC_LIMITS.group) group = line.trim();
    }
    return cleanSpecRows(rows);
  }

  // one value per line: pair them up; a short line ending in ":" is a group heading
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.endsWith(":") && line.length <= SPEC_LIMITS.group) {
      group = line;
      continue;
    }
    const value = lines[i + 1]?.trim();
    if (!value) break;
    rows.push({ group, label: line, value });
    i++;
  }
  return cleanSpecRows(rows);
}

/** Rows grouped for display, keeping the original order of groups and rows. */
export function groupSpecs(rows: SpecRow[]): { group: string | null; rows: SpecRow[] }[] {
  const groups: { group: string | null; rows: SpecRow[] }[] = [];
  for (const r of rows) {
    const g = r.group ?? null;
    const last = groups[groups.length - 1];
    if (last && last.group === g) last.rows.push(r);
    else groups.push({ group: g, rows: [r] });
  }
  return groups;
}
