"use client";

import { useId, useState, type ClipboardEvent } from "react";
import { ApiError, describeError } from "@/lib/api";
import { officialSpecs, specsFromHtml } from "@/lib/api.client";
import { buttonVariants, cx, inputClasses } from "@/lib/classes";
import { groupSpecs, parseSpecText, SPEC_LIMITS, type SpecRow } from "@/lib/specs";

const isHttpUrl = (s: string) => {
  try {
    return /^https?:$/.test(new URL(s).protocol);
  } catch {
    return false;
  }
};

/**
 * Technical specifications editor. Three ways in, all ending in the same editable rows:
 *   - Fetch specs: the server reads the spec page (or the official page) and extracts its table
 *   - Paste: the admin copies the spec table from the page in their own browser - which also
 *     works for sites that build the table with JavaScript - and the HTML on the clipboard is
 *     extracted the same way (plain text is parsed as a fallback)
 *   - by hand: add, edit, rename or remove rows and groups
 */
export default function SpecsEditor({
  rows,
  onRows,
  specsUrl,
  onSpecsUrl,
  officialUrl,
  productName,
}: {
  rows: SpecRow[];
  onRows: (rows: SpecRow[]) => void;
  specsUrl: string;
  onSpecsUrl: (url: string) => void;
  officialUrl: string;
  productName: string;
}) {
  const urlId = useId();
  const pasteId = useId();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [typed, setTyped] = useState("");

  const target = (specsUrl.trim() || officialUrl.trim()).trim();

  /** Replace the rows, asking first when that would throw away existing ones. */
  function take(next: SpecRow[], from: string) {
    if (!next.length) {
      setNote({ ok: false, text: `No specifications found in ${from}. Try selecting just the spec table, or add rows by hand.` });
      return false;
    }
    if (rows.length && !window.confirm(`Replace the ${rows.length} current rows with ${next.length} rows from ${from}?`)) return false;
    onRows(next);
    setNote({ ok: true, text: `${next.length} rows from ${from}. Check them before saving - remove anything that isn't a specification.` });
    return true;
  }

  async function fetchSpecs() {
    if (!isHttpUrl(target)) {
      setNote({ ok: false, text: "Enter the spec page or the official page address first (https://…)." });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await officialSpecs(target, productName);
      take(res.specs, new URL(res.url ?? target).hostname);
    } catch (e) {
      setNote({ ok: false, text: e instanceof ApiError ? e.message : describeError(e) });
    } finally {
      setBusy(false);
    }
  }

  async function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (!html && !text) return;
    e.preventDefault();
    setNote(null);
    let found: SpecRow[] = [];
    if (html) {
      setBusy(true);
      try {
        found = (await specsFromHtml(html, productName)).specs;
      } catch (err) {
        setNote({ ok: false, text: describeError(err) });
      } finally {
        setBusy(false);
      }
    }
    if (!found.length && text) found = parseSpecText(text);
    if (take(found, "the pasted table")) setTyped("");
    else if (!found.length) setTyped(text);
  }

  const update = (i: number, patch: Partial<SpecRow>) => onRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const renameGroup = (from: string | null, to: string) =>
    onRows(rows.map((r) => ((r.group ?? null) === from ? { ...r, group: to || undefined } : r)));
  const removeGroup = (group: string | null) => onRows(rows.filter((r) => (r.group ?? null) !== group));
  const addRow = () => onRows([...rows, { group: rows[rows.length - 1]?.group, label: "", value: "" }]);

  // where each group starts in the flat list, so the grouped inputs can edit rows[i]
  const groups = groupSpecs(rows);
  const starts = groups.map((_, gi) => groups.slice(0, gi).reduce((n, g) => n + g.rows.length, 0));

  return (
    <fieldset className="space-y-4 rounded-xl border border-line p-4" data-testid="specs-editor">
      <legend className="px-1 font-mono text-[0.68rem] tracking-[0.16em] text-cyan uppercase">Technical specifications</legend>

      <div className="space-y-1.5">
        <label htmlFor={urlId} className="text-sm text-dim">
          Spec page <span className="text-faint">(optional - when the specs are on their own page)</span>
        </label>
        <div className="flex gap-2">
          <input
            id={urlId}
            type="url"
            inputMode="url"
            value={specsUrl}
            onChange={(e) => onSpecsUrl(e.target.value)}
            placeholder={officialUrl.trim() || "Same as the official page"}
            className={inputClasses}
            data-testid="pf-specs-url"
          />
          <button type="button" onClick={fetchSpecs} disabled={busy || !target} className={cx(buttonVariants.secondary, "shrink-0 px-3")} data-testid="pf-fetch-specs">
            {busy ? "Reading…" : "Fetch specs"}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={pasteId} className="text-sm text-dim">
          Or paste the spec table
        </label>
        <textarea
          id={pasteId}
          rows={2}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onPaste={onPaste}
          placeholder="Open the official spec page, select the whole table, copy it (Ctrl C) and paste it here (Ctrl V). “Label: value” lines work too."
          className={cx(inputClasses, "resize-y text-sm")}
          data-testid="pf-specs-paste"
        />
        {typed.trim() && (
          <button
            type="button"
            onClick={() => take(parseSpecText(typed), "the text") && setTyped("")}
            className={cx(buttonVariants.ghost, "text-xs")}
            data-testid="pf-specs-parse"
          >
            Turn this text into rows
          </button>
        )}
      </div>

      {note && (
        <p className={cx("text-xs", note.ok ? "text-lime" : "text-amber")} role="status" data-testid="pf-specs-note">
          {note.text}
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-dim">
            Rows{" "}
            <span className="font-mono text-xs text-faint" data-testid="pf-specs-count">
              {rows.length}/{SPEC_LIMITS.rows}
            </span>
          </p>
          {rows.length > 0 && (
            <button type="button" onClick={() => window.confirm("Remove every specification row?") && onRows([])} className="text-xs text-rose hover:underline">
              Clear all
            </button>
          )}
        </div>

        {rows.length > 0 && (
          <div className="max-h-96 space-y-4 overflow-y-auto rounded-xl border border-line bg-void/40 p-3">
            {groups.map((g, gi) => (
              <div key={gi} className="space-y-1.5" data-testid="pf-spec-group">
                <div className="flex items-center gap-2">
                  <input
                    aria-label="Group name"
                    value={g.group ?? ""}
                    onChange={(e) => renameGroup(g.group, e.target.value)}
                    placeholder="(no group)"
                    maxLength={SPEC_LIMITS.group}
                    className="min-w-0 flex-1 border-b border-line bg-transparent py-1 font-mono text-[0.7rem] tracking-[0.12em] text-cyan uppercase outline-none placeholder:text-faint placeholder:normal-case focus:border-cyan"
                  />
                  <button type="button" onClick={() => removeGroup(g.group)} className="shrink-0 text-[0.7rem] text-faint hover:text-rose" aria-label={`Remove group ${g.group ?? "(no group)"}`}>
                    remove group
                  </button>
                </div>
                {g.rows.map((r, k) => {
                  const i = starts[gi] + k;
                  return (
                    <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-1.5" data-testid="pf-spec-row">
                      <input aria-label={`Label ${i + 1}`} value={r.label} maxLength={SPEC_LIMITS.label} onChange={(e) => update(i, { label: e.target.value })} className={cx(inputClasses, "px-2.5 py-1.5 text-xs")} />
                      <input aria-label={`Value ${i + 1}`} value={r.value} maxLength={SPEC_LIMITS.value} onChange={(e) => update(i, { value: e.target.value })} className={cx(inputClasses, "px-2.5 py-1.5 text-xs")} />
                      <button
                        type="button"
                        onClick={() => onRows(rows.filter((_, j) => j !== i))}
                        aria-label={`Remove ${r.label || `row ${i + 1}`}`}
                        className="grid size-8 place-items-center rounded-md border border-line text-xs text-dim hover:border-rose hover:text-rose"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {rows.length < SPEC_LIMITS.rows && (
          <button type="button" onClick={addRow} className={cx(buttonVariants.ghost, "text-xs")} data-testid="pf-spec-add">
            + Add row
          </button>
        )}
      </div>
    </fieldset>
  );
}
