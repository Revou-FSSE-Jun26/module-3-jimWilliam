"use client";

import { useId, type ReactNode } from "react";
import { cx, inputClasses } from "@/lib/classes";

/** Labelled text input or textarea with a character counter - the building block of the page editors. */
export function Field({
  label,
  value,
  onChange,
  max,
  rows,
  placeholder,
  hint,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  /** render a textarea with this many rows */
  rows?: number;
  placeholder?: string;
  hint?: string;
  testId?: string;
}) {
  const id = useId();
  const props = {
    id,
    value,
    maxLength: max,
    placeholder,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    className: cx(inputClasses, "py-2 text-sm", Boolean(rows) && "resize-y"),
    "data-testid": testId,
  };
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs text-dim">
          {label} {hint && <span className="text-faint">({hint})</span>}
        </label>
        <span className={cx("font-mono text-[0.6rem]", value.length >= max ? "text-amber" : "text-faint")}>
          {value.length}/{max}
        </span>
      </div>
      {rows ? <textarea rows={rows} {...props} /> : <input {...props} />}
    </div>
  );
}

/** A titled group inside an editor. */
export function EditorSection({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-line p-4">
      <legend className="px-1 font-mono text-[0.68rem] tracking-[0.16em] text-cyan uppercase">{title}</legend>
      {aside}
      {children}
    </fieldset>
  );
}

/** ↑ ↓ ✕ controls for a row in an editable list. */
export function RowControls({
  index,
  count,
  onMove,
  onRemove,
  name,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove?: () => void;
  name: string;
}) {
  const btn = "grid size-7 place-items-center rounded-md border border-line text-xs text-dim transition hover:border-cyan hover:text-cyan disabled:opacity-30";
  return (
    <div className="flex gap-1">
      <button type="button" className={btn} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move ${name} up`}>
        ↑
      </button>
      <button type="button" className={btn} disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={`Move ${name} down`}>
        ↓
      </button>
      {onRemove && (
        <button type="button" className={cx(btn, "hover:border-rose hover:text-rose")} onClick={onRemove} aria-label={`Remove ${name}`}>
          ✕
        </button>
      )}
    </div>
  );
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const NOUN: Record<string, string> = { slides: "Slide", pillars: "Card", skills: "Skill", projects: "Project" };

/** "slides[0].title is required" -> "Slide 1 title is required" */
export function humanize(message: string): string {
  return message
    .replace(/(\w+)\[(\d+)\]\.?/g, (_, list: string, i: string) => `${NOUN[list] ?? list} ${Number(i) + 1} `)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

/** Form-level error list, for the API's or the validator's messages. */
export function ErrorList({ errors, testId }: { errors: string[]; testId: string }) {
  if (!errors.length) return null;
  return (
    <ul role="alert" className="space-y-1 rounded-xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-rose" data-testid={testId}>
      {errors.map((e) => (
        <li key={e}>{humanize(e)}</li>
      ))}
    </ul>
  );
}
