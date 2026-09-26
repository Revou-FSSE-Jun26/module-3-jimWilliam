"use client";

import Image from "next/image";
import { useId, useState, type DragEvent } from "react";
import { ApiError, describeError } from "@/lib/api";
import { uploadImage } from "@/lib/api.client";
import { cx } from "@/lib/classes";
import { MAX_PRODUCT_IMAGES as MAX_IMAGES } from "@/lib/types";

/** Vercel rejects request bodies over 4.5 MB, so anything bigger is shrunk in the browser first. */
const SEND_LIMIT = 4 * 1024 * 1024;
const BROWSER_DECODABLE = /^image\/(jpeg|png|webp|gif|avif)$/;

interface QueueItem {
  key: string;
  name: string;
  status: "working" | "done" | "error";
  note: string;
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * Downscale a large photo to 2400px WebP in the browser so it fits the upload limit. The
 * server still does the real work - AVIF conversion, background, variants - on the result.
 */
async function shrinkIfNeeded(file: File): Promise<Blob> {
  if (file.size <= SEND_LIMIT || !BROWSER_DECODABLE.test(file.type)) return file;
  const bitmap = await createImageBitmap(file); // applies EXIF orientation
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/webp", quality: 0.92 });
}

/**
 * Product gallery editor: upload (click or drop, several at once), reorder, make primary,
 * remove. `onChange` receives an updater so uploads finishing in any order all land - each
 * one appends to the latest list rather than to a stale copy.
 */
export default function ImageManager({
  value,
  onChange,
}: {
  value: string[];
  onChange: (update: (prev: string[]) => string[]) => void;
}) {
  const inputId = useId();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);

  const room = MAX_IMAGES - value.length;
  const busy = queue.some((q) => q.status === "working");

  const note = (key: string, patch: Partial<QueueItem>) => setQueue((q) => q.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function addFiles(files: File[]) {
    const accepted = files.slice(0, Math.max(0, room));
    const skipped = files.length - accepted.length;
    const items = accepted.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, name: f.name, status: "working" as const, note: "converting to AVIF…" }));
    setQueue((q) => [...q.filter((i) => i.status !== "done"), ...items]);
    if (skipped > 0) {
      setQueue((q) => [...q, { key: `skip-${Date.now()}`, name: `${skipped} more`, status: "error", note: `a product can have at most ${MAX_IMAGES} images` }]);
    }

    for (let i = 0; i < accepted.length; i++) {
      const file = accepted[i];
      const key = items[i].key;
      // iPhone HEIC can't be decoded server-side; say so before uploading megabytes for nothing
      if (/\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/.test(file.type)) {
        note(key, { status: "error", note: "HEIC isn't supported — export it as JPG first (Photos → Export, or camera format ‘Most Compatible’)." });
        continue;
      }
      try {
        const body = await shrinkIfNeeded(file);
        const res = await uploadImage(body, file.name);
        onChange((prev) => (prev.length < MAX_IMAGES ? [...prev, res.url] : prev));
        note(key, { status: "done", note: `${kb(file.size)} ${res.source.format} → ${kb(res.bytes)} AVIF` });
      } catch (e) {
        const detail = e instanceof ApiError ? (e.body.details?.[0] ?? e.message) : describeError(e);
        note(key, { status: "error", note: detail });
      }
    }
  }

  const move = (from: number, to: number) =>
    onChange((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/") || /\.(heic|heif|tiff?)$/i.test(f.name));
    if (files.length) void addFiles(files);
  };

  return (
    <div className="space-y-3" data-testid="image-manager">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-sm text-dim">
          Images <span className="font-mono text-xs text-faint">{value.length}/{MAX_IMAGES}</span>
        </label>
        <p className="text-xs text-faint">JPG, PNG, WebP, GIF, TIFF or AVIF · converted to AVIF automatically · first = primary</p>
      </div>

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((src, i) => (
          <li key={src} className="group relative" data-testid="image-tile">
            <div className={cx("relative aspect-square overflow-hidden rounded-xl border bg-surface", i === 0 ? "border-cyan" : "border-line")}>
              <Image src={src} alt={`Product image ${i + 1}`} fill sizes="120px" className="object-cover" />
              <span
                className={cx(
                  "absolute top-1.5 left-1.5 rounded-md px-1.5 py-0.5 font-mono text-[0.6rem] uppercase",
                  i === 0 ? "bg-cyan text-void" : "bg-void/80 text-dim"
                )}
              >
                {i === 0 ? "Primary" : i + 1}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-1">
              <TileButton label={`Move image ${i + 1} left`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                ‹
              </TileButton>
              {i > 0 && (
                <TileButton label={`Make image ${i + 1} the primary image`} onClick={() => move(i, 0)}>
                  ★
                </TileButton>
              )}
              <TileButton label={`Move image ${i + 1} right`} disabled={i === value.length - 1} onClick={() => move(i, i + 1)}>
                ›
              </TileButton>
              <TileButton label={`Remove image ${i + 1}`} danger onClick={() => onChange((prev) => prev.filter((s) => s !== src))}>
                ✕
              </TileButton>
            </div>
          </li>
        ))}

        {room > 0 && (
          <li>
            <label
              htmlFor={inputId}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cx(
                "grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed text-center transition",
                dragging ? "border-cyan bg-cyan/10 text-cyan" : "border-line-bright text-faint hover:border-cyan hover:text-cyan"
              )}
            >
              <span className="px-2 text-xs">
                <span className="block text-2xl leading-none">+</span>
                {busy ? "Uploading…" : "Add or drop images"}
              </span>
            </label>
          </li>
        )}
      </ul>

      <input
        id={inputId}
        type="file"
        accept="image/*,.heic,.heif,.tif,.tiff"
        multiple
        className="sr-only"
        data-testid="image-input"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = ""; // allow picking the same file again
          if (files.length) void addFiles(files);
        }}
      />

      {queue.length > 0 && (
        <ul className="space-y-1" aria-live="polite" data-testid="image-status">
          {queue.map((q) => (
            <li
              key={q.key}
              className={cx("flex gap-2 text-xs", q.status === "error" ? "text-rose" : q.status === "done" ? "text-lime" : "text-dim")}
            >
              <span aria-hidden>{q.status === "error" ? "✕" : q.status === "done" ? "✓" : "…"}</span>
              <span className="truncate font-medium">{q.name}</span>
              <span className="text-faint">{q.note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TileButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "grid size-6 place-items-center rounded-md border border-line text-xs text-dim transition disabled:opacity-30",
        danger ? "hover:border-rose hover:text-rose" : "hover:border-cyan hover:text-cyan"
      )}
    >
      {children}
    </button>
  );
}
