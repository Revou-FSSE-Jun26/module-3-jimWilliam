"use client";

import { forwardRef, type KeyboardEvent } from "react";
import { cx, inputClasses } from "@/lib/classes";

export interface SearchBarProps {
  value: string;
  /** fires on every keystroke - the list filters live as you type */
  onChange: (value: string) => void;
  /** fires on Enter - callers use it to push the query into the URL */
  onSubmit?: (value: string) => void;
  placeholder?: string;
  id?: string;
  label?: string;
  className?: string;
  compact?: boolean;
}

/** Controlled search input. It owns no state, so the same component drives the header and the catalogue. */
const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { value, onChange, onSubmit, placeholder = "Search parts…", id = "search", label = "Search products", className, compact = false },
  ref
) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit?.(value.trim());
    }
    if (e.key === "Escape" && value) {
      e.preventDefault();
      onChange("");
    }
  };

  return (
    <div className={cx("relative", className)} role="search">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        ref={ref}
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        data-testid="search-input"
        className={cx(inputClasses, "pl-10", compact ? "h-10 py-2" : "h-12")}
      />
    </div>
  );
});

export default SearchBar;
