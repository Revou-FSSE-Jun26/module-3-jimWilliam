/**
 * The first-visit promotion: a one-time pop-up announcing new arrivals, led by one promoted
 * product. Change `id` to run a new campaign - every visitor sees the new one once.
 *
 * The Playwright fixture reads the campaign id and storage key from here to switch it off.
 */
import { STORAGE_KEYS } from "@/lib/storage-keys";

export const PROMO = {
  id: "new-arrivals-2026-09",
  /** the promoted product */
  productId: 21, // Corsair iCUE LINK TITAN II 360 RX LCD
  /** shown underneath as "also new" */
  alsoNew: [8, 12, 22, 23],
  eyebrow: "Just landed · Corsair iCUE LINK",
  pitch: 'A 5" IPS screen on the pump for live temps and GIFs, the FlowDrive 2 cooling engine and three RX120 RGB fans - ready for LGA1851 and AM5.',
  cta: "See the TITAN II",
};

/** localStorage key holding the id of the last campaign this browser has seen. */
export const PROMO_STORAGE_KEY = STORAGE_KEYS.promo;

/** Pages where a pop-up would get in the way of a task: admin, sign-in, paying. */
export const PROMO_SKIP_PATHS = ["/dashboard", "/login", "/register", "/cart", "/checkout"];
