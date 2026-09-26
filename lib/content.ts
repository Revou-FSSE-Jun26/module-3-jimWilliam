/**
 * Editable site content - the homepage hero, pillars and featured products, and the About
 * page's profile, skills and projects. Admins edit it in place (the "Edit homepage" / "Edit
 * about" bars) and it is stored by the mock API at /api/content/{home,about}.
 *
 * The defaults below are the seed. Validation lives here too, so the admin form and the API
 * reject exactly the same things. No imports: scripts/export-seed.mjs loads this file directly.
 */

export interface HeroSlide {
  /** which banner artwork the slide sits on (fixed - the art is generated per theme) */
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  /** an internal path (/products?category_id=4) or a full https:// link */
  href: string;
  visible: boolean;
}

export interface HomeContent {
  slides: HeroSlide[];
  pillars: { title: string; body: string }[];
  featured_eyebrow: string;
  featured_heading: string;
  /** products shown under the heading, in order; empty = the first five in the catalogue */
  featured_ids: number[];
}

export interface AboutContent {
  name: string;
  tagline: string;
  intro: string;
  skills: { name: string; note: string }[];
  projects: { name: string; meta: string; body: string; href: string }[];
}

export type ContentKey = "home" | "about";
export type SiteContent = { home: HomeContent; about: AboutContent };

export const FEATURED_MAX = 5;

export const DEFAULT_HOME: HomeContent = {
  slides: [
    {
      id: "new-arrivals",
      eyebrow: "New arrivals · Corsair iCUE",
      title: "Just landed: iCUE LINK TITAN II",
      body: "A 5\" LCD liquid cooler and Dominator Titanium DDR5-7600 — plus the MSI RTX 5070 Gaming Trio OC and new PCIe 4.0 SSDs.",
      cta: "See what's new",
      href: "/#new-arrivals",
      visible: true,
    },
    {
      id: "rtx-50",
      eyebrow: "Graphics · Blackwell",
      title: "RTX 50 series has landed",
      body: "GeForce RTX 5060 and 5070 with GDDR7 memory and DLSS 4 — 1440p gaming without the compromise.",
      cta: "Shop graphics cards",
      href: "/products?category_id=4",
      visible: true,
    },
    {
      id: "x3d-gaming",
      eyebrow: "Processors · Zen 5 X3D",
      title: "The fastest gaming CPU, in stock",
      body: "Ryzen 7 9850X3D: 3D V-Cache, a 5.6 GHz boost, and a drop-in fit for every AM5 board we carry.",
      cta: "See the 9850X3D",
      href: "/products/3",
      visible: true,
    },
    {
      id: "nvme-speed",
      eyebrow: "Storage · PCIe 5.0",
      title: "14,800 MB/s. Load screens, gone.",
      body: "Samsung 9100 Pro NVMe and fast DDR5 — the upgrades you feel on every boot.",
      cta: "Shop memory & storage",
      href: "/products?category_id=3",
      visible: true,
    },
    {
      id: "peripherals",
      eyebrow: "Peripherals",
      title: "Gear for the desk, not just the case",
      body: "Hot-swappable mechanical keyboards, 25K-sensor mice and high-refresh IPS monitors.",
      cta: "Shop peripherals",
      href: "/products?category_id=6",
      visible: true,
    },
    {
      id: "build-your-rig",
      eyebrow: "Build planner",
      title: "Pick the parts. We check the sockets.",
      body: "Choose one part per category and get a running total, a socket check and a PSU headroom warning before you pay.",
      cta: "Start a build",
      href: "/build",
      visible: true,
    },
  ],
  pillars: [
    { title: "Current generation only", body: "Core Ultra Plus, Ryzen 9000 X3D, RTX 50 and RDNA 4 — nothing a generation behind." },
    { title: "Socket-checked builds", body: "The build planner flags an LGA1851 chip in an AM5 board before it reaches your cart." },
    { title: "Priced in rupiah", body: "Indonesian street prices, stock counts you can trust, and low-stock warnings that mean it." },
  ],
  featured_eyebrow: "New arrivals",
  featured_heading: "Fresh drops for the next build",
  // the store's picks: the new Corsair, MSI, SanDisk and WD_BLACK parts
  featured_ids: [21, 8, 12, 22, 23],
};

