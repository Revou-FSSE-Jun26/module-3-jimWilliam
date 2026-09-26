"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { ApiError, describeError } from "@/lib/api";
import { api } from "@/lib/api.client";
import { Skeleton } from "@/components/ui/Skeleton";
import { buttonVariants, cx, inputClasses } from "@/lib/classes";
import { ROLE_BLURB, ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { toast } from "@/lib/toast";
import type { UserRecord } from "@/lib/types";

const MIN_PASSWORD = 8;

const ROLE_STYLE: Record<Role, string> = {
  superadmin: "border-magenta/50 bg-magenta/10 text-magenta",
  admin: "border-cyan/50 bg-cyan/10 text-cyan",
  customer: "border-line text-dim",
};

/**
 * Superadmin only: who has an account, what each may do, and the two things only a superadmin
 * can do to someone else - change their role, and set a new password when they are locked out.
 *
 * The rules live in the API (lib/server/store.ts): nobody changes their own role, and the last
 * superadmin cannot be demoted. Here those cases are disabled with the reason shown, so the
 * button is never a trap.
 */
export default function UserManager() {
  const { currentUser } = useAuth();
  const { fmt } = useSettings();
  const [users, setUsers] = useState<UserRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [resetting, setResetting] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .users()
      .then((list) => !cancelled && setUsers(list))
      .catch((e) => !cancelled && setLoadError(describeError(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = (user: UserRecord) => setUsers((list) => (list ?? []).map((u) => (u.id === user.id ? user : u)));

  const fail = (id: number, e: unknown) => {
    const message = e instanceof ApiError ? (e.body.details?.[0] ?? e.message) : describeError(e);
    setRowError({ id, message });
    toast.error(e);
  };

  async function changeRole(user: UserRecord, role: Role) {
    setBusyId(user.id);
    setRowError(null);
    try {
      const res = await api.updateUser(user.id, { role });
      apply(res.user);
      toast.success(`${res.user.username} is now ${ROLE_LABEL[role].toLowerCase()}`);
    } catch (e) {
      fail(user.id, e);
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(user: UserRecord) {
    if (password.length < MIN_PASSWORD) return setRowError({ id: user.id, message: `password must be at least ${MIN_PASSWORD} characters` });
    setBusyId(user.id);
    setRowError(null);
    try {
      await api.updateUser(user.id, { password });
      setResetting(null);
      setPassword("");
      toast.success(`New password set for ${user.username}`);
    } catch (e) {
      fail(user.id, e);
    } finally {
      setBusyId(null);
    }
  }

  /** Why this user's role cannot be changed, or null when it can. */
  const locked = (user: UserRecord) => {
    if (user.id === currentUser?.id) return "You cannot change your own role";
    if (user.role === "superadmin" && superadmins === 1) return "The last superadmin cannot be demoted";
    return null;
  };

  if (loadError) {
    return (
      <p role="alert" className="panel border-rose/40 p-5 text-sm text-rose" data-testid="user-manager-error">
        {loadError}
      </p>
    );
  }
  if (!users) {
    return (
      <div className="space-y-3" aria-busy>
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  const superadmins = users.filter((u) => u.role === "superadmin").length;

  return (
    <div className="space-y-6" data-testid="user-manager">
      <ul className="grid gap-3 sm:grid-cols-3">
        {ROLES.map((role) => (
          <li key={role} className="panel p-4">
            <p className={cx("inline-flex rounded-lg border px-2 py-0.5 font-mono text-[0.65rem] tracking-[0.16em] uppercase", ROLE_STYLE[role])}>{ROLE_LABEL[role]}</p>
            <p className="mt-2 text-sm text-dim">{ROLE_BLURB[role]}</p>
            <p className="mt-2 font-mono text-xs text-faint">
              {users.filter((u) => u.role === role).length} {users.filter((u) => u.role === role).length === 1 ? "account" : "accounts"}
            </p>
          </li>
        ))}
      </ul>

      <section className="panel overflow-hidden" aria-labelledby="users-title">
        <div className="border-b border-line p-5">
          <h2 id="users-title" className="text-lg font-semibold">
            Accounts
          </h2>
          <p className="font-mono text-xs text-faint">{users.length} registered</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-200 text-sm" data-testid="users-table">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[0.66rem] tracking-[0.14em] text-faint uppercase">
                <th scope="col" className="px-5 py-3 font-normal">User</th>
                <th scope="col" className="px-3 py-3 font-normal">Joined</th>
                <th scope="col" className="px-3 py-3 font-normal">Role</th>
                <th scope="col" className="px-5 py-3 text-right font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const why = locked(u);
                return (
                  <tr key={u.id} className="border-b border-line/60 last:border-0 align-top hover:bg-surface-2/40" data-testid="user-row">
                    <td className="px-5 py-3">
                      <span className="font-medium">
                        {u.username}
                        {u.id === currentUser?.id && <span className="ml-2 font-mono text-[0.6rem] tracking-widest text-cyan uppercase">you</span>}
                      </span>
                      <span className="block font-mono text-[0.68rem] text-faint">{u.email}</span>
                      {rowError?.id === u.id && (
                        <span role="alert" className="mt-1 block text-xs text-rose" data-testid="user-row-error">
                          {rowError.message}
                        </span>
                      )}
                      {resetting === u.id && (
                        <span className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={`New password (${MIN_PASSWORD}+ characters)`}
                            className={cx(inputClasses, "w-56 py-1.5 text-xs")}
                            aria-label={`New password for ${u.username}`}
                            data-testid="user-new-password"
                          />
                          <button type="button" disabled={busyId === u.id} onClick={() => resetPassword(u)} className={cx(buttonVariants.primary, "px-3 py-1.5 text-xs")} data-testid="user-password-save">
                            Set password
                          </button>
                          <button type="button" onClick={() => (setResetting(null), setPassword(""))} className="text-xs text-faint hover:text-ink">
                            Cancel
                          </button>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-dim">{fmt.date(u.created_at)}</td>
                    <td className="px-3 py-3">
                      <select
                        value={u.role}
                        disabled={Boolean(why) || busyId === u.id}
                        title={why ?? `Change ${u.username}'s role`}
                        aria-label={`Role for ${u.username}`}
                        onChange={(e) => changeRole(u, e.target.value as Role)}
                        className={cx(inputClasses, "w-40 cursor-pointer py-1.5 font-mono text-xs disabled:cursor-not-allowed disabled:opacity-60")}
                        data-testid="user-role"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABEL[role]}
                          </option>
                        ))}
                      </select>
                      {why && <span className="mt-1 block text-[0.68rem] text-faint">{why}</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => (setResetting(resetting === u.id ? null : u.id), setPassword(""), setRowError(null))}
                        className={cx(buttonVariants.ghost, "px-3 py-1.5 text-xs whitespace-nowrap")}
                        data-testid="user-reset"
                      >
                        Reset password
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
