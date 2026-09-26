"use client";

import { useState, type FormEvent } from "react";
import { EditorSection, ErrorList, Field, moveItem, RowControls } from "@/components/admin/fields";
import { ApiError, describeError } from "@/lib/api";
import { contentApi } from "@/lib/api.client";
import { buttonVariants, cx } from "@/lib/classes";
import { FEATURED_MAX, LIMITS, validateHome, type HeroSlide, type HomeContent } from "@/lib/content";
import { toast } from "@/lib/toast";

type ProductOption = { product_id: number; product_name: string; is_active: boolean };

/**
 * Homepage editor: hero slide copy (per banner - show/hide, reorder, text, button, link), the
 * three "why RevoTech" cards, and the featured products heading and picks. Validated with the
 * same rules as PUT /api/content/home before it is sent.
 */
export default function HomeEditor({
  initial,
  products,
  onSaved,
  onCancel,
}: {
  initial: HomeContent;
  products: ProductOption[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState<HomeContent>(() => structuredClone(initial));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const setSlide = (i: number, patch: Partial<HeroSlide>) =>
    setData((d) => ({ ...d, slides: d.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const setPillar = (i: number, patch: Partial<HomeContent["pillars"][number]>) =>
    setData((d) => ({ ...d, pillars: d.pillars.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  const toggleFeatured = (id: number) =>
    setData((d) => ({
      ...d,
      featured_ids: d.featured_ids.includes(id) ? d.featured_ids.filter((x) => x !== id) : [...d.featured_ids, id],
    }));

  async function save(e: FormEvent) {
    e.preventDefault();
    const found = validateHome(data, products.map((p) => p.product_id));
    setErrors(found);
    if (found.length) return;
    setSaving(true);
    try {
      await contentApi.saveHome(data);
      toast.success("Homepage saved");
      onSaved();
    } catch (err) {
      setErrors(err instanceof ApiError ? (err.body.details ?? [err.message]) : [describeError(err)]);
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="space-y-5" data-testid="home-editor">
      <ErrorList errors={errors} testId="home-editor-errors" />

      <EditorSection title="Hero slides">
        <p className="text-xs text-faint">Each slide sits on its own banner artwork. Hide the ones you don&apos;t want, and reorder the rest.</p>
        {data.slides.map((s, i) => (
          <div key={s.id} className={cx("space-y-2.5 rounded-lg border p-3", s.visible ? "border-line" : "border-dashed border-line opacity-60")} data-testid="home-slide">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs text-magenta">
                {i + 1} · {s.id}
              </span>
              <label className="flex items-center gap-1.5 text-xs text-dim">
                <input type="checkbox" checked={s.visible} onChange={(e) => setSlide(i, { visible: e.target.checked })} className="accent-cyan" />
                Show
              </label>
              <span className="flex-1" />
              <RowControls index={i} count={data.slides.length} name={`slide ${i + 1}`} onMove={(a, b) => setData((d) => ({ ...d, slides: moveItem(d.slides, a, b) }))} />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Field label="Eyebrow" value={s.eyebrow} max={LIMITS.eyebrow} onChange={(v) => setSlide(i, { eyebrow: v })} />
              <Field label="Headline" value={s.title} max={LIMITS.title} onChange={(v) => setSlide(i, { title: v })} testId={`slide-${i}-title`} />
            </div>
            <Field label="Text" value={s.body} max={LIMITS.body} rows={2} onChange={(v) => setSlide(i, { body: v })} />
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Field label="Button" value={s.cta} max={LIMITS.cta} onChange={(v) => setSlide(i, { cta: v })} />
              <Field label="Button link" hint="/path or https://" value={s.href} max={LIMITS.href} onChange={(v) => setSlide(i, { href: v })} />
            </div>
          </div>
        ))}
      </EditorSection>

      <EditorSection title="Why RevoTech cards">
        {data.pillars.map((p, i) => (
          <div key={i} className="grid gap-2.5 sm:grid-cols-[1fr_1.6fr]">
            <Field label={`Card ${i + 1} title`} value={p.title} max={LIMITS.pillarTitle} onChange={(v) => setPillar(i, { title: v })} />
            <Field label="Text" value={p.body} max={LIMITS.pillarBody} rows={2} onChange={(v) => setPillar(i, { body: v })} />
          </div>
        ))}
      </EditorSection>

      <EditorSection title="Featured products">
        <div className="grid gap-2.5 sm:grid-cols-[1fr_2fr]">
          <Field label="Eyebrow" value={data.featured_eyebrow} max={LIMITS.eyebrow} onChange={(v) => setData((d) => ({ ...d, featured_eyebrow: v }))} />
          <Field label="Heading" value={data.featured_heading} max={LIMITS.heading} onChange={(v) => setData((d) => ({ ...d, featured_heading: v }))} testId="home-heading-input" />
        </div>
        <p className="text-xs text-faint">
          Pick up to {FEATURED_MAX}, in the order you want them. {data.featured_ids.length === 0 && "None picked: the first five in the catalogue are shown."}
        </p>
        <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-2" data-testid="featured-picker">
          {products.map((p) => {
            const pos = data.featured_ids.indexOf(p.product_id);
            const full = pos === -1 && data.featured_ids.length >= FEATURED_MAX;
            return (
              <li key={p.product_id}>
                <label className={cx("flex items-center gap-2 rounded-md px-2 py-1 text-xs", full ? "opacity-40" : "hover:bg-surface-2")}>
                  <input type="checkbox" checked={pos !== -1} disabled={full} onChange={() => toggleFeatured(p.product_id)} className="accent-cyan" />
                  <span className="grid size-4 place-items-center font-mono text-[0.6rem] text-cyan">{pos !== -1 ? pos + 1 : ""}</span>
                  <span className={cx("truncate", !p.is_active && "text-faint line-through")}>{p.product_name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </EditorSection>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className={buttonVariants.ghost}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={buttonVariants.primary} data-testid="home-editor-save">
          {saving ? "Saving…" : "Save homepage"}
        </button>
      </div>
    </form>
  );
}
