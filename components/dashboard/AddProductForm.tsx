"use client";

import { useState, type FormEvent } from "react";
import ImageManager from "@/components/dashboard/ImageManager";
import SpecsEditor from "@/components/dashboard/SpecsEditor";
import { ApiError, describeError } from "@/lib/api";
import { officialPreview } from "@/lib/api.client";
import { buttonVariants, cx, inputClasses } from "@/lib/classes";
import type { Category, ProductInput, SpecRow } from "@/lib/types";

/** Every input is a string while editing; it only becomes a ProductInput once it validates. */
export interface FormState {
  product_name: string;
  category_id: string;
  price: string;
  stock_quantity: string;
  description: string;
  is_active: boolean;
  /** the manufacturer's product page, shown to buyers as "View on official site" */
  official_url: string;
  overview: string;
  /** set when the overview was imported from a page, so it can be credited */
  overview_source: string | null;
  images: string[];
  specs: SpecRow[];
  /** a separate spec page; blank means the specs come from the official page */
  specs_url: string;
}

export type FormErrors = Partial<Record<keyof FormState, string>>;

export const EMPTY_FORM: FormState = {
  product_name: "",
  category_id: "",
  price: "",
  stock_quantity: "0",
  description: "",
  is_active: true,
  official_url: "",
  overview: "",
  overview_source: null,
  images: [],
  specs: [],
  specs_url: "",
};

const MAX_OVERVIEW = 2000;

function isHttpUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Returns an error message per invalid field; an empty object means the form can be sent. */
export function validate(data: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!data.product_name.trim()) errors.product_name = "Product name is required.";
  else if (data.product_name.trim().length > 150) errors.product_name = "Keep it under 150 characters.";
  if (!data.category_id) errors.category_id = "Pick a category.";
  const price = Number(data.price);
  if (data.price.trim() === "" || Number.isNaN(price)) errors.price = "Price is required.";
  else if (price < 0) errors.price = "Price can't be negative.";
  const stock = Number(data.stock_quantity);
  if (!Number.isInteger(stock)) errors.stock_quantity = "Stock must be a whole number.";
  else if (stock < 0) errors.stock_quantity = "Stock can't be negative.";
  if (data.official_url.trim() && !isHttpUrl(data.official_url.trim())) {
    errors.official_url = "Use the full address, starting with https://";
  }
  if (data.overview.length > MAX_OVERVIEW) errors.overview = `Keep the overview under ${MAX_OVERVIEW} characters.`;
  if (data.specs_url.trim() && !isHttpUrl(data.specs_url.trim())) errors.specs_url = "Use the full address, starting with https://";
  return errors;
}

export const toInput = (d: FormState): ProductInput => ({
  product_name: d.product_name.trim(),
  category_id: Number(d.category_id),
  price: Number(d.price),
  stock_quantity: Number(d.stock_quantity),
  description: d.description.trim(),
  is_active: d.is_active,
  official_url: d.official_url.trim() || null,
  overview: d.overview.trim() || null,
  overview_source: d.overview.trim() ? d.overview_source : null,
  images: d.images,
  // half-filled rows are dropped rather than rejected
  specs: d.specs.filter((r) => r.label.trim() && r.value.trim()),
  specs_source: d.specs.length ? d.specs_url.trim() || d.official_url.trim() || null : null,
});

/**
 * The product form itself: controlled inputs, client-side validation with a message under
 * each field, and a slot for a form-level error from the server. It knows nothing about HTTP -
 * CreateProductForm and EditProductForm decide what submitting means.
 */
