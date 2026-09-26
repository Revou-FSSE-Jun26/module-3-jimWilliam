import type { NextRequest } from "next/server";
import { actor } from "@/lib/server/auth";
import { gate, readBody, respond, toId } from "@/lib/server/http";
import { getUser, updateUser } from "@/lib/server/store";

// GET /api/users/:id -> the user without password | 404
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  const blocked = await gate();
  if (blocked) return blocked;
  const { id } = await ctx.params;
  return respond(getUser(toId(id)));
}

// PUT /api/users/:id -> 200 { message, user } | 400 { error, details } | 403 | 404 | 409
// Profile fields for yourself; a superadmin can also edit anyone, reset a password without
// knowing the old one, and change a role. lib/server/store.ts has the rules.
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  const blocked = await gate();
  if (blocked) return blocked;
  const who = actor(req);
  if (!who) return respond({ status: 401, body: { error: "authentication required" } });
  const { id } = await ctx.params;
  const body = await readBody(req);
  if (body instanceof Response) return body;
  return respond(updateUser(toId(id), body, { id: who.id, role: who.role }));
}
