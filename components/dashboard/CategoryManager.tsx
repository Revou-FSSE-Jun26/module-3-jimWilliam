"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { describeError } from "@/lib/api";
import { api } from "@/lib/api.client";
import { buttonVariants, cx, inputClasses } from "@/lib/classes";
import { CATEGORY_ACCENT } from "@/lib/meta";
import { toast } from "@/lib/toast";
import type { Category } from "@/lib/types";

type Row = Category & { product_count?: number };

/** Controlled name input, validated non-empty, submitted with the same fetch pattern as CreateProductForm. */
export function CreateCategoryForm({ onCreated }: { onCreated: (c: Category) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.createCategory({ category_name: name.trim(), description: description.trim() });
      toast.success(`Created ${res.category.category_name}`);
      onCreated(res.category);
      setName("");
      setDescription("");
    } catch (err) {
      setError(describeError(err));
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="panel grid gap-4 p-5 md:grid-cols-[1fr_1.4fr_auto] md:items-start" data-testid="category-form">
      <div className="space-y-1.5">
        <label htmlFor="cat-name" className="text-sm text-dim">
          New category
        </label>
        <input
          id="cat-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g. Cases"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "cat-name-error" : undefined}
          className={inputClasses}
          data-testid="category-name"
        />
        {error && (
          <p id="cat-name-error" className="text-xs text-rose" data-testid="category-error">
            {error}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="cat-desc" className="text-sm text-dim">
          Description <span className="text-faint">(optional)</span>
        </label>
        <input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="atx, micro atx dan mini itx" className={inputClasses} />
      </div>
      <button type="submit" disabled={saving} className={cx(buttonVariants.primary, "md:mt-7")} data-testid="category-submit">
        {saving ? "Adding…" : "Add category"}
      </button>
    </form>
  );
}

export default function CategoryManager({ initialCategories }: { initialCategories: Row[] }) {
  const router = useRouter();
  const [categories, setCategories] = useState<Row[]>(initialCategories);
  const [editing, setEditing] = useState<{ id: number; name: string; description: string } | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setRowError({ id: editing.id, message: "Category name is required." });
      return;
    }
    try {
      const res = await api.updateCategory(editing.id, { category_name: editing.name.trim(), description: editing.description.trim() });
      setCategories((prev) => prev.map((c) => (c.category_id === editing.id ? { ...c, ...res.category } : c)));
      toast.success(`Saved ${res.category.category_name}`);
      setEditing(null);
      setRowError(null);
      router.refresh();
    } catch (e) {
      setRowError({ id: editing.id, message: describeError(e) });
      toast.error(e);
    }
  };

  const remove = async (c: Row) => {
    setRowError(null);
    try {
      await api.deleteCategory(c.category_id);
      setCategories((prev) => prev.filter((x) => x.category_id !== c.category_id));
      toast.success(`Deleted ${c.category_name}`);
      router.refresh();
    } catch (e) {
      // 409 while products still belong to it - shown on the row, in the backend's words
      setRowError({ id: c.category_id, message: describeError(e) });
      toast.error(e);
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <CreateCategoryForm
        onCreated={(c) => {
          setCategories((prev) => [...prev, { ...c, product_count: 0 }]);
          router.refresh();
        }}
      />

      <ul className="grid gap-3" data-testid="category-rows">
        {categories.map((c) => {
          const accent = CATEGORY_ACCENT[c.category_id] ?? "#9aa8bf";
          const isEditing = editing?.id === c.category_id;
          const error = rowError?.id === c.category_id ? rowError.message : null;
          return (
            <li key={c.category_id} className="panel p-4" data-testid="category-row">
              <div className="flex flex-wrap items-center gap-4">
                <span className="h-10 w-1 rounded-full" style={{ background: accent }} aria-hidden />
                {isEditing ? (
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_1.4fr]">
                    <label className="sr-only" htmlFor={`edit-name-${c.category_id}`}>
                      Name
                    </label>
                    <input
                      id={`edit-name-${c.category_id}`}
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      className={cx(inputClasses, "h-10 py-2")}
                      autoFocus
                    />
                    <label className="sr-only" htmlFor={`edit-desc-${c.category_id}`}>
                      Description
                    </label>
                    <input
                      id={`edit-desc-${c.category_id}`}
                      value={editing.description}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                      className={cx(inputClasses, "h-10 py-2")}
                    />
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.category_name}</p>
                    <p className="truncate text-sm text-dim first-letter:uppercase">{c.description || "—"}</p>
                  </div>
                )}
                <span className="font-mono text-xs text-faint tabular">{c.product_count ?? 0} products</span>
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <button type="button" onClick={saveEdit} className={cx(buttonVariants.primary, "px-3 py-1.5")}>
                        Save
                      </button>
                      <button type="button" onClick={() => setEditing(null)} className={cx(buttonVariants.ghost, "text-xs")}>
                        Cancel
                      </button>
                    </>
                  ) : confirmingId === c.category_id ? (
                    <>
                      <span className="text-xs text-rose">Are you sure?</span>
                      <button type="button" onClick={() => remove(c)} className={cx(buttonVariants.danger, "px-3 py-1.5")} data-testid="category-delete-yes">
                        Yes, delete
                      </button>
                      <button type="button" onClick={() => setConfirmingId(null)} className={cx(buttonVariants.ghost, "text-xs")}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRowError(null);
                          setEditing({ id: c.category_id, name: c.category_name, description: c.description ?? "" });
                        }}
                        className={cx(buttonVariants.ghost, "text-xs")}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRowError(null);
                          setConfirmingId(c.category_id);
                        }}
                        className={cx(buttonVariants.ghost, "text-xs hover:bg-rose/10 hover:text-rose")}
                        data-testid="category-delete"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              {error && (
                <p role="alert" className="mt-3 rounded-lg border border-rose/40 bg-rose/10 px-3 py-1.5 text-xs text-rose">
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
