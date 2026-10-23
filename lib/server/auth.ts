import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { backendUrl } from "@/lib/api";
import { can, type Permission } from "@/lib/roles";
import type { UserRecord } from "@/lib/types";

/**
 * Who is calling this app's own helper routes (uploads, page scrapers, logo tracing,
 * cache refresh), and may they?
 *
 * The Flask API issued the caller's token and is the only one that can check it, so the
 * Bearer header is passed to its GET /auth/me. That answers with the account as it is in the
 * database right now - role included - and permissions are then the shared table in
 * lib/roles.ts, the same one the API uses.
 */
export async function actor(req: NextRequest): Promise<UserRecord | null> {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  try {
    const res = await fetch(`${backendUrl()}/auth/me`, {
      headers: { authorization, accept: "application/json" },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as UserRecord) : null;
  } catch {
    return null; // API unreachable: treated as not signed in
  }
}

/** null when the request may proceed, otherwise the 401/403 to answer with (the API's shapes). */
export async function requirePermission(req: NextRequest, permission: Permission): Promise<NextResponse | null> {
  const user = await actor(req);
  if (!user) return NextResponse.json({ error: "authentication required -- send a Bearer token" }, { status: 401 });
  if (!can(user.role, permission)) {
    return NextResponse.json({ error: "your role is not allowed to perform this action", role: user.role, permission }, { status: 403 });
  }
  return null;
}
