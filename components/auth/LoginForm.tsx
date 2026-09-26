"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError, describeError } from "@/lib/api";
import { api } from "@/lib/api.client";
import { afterLoginPath } from "@/lib/auth-redirect";
import { buttonVariants, cx, inputClasses } from "@/lib/classes";
import { toast } from "@/lib/toast";

const DEMO = [
  { label: "Superadmin", email: "andi.pratama@example.com" },
  { label: "Admin", email: "budi.santoso@example.com" },
  { label: "Customer", email: "siti.rahayu@example.com" },
];

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.login({ email: email.trim(), password });
      login({ id: res.user.id, username: res.user.username, email: res.user.email, role: res.user.role });
      toast.success(`Welcome back, ${res.user.username}`);
      // admins land on the dashboard; customers go back to where they were, or home
      router.push(afterLoginPath(res.user.role, searchParams.get("next")));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Invalid email or password" : describeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" data-testid="login-form">
      {error && (
        <p role="alert" className="rounded-xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-rose" data-testid="login-error">
          {error}
        </p>
      )}
      <div className="space-y-1.5">
        <label htmlFor="login-email" className="text-sm text-dim">
          Email
        </label>
        <input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} data-testid="login-email" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="login-password" className="text-sm text-dim">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClasses}
          data-testid="login-password"
        />
      </div>
      <button type="submit" disabled={submitting} className={cx(buttonVariants.primary, "w-full py-3")} data-testid="login-submit">
        {submitting ? "Signing in…" : "Log in"}
      </button>

      <div className="rounded-xl border border-dashed border-line-bright p-4">
        <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faint uppercase">Demo accounts · password123</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => {
                setEmail(d.email);
                setPassword("password123");
              }}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-dim transition hover:border-cyan hover:text-cyan"
            >
              {d.label} · {d.email}
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-sm text-dim">
        New here?{" "}
        <Link href={searchParams.get("next") ? `/register?next=${encodeURIComponent(searchParams.get("next")!)}` : "/register"} className="text-cyan hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