export default function AddProductForm({
  categories,
  initial = EMPTY_FORM,
  submitLabel = "Add product",
  onSubmit,
  serverError,
  onCancel,
}: {
  categories: Pick<Category, "category_id" | "category_name">[];
  initial?: FormState;
  submitLabel?: string;
  onSubmit: (data: ProductInput) => Promise<void> | void;
  serverError?: string | null;
  onCancel?: () => void;
}) {
  const [data, setData] = useState<FormState>(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<{ ok: boolean; text: string } | null>(null);

  // "Fetch summary": pull the manufacturer's own short summary for the official page into the
  // overview, credited to its source. The admin reviews and edits it before saving.
  async function importSummary() {
    const url = data.official_url.trim();
    if (!isHttpUrl(url)) {
      setErrors((e) => ({ ...e, official_url: "Enter the official page address first (https://…)." }));
      return;
    }
    if (data.overview.trim() && !window.confirm("Replace the current overview with the summary from the official page?")) return;
    setImporting(true);
    setImportNote(null);
    try {
      const s = await officialPreview(url);
      setData((d) => ({ ...d, overview: s.description ?? "", overview_source: s.url }));
      setImportNote({ ok: true, text: `Imported from ${new URL(s.url).hostname}. Review it before saving - it will be credited on the product page.` });
    } catch (e) {
      setImportNote({ ok: false, text: e instanceof ApiError ? e.message : describeError(e) });
    } finally {
      setImporting(false);
    }
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const handle = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = validate(data);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setSubmitting(true);
    try {
      await onSubmit(toInput(data));
    } finally {
      setSubmitting(false);
    }
  };

  const describe = (k: keyof FormState) => ({
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `pf-${k}-error` : undefined,
  });
  const message = (k: keyof FormState) =>
    errors[k] && (
      <p id={`pf-${k}-error`} className="text-xs text-rose" data-testid={`pf-error-${k}`}>
        {errors[k]}
      </p>
    );

  return (
    <form onSubmit={handle} noValidate className="grid gap-4 sm:grid-cols-2" data-testid="product-form">
      {serverError && (
        <p role="alert" className="rounded-xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-rose sm:col-span-2" data-testid="product-form-error">
          {serverError}
        </p>
      )}

      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="pf-name" className="text-sm text-dim">
          Product name
        </label>
        <input id="pf-name" value={data.product_name} onChange={(e) => set("product_name", e.target.value)} className={inputClasses} data-testid="pf-name" {...describe("product_name")} />
        {message("product_name")}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pf-category" className="text-sm text-dim">
          Category
        </label>
        <select id="pf-category" value={data.category_id} onChange={(e) => set("category_id", e.target.value)} className={cx(inputClasses, "cursor-pointer")} data-testid="pf-category" {...describe("category_id")}>
          <option value="">Choose…</option>
          {categories.map((c) => (
            <option key={c.category_id} value={String(c.category_id)}>
              {c.category_name}
            </option>
          ))}
        </select>
        {message("category_id")}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pf-price" className="text-sm text-dim">
          Price (IDR)
        </label>
        <input id="pf-price" type="number" inputMode="numeric" min={0} step={1000} value={data.price} onChange={(e) => set("price", e.target.value)} className={cx(inputClasses, "font-mono")} data-testid="pf-price" {...describe("price")} />
        {message("price")}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pf-stock" className="text-sm text-dim">
          Stock
        </label>
        <input id="pf-stock" type="number" inputMode="numeric" min={0} step={1} value={data.stock_quantity} onChange={(e) => set("stock_quantity", e.target.value)} className={cx(inputClasses, "font-mono")} data-testid="pf-stock" {...describe("stock_quantity")} />
        {message("stock_quantity")}
      </div>

      <label className="flex items-center gap-2.5 self-end pb-3 text-sm text-dim">
        <input type="checkbox" checked={data.is_active} onChange={(e) => set("is_active", e.target.checked)} className="size-4 accent-cyan" data-testid="pf-active" />
        Listed for sale
      </label>

      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="pf-desc" className="text-sm text-dim">
          Key features <span className="text-faint">(comma separated - shown on cards and at the top of the product page)</span>
        </label>
        <textarea id="pf-desc" rows={3} value={data.description} onChange={(e) => set("description", e.target.value)} className={cx(inputClasses, "resize-y")} placeholder="8 core, boost 5.6 ghz, soket am5" data-testid="pf-desc" />
      </div>

      <fieldset className="space-y-4 rounded-xl border border-line p-4 sm:col-span-2">
        <legend className="px-1 font-mono text-[0.68rem] tracking-[0.16em] text-cyan uppercase">Official page &amp; overview</legend>

        <div className="space-y-1.5">
          <label htmlFor="pf-official" className="text-sm text-dim">
            Official product page <span className="text-faint">(optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              id="pf-official"
              type="url"
              inputMode="url"
              placeholder="https://www.asus.com/…"
              value={data.official_url}
              onChange={(e) => set("official_url", e.target.value)}
              className={inputClasses}
              data-testid="pf-official"
              {...describe("official_url")}
            />
            <button
              type="button"
              onClick={importSummary}
              disabled={importing || !data.official_url.trim()}
              className={cx(buttonVariants.secondary, "shrink-0 px-3")}
              data-testid="pf-import"
            >
              {importing ? "Fetching…" : "Fetch summary"}
            </button>
          </div>
          {message("official_url")}
          {importNote && (
            <p className={cx("text-xs", importNote.ok ? "text-lime" : "text-amber")} data-testid="pf-import-note">
              {importNote.text}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="pf-overview" className="text-sm text-dim">
              Overview <span className="text-faint">(optional)</span>
            </label>
            <span className={cx("font-mono text-[0.65rem]", data.overview.length > MAX_OVERVIEW ? "text-rose" : "text-faint")}>
              {data.overview.length}/{MAX_OVERVIEW}
            </span>
          </div>
          <textarea
            id="pf-overview"
            rows={4}
            value={data.overview}
            onChange={(e) => set("overview", e.target.value)}
            className={cx(inputClasses, "resize-y")}
            placeholder="A short description buyers see above the specs. Write your own, or fetch the manufacturer's summary."
            data-testid="pf-overview"
            {...describe("overview")}
          />
          {message("overview")}
          {data.overview_source && data.overview.trim() && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-faint">
              Credited to {new URL(data.overview_source).hostname} on the product page.
              <button type="button" onClick={() => set("overview_source", null)} className="text-cyan hover:underline">
                Remove credit (I rewrote it)
              </button>
            </p>
          )}
        </div>
      </fieldset>

      <div className="space-y-1.5 sm:col-span-2">
        <SpecsEditor
          rows={data.specs}
          onRows={(rows) => set("specs", rows)}
          specsUrl={data.specs_url}
          onSpecsUrl={(url) => set("specs_url", url)}
          officialUrl={data.official_url}
          productName={data.product_name}
        />
        {message("specs_url")}
      </div>

      <div className="sm:col-span-2">
        <ImageManager value={data.images} onChange={(update) => setData((d) => ({ ...d, images: update(d.images) }))} />
      </div>

      <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className={buttonVariants.ghost}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={submitting} className={buttonVariants.primary} data-testid="pf-submit">
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
