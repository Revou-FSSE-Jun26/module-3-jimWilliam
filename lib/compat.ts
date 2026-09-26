import { metaFor, type Kind, type Socket } from "@/lib/meta";
import type { Product } from "@/lib/types";

/**
 * Build planner rules. Everything is derived from data the catalogue already has - the socket
 * and memory type are parsed out of the Flask spec strings ("soket lga1851", "ddr5"), so the
 * checks also work for products an admin adds later from the dashboard.
 */

export type SlotId = "cpu" | "motherboard" | "ram" | "storage" | "gpu" | "psu" | "cooler" | "fan";

export interface Slot {
  id: SlotId;
  label: string;
  kinds: Kind[];
  required: boolean;
  /** category used when a product has no generated metadata */
  categoryId: number;
}

export const SLOTS: Slot[] = [
  { id: "cpu", label: "Processor", kinds: ["cpu"], required: true, categoryId: 1 },
  { id: "motherboard", label: "Motherboard", kinds: ["motherboard"], required: true, categoryId: 2 },
  { id: "ram", label: "Memory", kinds: ["ram"], required: true, categoryId: 3 },
  { id: "storage", label: "Storage", kinds: ["ssd", "hdd"], required: true, categoryId: 3 },
  { id: "gpu", label: "Graphics card", kinds: ["gpu"], required: false, categoryId: 4 },
  { id: "psu", label: "Power supply", kinds: ["psu"], required: true, categoryId: 5 },
  { id: "cooler", label: "CPU cooler", kinds: ["cooler"], required: false, categoryId: 5 },
  { id: "fan", label: "Case fan", kinds: ["fan"], required: false, categoryId: 5 },
];

export type Build = Partial<Record<SlotId, Product>>;

export type Severity = "error" | "warning" | "info" | "ok";

export interface Check {
  severity: Severity;
  title: string;
  detail: string;
  /** the slots this check is about, so the planner can show it on those slots directly */
  slots: SlotId[];
}

export type MemoryType = "DDR4" | "DDR5";

const text = (p: Product) => `${p.product_name} ${p.description ?? ""}`.toLowerCase();

export function socketOf(p: Product): Socket | null {
  const m = text(p).match(/\b(lga\s?1851|am5)\b/);
  if (m) return m[1].replace(/\s/g, "") === "am5" ? "AM5" : "LGA1851";
  return metaFor(p).socket;
}

export function memoryTypeOf(p: Product): MemoryType | null {
  const m = text(p).match(/\bddr([45])\b/);
  return m ? (`DDR${m[1]}` as MemoryType) : null;
}

