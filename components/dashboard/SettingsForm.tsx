"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { ErrorList, Field } from "@/components/admin/fields";
import { ApiError, describeError } from "@/lib/api";
import { settingsApi, type LogoPreview } from "@/lib/api.client";
import { buttonVariants, cx, inputClasses } from "@/lib/classes";
import { DATE_STYLES, formatters, SETTINGS_LIMITS, splitWordmark, TIMEZONES, validateSettings, type SiteSettings } from "@/lib/settings";
import { toast } from "@/lib/toast";

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Live clock in the chosen time zone and format, so the admin sees the effect before saving. */
function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="panel space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="font-mono text-xs tracking-[0.2em] text-cyan uppercase">{title}</h2>
        {hint && <p className="mt-1 text-sm text-dim">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Dashboard -> Settings: shop name and tagline, the logo (any image, converted to SVG on the
 * server), time zone and date/time format, and contact details. The logo applies on its own
 * button; everything else saves with "Save settings". Both refresh the whole site - the root
 * layout reads these settings.
 */
export default function SettingsForm({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const now = useNow();
  const fileId = useId();

  // logo
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LogoPreview | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoVersion, setLogoVersion] = useState(initial.logo_version);

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => setData((d) => ({ ...d, [k]: v }));
  const fmt = formatters(data);
  const [first, second] = splitWordmark(data.shop_name || "Shop");

  async function save(e: FormEvent) {
    e.preventDefault();
    const found = validateSettings(data);
    setErrors(found);
    if (found.length) return;
    setSaving(true);
    try {
      const res = await settingsApi.save({ ...data, logo_version: logoVersion });
      setData(res.settings);
      toast.success("Settings saved");
      router.refresh();
    } catch (err) {
      setErrors(err instanceof ApiError ? (err.body.details ?? [err.message]) : [describeError(err)]);
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setPreview(null);
    setLogoError(null);
    if (f.size > 4 * 1024 * 1024) return setLogoError("Logos must be 4 MB or smaller.");
    setLogoBusy(true);
    try {
      setPreview(await settingsApi.previewLogo(f, f.name));
    } catch (err) {
      setLogoError(err instanceof ApiError ? (err.body.details?.[0] ?? err.message) : describeError(err));
    } finally {
      setLogoBusy(false);
    }
  }

  async function applyLogo() {
    if (!file) return;
    setLogoBusy(true);
    try {
      const res = await settingsApi.applyLogo(file, file.name);
      setLogoVersion(res.settings.logo_version);
      setFile(null);
      setPreview(null);
      toast.success("Logo updated");
      router.refresh();
    } catch (err) {
      setLogoError(err instanceof ApiError ? (err.body.details?.[0] ?? err.message) : describeError(err));
    } finally {
      setLogoBusy(false);
    }
  }

  async function resetLogo() {
    if (!window.confirm("Go back to the default logo?")) return;
    setLogoBusy(true);
    try {
      const res = await settingsApi.resetLogo();
      setLogoVersion(res.settings.logo_version);
      toast.success("Logo reset to the default");
      router.refresh();
    } catch (err) {
      toast.error(err);
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]" data-testid="settings">
      <form onSubmit={save} noValidate className="space-y-6" data-testid="settings-form">
        <ErrorList errors={errors} testId="settings-errors" />

        <Section title="General" hint="Shown in the header, the footer and the browser tab.">
          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
            <Field label="Shop name" value={data.shop_name} max={SETTINGS_LIMITS.shop_name} onChange={(v) => set("shop_name", v)} testId="set-name" />
            <Field label="Tagline" value={data.tagline} max={SETTINGS_LIMITS.tagline} onChange={(v) => set("tagline", v)} testId="set-tagline" />
          </div>
          <p className="text-xs text-faint">
            Browser tab: <span className="text-dim">{`${data.shop_name || "…"} — ${data.tagline || "PC parts"}`}</span>
          </p>
        </Section>

        <Section title="Time" hint="Every order date and time in the store is shown in this zone and format.">
          <div className="space-y-1">
            <label htmlFor="set-tz" className="text-xs text-dim">
              Time zone
            </label>
            <select id="set-tz" value={data.timezone} onChange={(e) => set("timezone", e.target.value)} className={cx(inputClasses, "cursor-pointer py-2 text-sm")} data-testid="set-timezone">
              {TIMEZONES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset className="space-y-1">
              <legend className="text-xs text-dim">Clock</legend>
              <div className="flex gap-2">
                {(["24h", "12h"] as const).map((c) => (
                  <label key={c} className={cx("flex-1 cursor-pointer rounded-xl border px-3 py-2 text-center font-mono text-xs transition", data.clock === c ? "border-cyan bg-cyan/10 text-cyan" : "border-line text-dim hover:border-line-bright")}>
                    <input type="radio" name="clock" value={c} checked={data.clock === c} onChange={() => set("clock", c)} className="sr-only" data-testid={`set-clock-${c}`} />
                    {c === "24h" ? "24-hour · 18:45" : "12-hour · 6:45 pm"}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="space-y-1">
              <label htmlFor="set-date" className="text-xs text-dim">
                Date style
              </label>
              <select id="set-date" value={data.date_style} onChange={(e) => set("date_style", e.target.value as SiteSettings["date_style"])} className={cx(inputClasses, "cursor-pointer py-2 text-sm")} data-testid="set-date-style">
                {DATE_STYLES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="rounded-xl border border-line bg-void/40 px-4 py-3 font-mono text-sm" data-testid="set-time-preview">
            <span className="text-faint">Now in the store: </span>
            {now ? fmt.dateTime(now.toISOString()) : "…"}
          </p>
        </Section>

        <Section title="Contact" hint="Shown in the footer on every page. Leave empty to hide.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Support email" value={data.support_email} max={SETTINGS_LIMITS.support_email} onChange={(v) => set("support_email", v)} testId="set-email" />
            <Field label="Support phone / WhatsApp" value={data.support_phone} max={SETTINGS_LIMITS.support_phone} onChange={(v) => set("support_phone", v)} testId="set-phone" />
          </div>
        </Section>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className={buttonVariants.primary} data-testid="settings-save">
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      <div className="space-y-6">
        <Section title="Logo" hint="Upload any image - PNG, JPG, WebP or SVG. It is converted to a vector (SVG) logo, which also becomes the browser-tab icon.">
          <div className="theme-storefront grid place-items-center gap-4 rounded-2xl border border-line bg-void p-6" data-testid="logo-current">
            <span className="flex items-center gap-3">
              <Image src={`/api/settings/logo?v=${logoVersion}`} alt="Current logo" width={120} height={60} unoptimized className="h-14 w-auto" style={{ width: "auto" }} />
              <span className="font-mono text-lg font-semibold tracking-[0.28em] uppercase">
                {first}
                <span className="text-cyan">{second}</span>
              </span>
            </span>
            <span className="flex items-center gap-2 font-mono text-[0.65rem] text-faint">
              Tab icon
              <Image src={`/api/settings/logo?variant=icon&v=${logoVersion}`} alt="" width={32} height={32} unoptimized className="size-8 rounded bg-surface" />
              <Image src={`/api/settings/logo?variant=icon&v=${logoVersion}`} alt="" width={16} height={16} unoptimized className="size-4" />
            </span>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-dim">
            <input type="checkbox" checked={data.logo_glow} onChange={(e) => set("logo_glow", e.target.checked)} className="size-4 accent-cyan" data-testid="set-glow" />
            Neon glow around the logo <span className="text-faint">(saved with the settings)</span>
          </label>

          <div className="space-y-2">
            <label
              htmlFor={fileId}
              className="grid cursor-pointer place-items-center rounded-xl border border-dashed border-line-bright px-4 py-5 text-center text-sm text-dim transition hover:border-cyan hover:text-cyan"
            >
              {logoBusy ? "Converting to SVG…" : "Choose a logo image"}
              <span className="text-xs text-faint">A plain or transparent background works best.</span>
            </label>
            <input
              id={fileId}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml"
              className="sr-only"
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = "";
              }}
              data-testid="logo-input"
            />
          </div>

          {logoError && (
            <p role="alert" className="text-sm text-rose" data-testid="logo-error">
              {logoError}
            </p>
          )}

          {preview && (
            <div className="space-y-3" data-testid="logo-preview">
              <div className="grid grid-cols-2 gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL of the SVG we just generated */}
                <img src={svgUrl(preview.svg)} alt="New logo on the dark theme" className="theme-storefront h-24 w-full rounded-xl bg-void object-contain p-3" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={svgUrl(preview.svg)} alt="New logo on white" className="h-24 w-full rounded-xl bg-white object-contain p-3" />
              </div>
              <p className="flex flex-wrap items-center gap-2 text-xs text-dim">
                Converted to SVG: {preview.paths} shape{preview.paths === 1 ? "" : "s"} in
                {preview.colours.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 font-mono">
                    <span className="size-3 rounded-sm border border-line" style={{ background: c }} />
                    {c}
                  </span>
                ))}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={applyLogo} disabled={logoBusy} className={buttonVariants.primary} data-testid="logo-apply">
                  Use this logo
                </button>
                <button type="button" onClick={() => (setPreview(null), setFile(null))} className={buttonVariants.ghost}>
                  Discard
                </button>
              </div>
            </div>
          )}

          <button type="button" onClick={resetLogo} disabled={logoBusy} className="text-xs text-faint hover:text-rose" data-testid="logo-reset">
            Reset to the default logo
          </button>
        </Section>
      </div>
    </div>
  );
}