export const DEFAULT_ABOUT: AboutContent = {
  name: "Jim",
  tagline: "Frontend developer — HTML, CSS, JavaScript, TypeScript, React",
  intro:
    "I built the RevoTech backend in Module 2 and this storefront on top of it in Module 3. I like getting the data model right before styling anything: every product here uses the same field names as the Flask API, so the types line up from the database to the component.",
  skills: [
    { name: "HTML5", note: "Semantic landmarks, accessible forms, meaningful headings." },
    { name: "CSS", note: "Box model, Grid, Flexbox, custom properties, media queries." },
    { name: "JavaScript", note: "DOM APIs, events, forEach / map / filter / reduce." },
    { name: "TypeScript", note: "Interfaces, type aliases, union types, strict mode." },
    { name: "Tailwind CSS", note: "Utility-first, mobile-first, v4 CSS-configured theme." },
    { name: "React & Next.js", note: "Server Components, App Router, context, view transitions." },
    { name: "Python & Flask", note: "REST APIs, SQLAlchemy, PostgreSQL, JWT auth." },
    { name: "Testing", note: "Playwright end-to-end suites against local and production." },
  ],
  projects: [
    {
      name: "RevoTech API",
      meta: "Module 2 · Flask · PostgreSQL",
      body: "REST API for a computer-parts store: five tables, full CRUD, orders with line items, and deletion guards that refuse to remove a product while active orders reference it.",
      href: "https://github.com/jim1504/Revou-revoshop-jim1504",
    },
    {
      name: "RevoTech Frontend",
      meta: "Module 3 · Next.js 16 · TypeScript · Tailwind v4",
      body: "This site. Live search and category filtering, cart and checkout, an admin dashboard with product and category CRUD, and a Playwright suite.",
      href: "/products",
    },
    {
      name: "Build Planner",
      meta: "Module 3 · Extra",
      body: "Pick one part per slot and get a running total, a socket compatibility check and a PSU headroom warning.",
      href: "/build",
    },
  ],
};

export const DEFAULT_CONTENT: SiteContent = { home: DEFAULT_HOME, about: DEFAULT_ABOUT };

export const LIMITS = {
  eyebrow: 40,
  title: 80,
  body: 240,
  cta: 30,
  href: 300,
  pillarTitle: 60,
  pillarBody: 200,
  heading: 80,
  name: 40,
  tagline: 120,
  intro: 1200,
  skills: 16,
  skillName: 40,
  skillNote: 160,
  projects: 9,
  projectName: 60,
  projectMeta: 80,
  projectBody: 400,
} as const;

/** An internal path ("/products?category_id=4") or a full http(s) link. */
export function isLink(s: string): boolean {
  if (/^\/(?!\/)/.test(s)) return true;
  try {
    return /^https?:$/.test(new URL(s).protocol);
  } catch {
    return false;
  }
}

type Check = (value: unknown, path: string) => void;

function checker() {
  const errors: string[] = [];
  const text: (max: number, required?: boolean) => Check = (max, required = true) => (v, path) => {
    if (typeof v !== "string") errors.push(`${path} must be text`);
    else if (required && !v.trim()) errors.push(`${path} is required`);
    else if (v.length > max) errors.push(`${path} must be at most ${max} characters`);
  };
  const link: Check = (v, path) => {
    text(LIMITS.href)(v, path);
    if (typeof v === "string" && v.trim() && !isLink(v.trim())) errors.push(`${path} must start with / or https://`);
  };
  const list = (v: unknown, path: string, min: number, max: number, each: (item: Record<string, unknown>, p: string) => void) => {
    if (!Array.isArray(v)) return void errors.push(`${path} must be a list`);
    if (v.length < min || v.length > max) errors.push(`${path} must have ${min === max ? min : `${min} to ${max}`} entries`);
    v.forEach((item, i) => (item && typeof item === "object" ? each(item, `${path}[${i}]`) : errors.push(`${path}[${i}] must be an object`)));
  };
  return { errors, text, link, list };
}

