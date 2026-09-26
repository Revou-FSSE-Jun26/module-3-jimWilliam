"use client";

import { useEffect, useRef } from "react";

/**
 * Checkpoint 1 - vanilla DOM manipulation, on purpose.
 *
 * React renders only the empty shell below. Everything inside #dom-lab-list is created,
 * updated, class-toggled and removed with plain DOM APIs, and the buttons are wired with
 * addEventListener - the same techniques React abstracts away everywhere else in this app.
 * React never touches the list's children, so the two never fight over the same nodes.
 */
export default function DomLab() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // select elements
    const list = root.querySelector<HTMLUListElement>("#dom-lab-list")!;
    const input = root.querySelector<HTMLInputElement>("#dom-lab-input")!;
    const form = root.querySelector<HTMLFormElement>("#dom-lab-form")!;
    const counter = root.querySelector<HTMLSpanElement>("#dom-lab-count")!;
    const toggleAll = root.querySelector<HTMLButtonElement>("#dom-lab-toggle")!;
    const clear = root.querySelector<HTMLButtonElement>("#dom-lab-clear")!;

    // variables with explicit types, and a function that structures the logic
    let created: number = 0;
    const MAX_ITEMS: number = 8;

    const refreshCount = (): void => {
      const total: number = list.children.length;
      const picked: number = list.querySelectorAll(".is-picked").length;
      counter.textContent = `${total} item${total === 1 ? "" : "s"} · ${picked} picked`;
      list.dataset.empty = String(total === 0);
    };

    const addItem = (label: string): void => {
      if (list.children.length >= MAX_ITEMS) return;
      created += 1;

      // create elements
      const li = document.createElement("li");
      li.className = "dom-item";
      li.dataset.id = String(created);

      const text = document.createElement("span");
      text.textContent = label;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "✕";
      remove.setAttribute("aria-label", `Remove ${label}`);
      remove.className = "dom-remove";

      li.append(text, remove);
      list.appendChild(li);
      refreshCount();
    };

    // submit: prevent the browser's default full-page form submission
    const onSubmit = (e: SubmitEvent) => {
      e.preventDefault();
      const value = input.value.trim();
      if (!value) {
        input.classList.add("dom-shake");
        setTimeout(() => input.classList.remove("dom-shake"), 400);
        return;
      }
      addItem(value);
      input.value = "";
      input.focus();
    };

    // click delegation: one listener handles every current and future item
    const onListClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const li = target.closest<HTMLLIElement>("li.dom-item");
      if (!li) return;
      if (target.closest(".dom-remove")) li.remove(); // remove element
      else li.classList.toggle("is-picked"); // toggle class
      refreshCount();
    };

    const onToggleAll = () => {
      const items = list.querySelectorAll<HTMLLIElement>("li.dom-item");
      const anyUnpicked = Array.from(items).some((li) => !li.classList.contains("is-picked"));
      items.forEach((li) => li.classList.toggle("is-picked", anyUnpicked));
      refreshCount();
    };

    const onClear = () => {
      list.replaceChildren();
      refreshCount();
    };

    form.addEventListener("submit", onSubmit);
    list.addEventListener("click", onListClick);
    toggleAll.addEventListener("click", onToggleAll);
    clear.addEventListener("click", onClear);

    ["RTX 5070 12GB", "Ryzen 7 9850X3D", "Samsung 9100 Pro"].forEach(addItem);

    return () => {
      form.removeEventListener("submit", onSubmit);
      list.removeEventListener("click", onListClick);
      toggleAll.removeEventListener("click", onToggleAll);
      clear.removeEventListener("click", onClear);
      list.replaceChildren();
    };
  }, []);

  return (
    <div ref={rootRef} className="dom-lab space-y-4">
      <form id="dom-lab-form" className="flex gap-2">
        <label htmlFor="dom-lab-input" className="sr-only">
          Wishlist item
        </label>
        <input
          id="dom-lab-input"
          placeholder="Add a part to the wishlist…"
          className="h-10 flex-1 rounded-xl border border-line bg-void/70 px-3 text-sm focus:border-cyan focus:outline-none"
        />
        <button type="submit" className="rounded-xl bg-cyan px-4 font-mono text-xs font-semibold text-void uppercase">
          Add
        </button>
      </form>
      <ul id="dom-lab-list" className="grid gap-2" aria-live="polite" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id="dom-lab-count" className="font-mono text-xs text-dim" />
        <div className="flex gap-2">
          <button id="dom-lab-toggle" type="button" className="rounded-lg border border-line px-3 py-1.5 text-xs text-dim hover:border-cyan hover:text-cyan">
            Toggle all
          </button>
          <button id="dom-lab-clear" type="button" className="rounded-lg border border-line px-3 py-1.5 text-xs text-dim hover:border-rose hover:text-rose">
            Clear
          </button>
        </div>
      </div>
      {/* plain CSS for DOM-created nodes, since Tailwind cannot see classes added at runtime */}
      <style>{`
        .dom-lab .dom-item { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:.55rem .8rem;
          border:1px solid var(--color-line); border-radius:.75rem; background:var(--color-surface-2); cursor:pointer;
          font-size:.9rem; transition:border-color .15s, box-shadow .15s; }
        .dom-lab .dom-item:hover { border-color: var(--color-line-bright); }
        .dom-lab .dom-item.is-picked { border-color: var(--color-lime); box-shadow: inset 3px 0 0 var(--color-lime); }
        .dom-lab .dom-item.is-picked span { color: var(--color-dim); text-decoration: line-through; }
        .dom-lab .dom-remove { color: var(--color-faint); padding: 0 .25rem; }
        .dom-lab .dom-remove:hover { color: var(--color-rose); }
        .dom-lab ul[data-empty="true"]::before { content:"Wishlist is empty - add something above."; display:block; padding:1rem;
          text-align:center; color:var(--color-faint); font-size:.85rem; border:1px dashed var(--color-line); border-radius:.75rem; }
        .dom-lab .dom-shake { animation: dom-shake .35s; border-color: var(--color-rose) !important; }
        @keyframes dom-shake { 25% { transform: translateX(-4px) } 75% { transform: translateX(4px) } }
      `}</style>
    </div>
  );
}
