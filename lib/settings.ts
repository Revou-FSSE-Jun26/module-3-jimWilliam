/**
 * General store settings, edited by admins in Dashboard -> Settings and stored by the mock API
 * at /api/settings. The logo itself is stored separately (it is converted to SVG on upload -
 * see lib/server/logo.ts); `logo_version` changes whenever it does, to bust caches.
 *
 * Shared by the form, the API validation and the pages, so it has no imports.
 */
export interface SiteSettings {
  shop_name: string;
  tagline: string;
  /** IANA time zone every date and time in the store is shown in */
  timezone: string;
  clock: "24h" | "12h";
  date_style: "short" | "medium" | "long";
  support_email: string;
  support_phone: string;
  /** neon glow around the logo in the header */
  logo_glow: boolean;
  logo_version: number;
}

export const TIMEZONES: { id: string; label: string }[] = [
  { id: "Asia/Jakarta", label: "WIB — Jakarta, Sumatra, West & Central Kalimantan (UTC+7)" },
  { id: "Asia/Makassar", label: "WITA — Bali, Sulawesi, Nusa Tenggara (UTC+8)" },
  { id: "Asia/Jayapura", label: "WIT — Maluku, Papua (UTC+9)" },
  { id: "Asia/Singapore", label: "Singapore / Kuala Lumpur (UTC+8)" },
  { id: "UTC", label: "UTC" },
];

export const DATE_STYLES: { id: SiteSettings["date_style"]; label: string }[] = [
  { id: "short", label: "26/09/2026" },
  { id: "medium", label: "26 Sep 2026" },
  { id: "long", label: "Saturday, 26 September 2026" },
];

export const DEFAULT_SETTINGS: SiteSettings = {
  shop_name: "RevoTech",
  tagline: "PC parts, built for the next frame",
  timezone: "Asia/Jakarta",
  clock: "24h",
  date_style: "medium",
  support_email: "support@revotech.id",
  support_phone: "+62 21 5000 1234",
  logo_glow: true,
  logo_version: 1,
};

export const SETTINGS_LIMITS = { shop_name: 40, tagline: 120, support_email: 120, support_phone: 30 } as const;

/** Error messages for a settings document; empty when valid. `logo_version` is managed by the server. */
export function validateSettings(input: unknown): string[] {
  const s = (input ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const text = (k: keyof typeof SETTINGS_LIMITS, required: boolean) => {
    const v = s[k];
    if (typeof v !== "string") return void errors.push(`${k} must be text`);
    if (required && !v.trim()) errors.push(`${k} is required`);
    else if (v.length > SETTINGS_LIMITS[k]) errors.push(`${k} must be at most ${SETTINGS_LIMITS[k]} characters`);
  };
  text("shop_name", true);
  text("tagline", false);
  text("support_email", false);
  text("support_phone", false);
  if (typeof s.support_email === "string" && s.support_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.support_email.trim())) {
    errors.push("support_email must be an email address");
  }
  if (typeof s.support_phone === "string" && s.support_phone.trim() && !/^\+?[\d\s()-]{6,}$/.test(s.support_phone.trim())) {
    errors.push("support_phone may contain digits, spaces, ( ) - and a leading +");
  }
  if (!TIMEZONES.some((t) => t.id === s.timezone)) errors.push("timezone is not one of the supported zones");
  if (s.clock !== "24h" && s.clock !== "12h") errors.push("clock must be 24h or 12h");
  if (!DATE_STYLES.some((d) => d.id === s.date_style)) errors.push("date_style must be short, medium or long");
  if (typeof s.logo_glow !== "boolean") errors.push("logo_glow must be true or false");
  return errors;
}

/** Date and date-time formatters for the store's time zone and style. */
export function formatters(s: Pick<SiteSettings, "timezone" | "clock" | "date_style">) {
  const date: Intl.DateTimeFormatOptions =
    s.date_style === "short"
      ? { day: "2-digit", month: "2-digit", year: "numeric" }
      : s.date_style === "long"
        ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
        : { day: "numeric", month: "short", year: "numeric" };
  const time: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: s.clock === "12h" };
  const zone = { timeZone: s.timezone };
  // stored times are UTC without a suffix ("2026-09-18T08:55:00"); read them as UTC
  const parse = (iso: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  const zoneName = new Intl.DateTimeFormat("en-GB", { ...zone, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "";
  const label = TIMEZONES.find((t) => t.id === s.timezone)?.label.split(" ")[0] ?? zoneName;
  return {
    date: (iso: string) => parse(iso).toLocaleDateString("en-GB", { ...date, ...zone }),
    dateTime: (iso: string) => `${parse(iso).toLocaleString("en-GB", { ...date, ...time, ...zone })} ${label}`,
    time: (d: Date) => d.toLocaleTimeString("en-GB", { ...time, ...zone }),
    /** "WIB", "WITA", "UTC" ... */
    zone: label,
  };
}

/** "RevoTech" -> ["Revo", "Shop"], "Jim Store" -> ["Jim ", "Store"]: the second part is shown in the accent colour. */
export function splitWordmark(name: string): [string, string] {
  const space = name.lastIndexOf(" ");
  if (space > 0) return [name.slice(0, space + 1), name.slice(space + 1)];
  const cap = [...name].findLastIndex((c, i) => i > 0 && c >= "A" && c <= "Z");
  return cap > 0 ? [name.slice(0, cap), name.slice(cap)] : [name, ""];
}