/** Error messages for a full HomeContent document; empty when it is valid. */
export function validateHome(input: unknown, productIds?: number[]): string[] {
  const { errors, text, link, list } = checker();
  const h = (input ?? {}) as Record<string, unknown>;
  list(h.slides, "slides", 1, DEFAULT_HOME.slides.length, (s, p) => {
    if (!DEFAULT_HOME.slides.some((d) => d.id === s.id)) errors.push(`${p}.id is not a known banner`);
    text(LIMITS.eyebrow)(s.eyebrow, `${p}.eyebrow`);
    text(LIMITS.title)(s.title, `${p}.title`);
    text(LIMITS.body)(s.body, `${p}.body`);
    text(LIMITS.cta)(s.cta, `${p}.cta`);
    link(s.href, `${p}.href`);
    if (typeof s.visible !== "boolean") errors.push(`${p}.visible must be true or false`);
  });
  if (Array.isArray(h.slides)) {
    if (!h.slides.some((s) => s?.visible === true)) errors.push("at least one slide must be visible");
    if (new Set(h.slides.map((s) => s?.id)).size !== h.slides.length) errors.push("each banner can be used once");
  }
  list(h.pillars, "pillars", 3, 3, (x, p) => {
    text(LIMITS.pillarTitle)(x.title, `${p}.title`);
    text(LIMITS.pillarBody)(x.body, `${p}.body`);
  });
  text(LIMITS.eyebrow)(h.featured_eyebrow, "featured_eyebrow");
  text(LIMITS.heading)(h.featured_heading, "featured_heading");
  if (!Array.isArray(h.featured_ids) || h.featured_ids.some((id) => !Number.isInteger(id))) {
    errors.push("featured_ids must be a list of product ids");
  } else {
    if (h.featured_ids.length > FEATURED_MAX) errors.push(`featured_ids can hold at most ${FEATURED_MAX} products`);
    if (new Set(h.featured_ids).size !== h.featured_ids.length) errors.push("featured_ids has duplicates");
    const unknown = productIds ? h.featured_ids.filter((id) => !productIds.includes(id)) : [];
    if (unknown.length) errors.push(`featured_ids: no product ${unknown.join(", ")}`);
  }
  return errors;
}

/** Error messages for a full AboutContent document; empty when it is valid. */
export function validateAbout(input: unknown): string[] {
  const { errors, text, link, list } = checker();
  const a = (input ?? {}) as Record<string, unknown>;
  text(LIMITS.name)(a.name, "name");
  text(LIMITS.tagline)(a.tagline, "tagline");
  text(LIMITS.intro)(a.intro, "intro");
  list(a.skills, "skills", 0, LIMITS.skills, (s, p) => {
    text(LIMITS.skillName)(s.name, `${p}.name`);
    text(LIMITS.skillNote, false)(s.note, `${p}.note`);
  });
  list(a.projects, "projects", 0, LIMITS.projects, (x, p) => {
    text(LIMITS.projectName)(x.name, `${p}.name`);
    text(LIMITS.projectMeta, false)(x.meta, `${p}.meta`);
    text(LIMITS.projectBody)(x.body, `${p}.body`);
    link(x.href, `${p}.href`);
  });
  return errors;
}

/** The products the homepage features: the chosen ones in order, else the first five. */
export function featuredProducts<T extends { product_id: number }>(content: HomeContent, products: T[]): T[] {
  if (!content.featured_ids.length) return products.slice(0, FEATURED_MAX);
  return content.featured_ids.map((id) => products.find((p) => p.product_id === id)).filter((p): p is T => Boolean(p));
}
