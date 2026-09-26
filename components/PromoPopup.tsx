"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { useSettings } from "@/context/SettingsContext";
import { api } from "@/lib/api.client";
import { buttonVariants, cx } from "@/lib/classes";
import { formatIDR } from "@/lib/format";
import { galleryFor } from "@/lib/meta";
import { PROMO, PROMO_SKIP_PATHS, PROMO_STORAGE_KEY } from "@/lib/promo";
import type { Product } from "@/lib/types";

/** Let the page settle first, so the pop-up doesn't land on top of the first paint. */
const DELAY_MS = 1200;

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(PROMO_STORAGE_KEY) === PROMO.id;
  } catch {
    return true; // storage blocked: don't risk showing it on every page
  }
}

function markSeen() {
  try {
    localStorage.setItem(PROMO_STORAGE_KEY, PROMO.id);
  } catch {
    /* private mode - nothing to remember with */
  }
}

/**
 * New-arrivals pop-up, shown once per browser on the first page a visitor opens (not on the
 * admin, sign-in or checkout pages). Returning visitors cost nothing: the products are only
 * fetched when the pop-up is actually going to show. It is marked as seen the moment it opens,
 * so it never comes back - whether it was closed, clicked through or navigated away from.
 */
export default function PromoPopup() {
  const pathname = usePathname();
  const { shop_name } = useSettings();
  const [promo, setPromo] = useState<{ main: Product; others: Product[] } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (alreadySeen() || PROMO_SKIP_PATHS.some((p) => pathname.startsWith(p))) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const products = await api.products();
        const main = products.find((p) => p.product_id === PROMO.productId && p.is_active);
        if (cancelled || !main) return;
        const others = PROMO.alsoNew.map((id) => products.find((p) => p.product_id === id && p.is_active)).filter((p): p is Product => Boolean(p));
        setPromo({ main, others });
        setOpen(true);
        markSeen();
      } catch {
        /* the catalogue is unreachable - skip the promotion rather than show an error */
      }
    }, DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // only the first page of the visit decides; later navigation never re-triggers it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!promo) return null;
  const { main, others } = promo;
  const close = () => setOpen(false);

  return (
    <Modal open={open} onClose={close} title={`New arrivals at ${shop_name}`} testId="promo">
      <div className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-[1fr_1.1fr] sm:items-center">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-cyan/40 bg-void shadow-[0_0_40px_-12px_var(--color-cyan)]">
            <Image src={galleryFor(main)[0].src} alt={main.product_name} fill sizes="(min-width: 640px) 280px, 90vw" className="object-cover" />
            <span className="absolute top-3 left-3 rounded-md bg-magenta px-2 py-0.5 font-mono text-[0.62rem] tracking-[0.16em] text-void uppercase">New</span>
          </div>
          <div className="space-y-3">
            <p className="font-mono text-[0.68rem] tracking-[0.18em] text-cyan uppercase">{PROMO.eyebrow}</p>
            <h3 className="text-2xl leading-tight font-semibold text-balance" data-testid="promo-product">
              {main.product_name}
            </h3>
            <p className="text-sm text-dim">{PROMO.pitch}</p>
            <p className="font-mono text-2xl font-semibold tabular">{formatIDR(main.price)}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href={`/products/${main.product_id}`} onClick={close} className={buttonVariants.primary} data-testid="promo-cta">
                {PROMO.cta} →
              </Link>
              <button type="button" onClick={close} className={buttonVariants.ghost} data-testid="promo-later">
                Maybe later
              </button>
            </div>
          </div>
        </div>

        {others.length > 0 && (
          <div className="space-y-2 border-t border-line pt-4">
            <p className="font-mono text-[0.68rem] tracking-[0.16em] text-faint uppercase">Also new</p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {others.map((p) => (
                <li key={p.product_id}>
                  <Link
                    href={`/products/${p.product_id}`}
                    onClick={close}
                    className={cx("group block rounded-xl border border-line bg-void/40 p-2 transition hover:border-cyan")}
                    data-testid="promo-also"
                  >
                    <span className="relative block aspect-square overflow-hidden rounded-lg">
                      <Image src={galleryFor(p)[0].src} alt="" fill sizes="120px" className="object-cover" />
                    </span>
                    <span className="mt-1.5 line-clamp-2 block text-xs leading-snug group-hover:text-cyan">{p.product_name}</span>
                    <span className="block font-mono text-[0.68rem] text-dim tabular">{formatIDR(p.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
