"use client";

import { useState } from "react";
import { cx } from "@/lib/classes";
import { groupSpecs, type SpecRow } from "@/lib/specs";

/** Rows shown before "Show all" - enough for the headline figures without a wall of text. */
const PREVIEW_ROWS = 14;

/**
 * The manufacturer's specification table on the product page: grouped, two columns of groups
 * on wide screens, and collapsed to the first rows when the list is long (Intel publishes ~100).
 */
export default function SpecTable({ rows }: { rows: SpecRow[] }) {
  const [open, setOpen] = useState(false);
  const long = rows.length > PREVIEW_ROWS + 4; // don't hide just a couple of rows
  const shown = open || !long ? rows : rows.slice(0, PREVIEW_ROWS);

  return (
    <div className="space-y-4">
      <div className="gap-10">
        {groupSpecs(shown).map((g, i) => (
          <div key={i} className="mb-6 break-inside-avoid">
            {g.group && <h3 className="mb-1.5 font-mono text-[0.68rem] tracking-[0.16em] text-magenta uppercase">{g.group}</h3>}
            <table className="w-full text-sm" data-testid="spec-table">
              <tbody className="divide-y divide-line">
                {g.rows.map((r, j) => (
                  <tr key={j} data-testid="spec-row">
                    <th scope="row" className="w-2/5 py-2 pr-4 text-left align-top font-normal text-dim">
                      {r.label}
                    </th>
                    <td className="py-2 align-top break-words text-ink">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cx("font-mono text-xs tracking-[0.14em] text-cyan uppercase hover:underline")}
          data-testid="spec-toggle"
        >
          {open ? "Show fewer" : `Show all ${rows.length} specifications`}
        </button>
      )}
    </div>
  );
}