const specNumber = (p: Product, label: RegExp) => {
  const row = p.specs?.find((r) => label.test(r.label));
  const n = row ? Number(row.value.replace(/[^\d]/g, "").slice(0, 4)) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** A memory kit's rated speed (its XMP/EXPO profile) and the default speed it falls back to. */
export function memorySpeedOf(p: Product): { rated: number; base: number | null } | null {
  const m = text(p).match(/\b(\d{4})\s?(mt\/s|mhz)\b/);
  const rated = specNumber(p, /^tested speed$/i) ?? (m ? Number(m[1]) : null);
  return rated ? { rated, base: specNumber(p, /^spd speed$/i) } : null;
}

/** Intel H-series boards (H810, H610) can't run memory above its default speed. */
const noMemoryOverclock = (board: Product) => /\bh\d{3}m?\b/i.test(board.product_name);

/** Rated output for a PSU ("650 watt", "650W"), otherwise null. */
export function psuWattsOf(p: Product): number | null {
  const m = text(p).match(/(\d{3,4})\s?(w\b|watt)/);
  return m ? Number(m[1]) : null;
}

export function drawOf(p: Product): number {
  const w = metaFor(p).watt;
  return w > 0 ? w : 0;
}

/** Which slot a product belongs in, from its generated kind or, failing that, its category. */
export function slotsFor(p: Product): SlotId[] {
  const kind = metaFor(p).kind;
  if (kind) return SLOTS.filter((s) => s.kinds.includes(kind)).map((s) => s.id);
  if (p.category_id === 1) return ["cpu"];
  if (p.category_id === 2) return ["motherboard"];
  if (p.category_id === 4) return ["gpu"];
  return [];
}

/** Board, drives, fans and chipset overhead that no single part accounts for. */
const PLATFORM_OVERHEAD_W = 60;
/** Keep sustained load around two-thirds of rating: efficient, quiet, and safe on GPU transients. */
const HEADROOM = 1.5;

export function estimateDraw(build: Build) {
  const parts = Object.entries(build)
    .filter(([slot]) => slot !== "psu")
    .reduce((sum, [, p]) => sum + (p ? drawOf(p) : 0), 0);
  const draw = parts + PLATFORM_OVERHEAD_W;
  const recommended = Math.ceil((draw * HEADROOM) / 50) * 50;
  return { draw, recommended };
}

export function checkBuild(build: Build): Check[] {
  const checks: Check[] = [];
  const { cpu, motherboard, ram, psu, gpu, cooler } = build;

  // 1. socket
  if (cpu && motherboard) {
    const a = socketOf(cpu);
    const b = socketOf(motherboard);
    if (a && b && a !== b) {
      checks.push({
        severity: "error",
        title: "Socket mismatch",
        detail: `The ${cpu.product_name} is an ${a} processor, but the ${motherboard.product_name} has an ${b} socket. Pick a matching pair.`,
        slots: ["cpu", "motherboard"],
      });
    } else if (a && b) {
      checks.push({ severity: "ok", title: `Socket ${a}`, detail: "Processor and motherboard match.", slots: ["cpu", "motherboard"] });
    }
  }

  // 2. memory generation
  if (ram && motherboard) {
    const want = memoryTypeOf(motherboard);
    const have = memoryTypeOf(ram);
    if (want && have && want !== have) {
      checks.push({
        severity: "error",
        title: `${have} memory on a ${want} board`,
        detail: `${have} and ${want} modules are keyed differently and physically won't seat. Choose ${want} memory for the ${motherboard.product_name}.`,
        slots: ["ram", "motherboard"],
      });
    } else if (want && have) {
      checks.push({ severity: "ok", title: `${have} memory`, detail: "Memory type matches the motherboard.", slots: ["ram"] });
    }
  }

  // 3. memory speed - a kit only reaches its rated speed where the board can load its profile
  const speed = ram && memorySpeedOf(ram);
  if (ram && motherboard && speed && speed.base && speed.rated > speed.base) {
    if (noMemoryOverclock(motherboard)) {
      checks.push({
        severity: "warning",
        title: `Memory runs at ${speed.base} MT/s`,
        detail: `The ${motherboard.product_name} can't overclock memory, so the ${ram.product_name} runs at its default ${speed.base} MT/s instead of its rated ${speed.rated}. A B- or Z-series board reaches the full speed.`,
        slots: ["ram", "motherboard"],
      });
    } else if (socketOf(motherboard) === "AM5" && /intel xmp/.test(text(ram)) && !/expo/.test(text(ram))) {
      checks.push({
        severity: "warning",
        title: "Intel XMP kit on an AMD board",
        detail: `The ${ram.product_name} ships with an Intel XMP profile only (no AMD EXPO) and is validated for Intel boards - on the ${motherboard.product_name} expect it to run below its rated ${speed.rated} MT/s.`,
        slots: ["ram", "motherboard"],
      });
    }
  }

  // 4. power
  const { draw, recommended } = estimateDraw(build);
  if (psu) {
    const rated = psuWattsOf(psu);
    if (rated !== null) {
      if (rated < draw) {
        checks.push({ severity: "error", title: "Power supply too small", detail: `Estimated load is ~${draw} W but the ${psu.product_name} is rated ${rated} W.`, slots: ["psu"] });
      } else if (rated < recommended) {
        checks.push({
          severity: "warning",
          title: "Tight on power",
          detail: `~${draw} W load on a ${rated} W supply leaves little headroom for GPU power spikes. ${recommended} W or more is recommended.`,
          slots: ["psu"],
        });
      } else {
        checks.push({ severity: "ok", title: `${rated} W is plenty`, detail: `~${draw} W estimated load, ${recommended} W recommended.`, slots: ["psu"] });
      }
    }
  }

  // 5. cooling - K-series Core Ultra and Ryzen X3D chips ship without a cooler in the box
  if (cpu && !cooler && /(\d{3}k\b|x3d)/i.test(cpu.product_name)) {
    checks.push({
      severity: "warning",
      title: "No cooler in the box",
      detail: `The ${cpu.product_name} doesn't include a cooler. Add one, or the system won't run.`,
      slots: ["cooler"],
    });
  }

  // 6. graphics
  if (cpu && !gpu) {
    checks.push({
      severity: "info",
      title: "Integrated graphics",
      detail: "No graphics card selected - the processor's built-in graphics will drive the display. Fine for work, not for modern games.",
      slots: ["gpu"],
    });
  }

  // 7. completeness
  const missing = SLOTS.filter((s) => s.required && !build[s.id]).map((s) => s.label.toLowerCase());
  if (missing.length) {
    checks.push({ severity: "info", title: "Not a complete build yet", detail: `Still needed: ${missing.join(", ")}.`, slots: [] });
  }

  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2, ok: 3 };
  return checks.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * Why a specific option would not fit the build as it stands, or null if it would. Used to
 * annotate the dropdowns, so an incompatible part is visible before it is picked.
 */
export function optionConflict(slot: SlotId, option: Product, build: Build): string | null {
  const { cpu, motherboard, ram } = build;
  if (slot === "motherboard" && cpu) {
    const need = socketOf(cpu);
    const has = socketOf(option);
    if (need && has && need !== has) return `${has} - won't fit the ${need} CPU`;
  }
  if (slot === "cpu" && motherboard) {
    const need = socketOf(motherboard);
    const has = socketOf(option);
    if (need && has && need !== has) return `${has} - won't fit the ${need} board`;
  }
  if (slot === "ram" && motherboard) {
    const need = memoryTypeOf(motherboard);
    const has = memoryTypeOf(option);
    if (need && has && need !== has) return `${has} - the board takes ${need}`;
  }
  if (slot === "motherboard" && ram) {
    const need = memoryTypeOf(ram);
    const has = memoryTypeOf(option);
    if (need && has && need !== has) return `${has} board - your memory is ${need}`;
  }
  if (slot === "psu") {
    const rated = psuWattsOf(option);
    const { draw } = estimateDraw(build);
    if (rated !== null && rated < draw) return `${rated} W - too small for ~${draw} W`;
  }
  return null;
}
