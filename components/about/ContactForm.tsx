"use client";

import { useState, type FormEvent } from "react";
import { buttonVariants, cx, inputClasses } from "@/lib/classes";
import { toast } from "@/lib/toast";

type Topic = "general" | "bug" | "order" | "work";

interface ContactData {
  name: string;
  email: string;
  phone: string;
  topic: Topic;
  message: string;
  copy: boolean;
}

type ContactErrors = Partial<Record<keyof ContactData, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(d: ContactData): ContactErrors {
  const errors: ContactErrors = {};
  if (!d.name.trim()) errors.name = "Tell me your name.";
  if (!EMAIL_RE.test(d.email)) errors.email = "That email doesn't look right.";
  if (d.phone && !/^[+\d][\d\s-]{6,}$/.test(d.phone)) errors.phone = "Use digits, spaces or dashes.";
  if (d.message.trim().length < 10) errors.message = "A little more detail, please (10+ characters).";
  return errors;
}

const EMPTY: ContactData = { name: "", email: "", phone: "", topic: "general", message: "", copy: false };

export default function ContactForm() {
  const [data, setData] = useState<ContactData>(EMPTY);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [sent, setSent] = useState<ContactData | null>(null);

  const set = <K extends keyof ContactData>(k: K, v: ContactData[K]) => setData((d) => ({ ...d, [k]: v }));

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // no full-page reload - validate and handle it here
    const found = validate(data);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSent(data);
    setData(EMPTY);
    toast.success(`Thanks, ${data.name.split(" ")[0]} — message received.`);
  };

  if (sent) {
    return (
      <div className="panel space-y-3 p-6" role="status">
        <p className="font-mono text-xs tracking-[0.2em] text-lime uppercase">{"// "}message received</p>
        <p className="text-dim">
          Thanks, <span className="text-ink">{sent.name}</span>. This is a demo form, so nothing was emailed — but this is exactly
          what would be sent:
        </p>
        <pre className="overflow-x-auto rounded-xl border border-line bg-void/70 p-4 font-mono text-xs text-cyan">{JSON.stringify(sent, null, 2)}</pre>
        <button type="button" className={buttonVariants.secondary} onClick={() => setSent(null)}>
          Send another
        </button>
      </div>
    );
  }

  const field = (k: keyof ContactData) => ({
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `${k}-error` : undefined,
  });
  const err = (k: keyof ContactData) =>
    errors[k] && (
      <p id={`${k}-error`} className="text-xs text-rose">
        {errors[k]}
      </p>
    );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2" data-testid="contact-form">
      <div className="space-y-1.5">
        <label htmlFor="c-name" className="text-sm text-dim">
          Name
        </label>
        <input id="c-name" type="text" autoComplete="name" value={data.name} onChange={(e) => set("name", e.target.value)} className={inputClasses} {...field("name")} />
        {err("name")}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="c-email" className="text-sm text-dim">
          Email
        </label>
        <input id="c-email" type="email" autoComplete="email" value={data.email} onChange={(e) => set("email", e.target.value)} className={inputClasses} {...field("email")} />
        {err("email")}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="c-phone" className="text-sm text-dim">
          Phone <span className="text-faint">(optional)</span>
        </label>
        <input id="c-phone" type="tel" autoComplete="tel" placeholder="+62-812-0000-0000" value={data.phone} onChange={(e) => set("phone", e.target.value)} className={inputClasses} {...field("phone")} />
        {err("phone")}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="c-topic" className="text-sm text-dim">
          Topic
        </label>
        <select id="c-topic" value={data.topic} onChange={(e) => set("topic", e.target.value as Topic)} className={cx(inputClasses, "cursor-pointer")}>
          <option value="general">General question</option>
          <option value="bug">Report a bug</option>
          <option value="order">Order support</option>
          <option value="work">Work together</option>
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="c-message" className="text-sm text-dim">
          Message
        </label>
        <textarea id="c-message" rows={5} value={data.message} onChange={(e) => set("message", e.target.value)} className={cx(inputClasses, "resize-y")} {...field("message")} />
        {err("message")}
      </div>
      <label className="flex items-center gap-2.5 text-sm text-dim sm:col-span-2">
        <input type="checkbox" checked={data.copy} onChange={(e) => set("copy", e.target.checked)} className="size-4 accent-cyan" />
        Email me a copy
      </label>
      <div className="sm:col-span-2">
        <button type="submit" className={buttonVariants.primary}>
          Send message
        </button>
      </div>
    </form>
  );
}
