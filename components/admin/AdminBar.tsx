"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import type { Permission } from "@/lib/roles";
import { buttonVariants, cx } from "@/lib/classes";

/**
 * A slim strip shown only to admins, above a page they can edit in place: the homepage, the
 * About page, a product. "Edit" opens the editor in a modal; the editor calls `done` after a
 * successful save, which closes it and re-renders the page from the server so the change shows
 * straight away (the write already expired the page's cache tag).
 *
 * Customers never see it - and the page itself stays a Server Component, so rendering it for
 * everyone costs nothing but this small client island.
 */
export default function AdminBar({
  label,
  action,
  title,
  testId,
  permission,
  links,
  children,
}: {
  /** what this page is, e.g. "Homepage" or "Product #4" */
  label: string;
  /** the button text, e.g. "Edit homepage" */
  action: string;
  /** the modal's title */
  title: string;
  testId: string;
  /** the permission this editor needs; the bar is invisible without it */
  permission: Permission;
  links?: { href: string; label: string }[];
  children: (done: () => void, cancel: () => void) => ReactNode;
}) {
  const { can } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!can(permission)) return null;

  const done = () => {
    setOpen(false);
    router.refresh();
  };

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-magenta/40 bg-magenta/5 px-4 py-2.5 text-sm"
      data-testid={testId}
    >
      <span className="rounded-md bg-magenta/15 px-2 py-0.5 font-mono text-[0.62rem] tracking-[0.18em] text-magenta uppercase">Admin</span>
      <span className="text-dim">{label}</span>
      <span className="flex-1" />
      {links?.map((l) => (
        <Link key={l.href} href={l.href} className="font-mono text-xs text-faint hover:text-cyan">
          {l.label}
        </Link>
      ))}
      <button type="button" onClick={() => setOpen(true)} className={cx(buttonVariants.secondary, "px-3 py-1.5 text-xs")} data-testid={`${testId}-edit`}>
        ✎ {action}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} testId={`${testId}-modal`}>
        {children(done, () => setOpen(false))}
      </Modal>
    </div>
  );
}
