import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { can, type Permission } from "@/lib/roles";
import { findUser } from "@/lib/server/store";
import type { UserRecord } from "@/lib/types";

/**
 * Who is making this request, and may they?
 *
 * The browser sends the signed-in user's id as `x-user-id` (lib/api.client.ts). The Flask API
 * reads the same thing out of the JWT it signed, so only this one line differs between the two
 * - which role may do what is decided in lib/roles.ts either way.
 *
 * Demo-grade on purpose: a header can be typed by hand, a signed token cannot. It is still a
 * real check rather than a hidden button, and the README says exactly how far it goes.
 */
export async function actor(req: NextRequest): Promise<UserRecord | null> {
  const id = Number(req.headers.get("x-user-id"));
  return Number.isInteger(id) && id > 0 ? findUser(id) : null;
}

/** null when the request may proceed, otherwise the 401/403 to answer with. */
export async function requirePermission(req: NextRequest, permission: Permission): Promise<NextResponse | null> {
  const user = await actor(req);
  if (!user) return NextResponse.json({ error: "authentication required" }, { status: 401 });
  if (!can(user.role, permission)) {
    return NextResponse.json({ error: "your role does not allow this", permission, role: user.role }, { status: 403 });
  }
  return null;
}

/** Signed in at all - for endpoints anyone with an account may use (placing an order). */
export async function requireUser(req: NextRequest): Promise<NextResponse | UserRecord> {
  return (await actor(req)) ?? NextResponse.json({ error: "authentication required" }, { status: 401 });
}
