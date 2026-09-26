"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ErrorList, Field } from "@/components/admin/fields";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { ApiError, describeError } from "@/lib/api";
import { api } from "@/lib/api.client";
import { buttonVariants, cx, inputClasses } from "@/lib/classes";
import { ROLE_BLURB, ROLE_LABEL } from "@/lib/roles";
import { toast } from "@/lib/toast";
import type { UserRecord } from "@/lib/types";

const MIN_PASSWORD = 8;

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="panel space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="font-mono text-xs tracking-[0.2em] text-cyan uppercase">{title}</h2>
        {hint && <p className="mt-1 text-sm text-dim">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Your own account: the profile the shop ships to, and your password. Everyone gets this page -
 * a customer, an admin and a superadmin all edit their own details the same way (PUT /users/:id
 * with no `role` field, which the API only accepts from a superadmin anyway).
 */
export default function AccountForm() {
  const { currentUser, login } = useAuth();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [profile, setProfile] = useState({ username: "", email: "", phone_number: "", address: "" });
  const [profileErrors, setProfileErrors] = useState<string[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ current_password: "", password: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<string[]>([]);
  const [savingPw, setSavingPw] = useState(false);

  const id = currentUser?.id;
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .user(id)
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setProfile({ username: u.username, email: u.email, phone_number: u.phone_number ?? "", address: u.address ?? "" });
      })
      .catch((e) => !cancelled && setLoadError(describeError(e)));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSavingProfile(true);
    setProfileErrors([]);
    try {
      const res = await api.updateUser(id, profile);
      setUser(res.user);
      // the header shows the name and the session carries the email, so refresh both
      login({ id: res.user.id, username: res.user.username, email: res.user.email, role: res.user.role });
      toast.success("Profile saved");
    } catch (err) {
      setProfileErrors(err instanceof ApiError ? (err.body.details ?? [err.message]) : [describeError(err)]);
      toast.error(err);
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    const found: string[] = [];
    if (!pw.current_password) found.push("enter your current password");
    if (pw.password.length < MIN_PASSWORD) found.push(`new password must be at least ${MIN_PASSWORD} characters`);
    if (pw.password !== pw.confirm) found.push("the two new passwords do not match");
    setPwErrors(found);
    if (found.length) return;
    setSavingPw(true);
    try {
      await api.updateUser(id, { current_password: pw.current_password, password: pw.password });
      setPw({ current_password: "", password: "", confirm: "" });
      toast.success("Password changed");
    } catch (err) {
      setPwErrors(err instanceof ApiError ? (err.body.details ?? [err.message]) : [describeError(err)]);
      toast.error(err);
    } finally {
      setSavingPw(false);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="panel border-rose/40 p-5 text-sm text-rose">
        {loadError}
      </p>
    );
  }
  if (!user) {
    return (
      <div className="grid gap-6 lg:grid-cols-2" aria-busy>
        <Skeleton className="h-80" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const role = user.role;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2" data-testid="account">
      <form onSubmit={saveProfile} noValidate className="space-y-4" data-testid="account-profile">
        <Panel title="Profile" hint="Your name and where orders are delivered.">
          <ErrorList errors={profileErrors} testId="account-profile-errors" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" value={profile.username} max={100} onChange={(v) => setProfile((p) => ({ ...p, username: v }))} testId="acc-username" />
            <Field label="Email" value={profile.email} max={150} onChange={(v) => setProfile((p) => ({ ...p, email: v }))} testId="acc-email" />
          </div>
          <Field label="Phone" hint="optional" value={profile.phone_number} max={20} onChange={(v) => setProfile((p) => ({ ...p, phone_number: v }))} testId="acc-phone" />
          <Field label="Shipping address" hint="optional" rows={3} value={profile.address} max={300} onChange={(v) => setProfile((p) => ({ ...p, address: v }))} testId="acc-address" />
          <div className="flex justify-end">
            <button type="submit" disabled={savingProfile} className={buttonVariants.primary} data-testid="acc-save">
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
          </div>
        </Panel>
      </form>

      <div className="space-y-6">
        <Panel title="Your role" hint="Only a superadmin can change this.">
          <p className="flex items-center gap-3">
            <span className="rounded-lg bg-magenta/15 px-2.5 py-1 font-mono text-xs tracking-[0.16em] text-magenta uppercase" data-testid="account-role">
              {ROLE_LABEL[role]}
            </span>
            <span className="text-sm text-dim">{ROLE_BLURB[role]}</span>
          </p>
        </Panel>

        <form onSubmit={savePassword} noValidate>
          <Panel title="Password" hint={`At least ${MIN_PASSWORD} characters. You need your current password to change it.`}>
            <ErrorList errors={pwErrors} testId="account-password-errors" />
            {(["current_password", "password", "confirm"] as const).map((k) => (
              <div key={k} className="space-y-1">
                <label htmlFor={`acc-${k}`} className="text-xs text-dim">
                  {k === "current_password" ? "Current password" : k === "password" ? "New password" : "Confirm new password"}
                </label>
                <input
                  id={`acc-${k}`}
                  type="password"
                  autoComplete={k === "current_password" ? "current-password" : "new-password"}
                  value={pw[k]}
                  onChange={(e) => setPw((v) => ({ ...v, [k]: e.target.value }))}
                  className={cx(inputClasses, "py-2 text-sm")}
                  data-testid={`acc-${k.replace("_", "-")}`}
                />
              </div>
            ))}
            <div className="flex justify-end">
              <button type="submit" disabled={savingPw} className={buttonVariants.secondary} data-testid="acc-password-save">
                {savingPw ? "Saving…" : "Change password"}
              </button>
            </div>
          </Panel>
        </form>
      </div>
    </div>
  );
}
