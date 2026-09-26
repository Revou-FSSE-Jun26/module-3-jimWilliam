"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api.client";
import { cx, inputClasses } from "@/lib/classes";
import type { Category } from "@/lib/types";

/**
 * Dropdown of categories, loaded from GET /categories when it mounts. Selecting one hands the
 * id to the parent, which pushes it into the URL and refetches GET /products?category_id=.
 */
export default function CategoryFilter({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (categoryId: string) => void;
  className?: string;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    api
      .categories(ac.signal)
      .then(setCategories)
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setFailed(true);
      });
    return () => ac.abort();
  }, []);

  return (
    <div className={cx("relative", className)}>
      <label htmlFor="category-filter" className="sr-only">
        Filter by category
      </label>
      <select
        id="category-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={failed}
        data-testid="category-filter"
        className={cx(inputClasses, "h-12 cursor-pointer appearance-none pr-10")}
      >
        <option value="">{failed ? "Categories unavailable" : "All categories"}</option>
        {categories.map((c) => (
          <option key={c.category_id} value={String(c.category_id)}>
            {c.category_name}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-faint"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
