"use client";

import { useState, type FormEvent } from "react";
import { EditorSection, ErrorList, Field, moveItem, RowControls } from "@/components/admin/fields";
import { ApiError, describeError } from "@/lib/api";
import { contentApi } from "@/lib/api.client";
import { buttonVariants, cx } from "@/lib/classes";
import { LIMITS, validateAbout, type AboutContent } from "@/lib/content";
import { toast } from "@/lib/toast";

type Skill = AboutContent["skills"][number];
type Project = AboutContent["projects"][number];

/**
 * About page editor: the profile (name, tagline, intro), skills and projects. The Checkpoint 1
 * labs below them are code, not content, and stay as they are.
 */
export default function AboutEditor({ initial, onSaved, onCancel }: { initial: AboutContent; onSaved: () => void; onCancel: () => void }) {
  const [data, setData] = useState<AboutContent>(() => structuredClone(initial));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const setSkill = (i: number, patch: Partial<Skill>) => setData((d) => ({ ...d, skills: d.skills.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const setProject = (i: number, patch: Partial<Project>) =>
    setData((d) => ({ ...d, projects: d.projects.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  async function save(e: FormEvent) {
    e.preventDefault();
    const found = validateAbout(data);
    setErrors(found);
    if (found.length) return;
    setSaving(true);
    try {
      await contentApi.saveAbout(data);
      toast.success("About page saved");
      onSaved();
    } catch (err) {
      setErrors(err instanceof ApiError ? (err.body.details ?? [err.message]) : [describeError(err)]);
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="space-y-5" data-testid="about-editor">
      <ErrorList errors={errors} testId="about-editor-errors" />

      <EditorSection title="Profile">
        <div className="grid gap-2.5 sm:grid-cols-[1fr_2fr]">
          <Field label="Name" value={data.name} max={LIMITS.name} onChange={(v) => setData((d) => ({ ...d, name: v }))} testId="about-name-input" />
          <Field label="Tagline" value={data.tagline} max={LIMITS.tagline} onChange={(v) => setData((d) => ({ ...d, tagline: v }))} />
        </div>
        <Field label="Introduction" value={data.intro} max={LIMITS.intro} rows={4} onChange={(v) => setData((d) => ({ ...d, intro: v }))} testId="about-intro-input" />
      </EditorSection>

      <EditorSection title={`Skills (${data.skills.length}/${LIMITS.skills})`}>
        {data.skills.map((s, i) => (
          <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_2fr_auto]" data-testid="about-skill">
            <Field label={`Skill ${i + 1}`} value={s.name} max={LIMITS.skillName} onChange={(v) => setSkill(i, { name: v })} />
            <Field label="Note" value={s.note} max={LIMITS.skillNote} onChange={(v) => setSkill(i, { note: v })} />
            <div className="pb-1.5">
              <RowControls
                index={i}
                count={data.skills.length}
                name={s.name || `skill ${i + 1}`}
                onMove={(a, b) => setData((d) => ({ ...d, skills: moveItem(d.skills, a, b) }))}
                onRemove={() => setData((d) => ({ ...d, skills: d.skills.filter((_, j) => j !== i) }))}
              />
            </div>
          </div>
        ))}
        {data.skills.length < LIMITS.skills && (
          <button type="button" onClick={() => setData((d) => ({ ...d, skills: [...d.skills, { name: "", note: "" }] }))} className={cx(buttonVariants.ghost, "text-xs")}>
            + Add skill
          </button>
        )}
      </EditorSection>

      <EditorSection title={`Projects (${data.projects.length}/${LIMITS.projects})`}>
        {data.projects.map((p, i) => (
          <div key={i} className="space-y-2.5 rounded-lg border border-line p-3" data-testid="about-project">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-magenta">Project {i + 1}</span>
              <RowControls
                index={i}
                count={data.projects.length}
                name={p.name || `project ${i + 1}`}
                onMove={(a, b) => setData((d) => ({ ...d, projects: moveItem(d.projects, a, b) }))}
                onRemove={() => setData((d) => ({ ...d, projects: d.projects.filter((_, j) => j !== i) }))}
              />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Field label="Name" value={p.name} max={LIMITS.projectName} onChange={(v) => setProject(i, { name: v })} />
              <Field label="Meta" hint="module · stack" value={p.meta} max={LIMITS.projectMeta} onChange={(v) => setProject(i, { meta: v })} />
            </div>
            <Field label="Description" value={p.body} max={LIMITS.projectBody} rows={2} onChange={(v) => setProject(i, { body: v })} />
            <Field label="Link" hint="/path or https://" value={p.href} max={LIMITS.href} onChange={(v) => setProject(i, { href: v })} />
          </div>
        ))}
        {data.projects.length < LIMITS.projects && (
          <button
            type="button"
            onClick={() => setData((d) => ({ ...d, projects: [...d.projects, { name: "", meta: "", body: "", href: "" }] }))}
            className={cx(buttonVariants.ghost, "text-xs")}
          >
            + Add project
          </button>
        )}
      </EditorSection>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className={buttonVariants.ghost}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={buttonVariants.primary} data-testid="about-editor-save">
          {saving ? "Saving…" : "Save about page"}
        </button>
      </div>
    </form>
  );
}
