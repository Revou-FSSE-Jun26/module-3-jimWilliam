"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError, describeError } from "@/lib/api";
import { api } from "@/lib/api.client";
import { afterLoginPath, currentNext } from "@/lib/auth-redirect";
import { buttonVariants, cx, inputClasses } from "@/lib/classes";
import { toast } from "@/lib/toast";

export interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export type RegisterFormErrors = Partial<Record<keyof RegisterFormData | "form", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The four rules, checked before anything is sent. */
export function validateRegister(d: RegisterFormData): RegisterFormErrors {
  const errors: RegisterFormErrors = {};
  if (!d.username.trim()) errors.username = "Username is required.";
  if (!EMAIL_RE.test(d.email.trim())) errors.email = "Enter a valid email address.";
  if (d.password.length < 8) errors.password = "Password must be at least 8 characters.";
  if (d.confirmPassword !== d.password) errors.confirmPassword = "Passwords do not match.";
  return errors;
}

const FIELDS: { name: keyof RegisterFormData; label: string; type: string; autoComplete: string }[] = [
  { name: "username", label: "Username", type: "text", autoComplete: "username" },
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
  { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Confirm password", type: "password", autoComplete: "new-password" },
];

export default function RegisterForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [data, setData] = useState<RegisterFormData>({ username: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = validateRegister(data);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const res = await api.register({ username: data.username.trim(), email: data.email.trim(), password: data.password });
      // 201: keep { id, username, email } as the session, then go home
      login({ id: res.user.id, username: res.user.username, email: res.user.email, role: res.user.role });
      toast.success(`Welcome to RevoTech, ${res.user.username}!`);
      // home, or back to the page that sent them here (e.g. "Login to buy" -> create account)
      router.push(afterLoginPath("customer", currentNext()));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ email: "That email is already registered. Try logging in." });
      else setErrors({ form: describeError(err) });
      toast.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" data-testid="register-form">
      {errors.form && (
        <p role="alert" className="rounded-xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-rose" data-testid="form-error">
          {errors.form}
        </p>
      )}
      {FIELDS.map((f) => (
        <div key={f.name} className="space-y-1.5">
          <label htmlFor={`reg-${f.name}`} className="text-sm text-dim">
            {f.label}
          </label>
          <input
            id={`reg-${f.name}`}
            name={f.name}
            type={f.type}
            autoComplete={f.autoComplete}
            value={data[f.name]}
            onChange={(e) => setData((d) => ({ ...d, [f.name]: e.target.value }))}
            aria-invalid={errors[f.name] ? true : undefined}
            aria-describedby={errors[f.name] ? `reg-${f.name}-error` : undefined}
            className={inputClasses}
            data-testid={`register-${f.name}`}
          />
          {errors[f.name] && (
            <p id={`reg-${f.name}-error`} className="text-xs text-rose" data-testid={`error-${f.name}`}>
              {errors[f.name]}
            </p>
          )}
        </div>
      ))}
      <button type="submit" disabled={submitting} className={cx(buttonVariants.primary, "w-full py-3")} data-testid="register-submit">
        {submitting ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-dim">
        Already have an account?{" "}
        <Link
          href="/login"
          onClick={(e) => {
            // keep ?next= so logging in instead still returns them to where they started
            const next = currentNext();
            if (next) {
              e.preventDefault();
              router.push(`/login?next=${encodeURIComponent(next)}`);
            }
          }}
          className="text-cyan hover:underline"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
