"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Native <dialog> opened with showModal(): the browser supplies the focus trap, Esc to close,
 * an inert page behind it and focus restoration afterwards.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
      data-testid={testId}
      className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-2xl border border-line-bright bg-surface p-0 text-ink shadow-[0_40px_120px_-30px_var(--color-cyan)] backdrop:bg-void/75 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <h2 id="modal-title" className="text-xl font-semibold">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-faint hover:bg-surface-2 hover:text-ink" aria-label="Close">
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
