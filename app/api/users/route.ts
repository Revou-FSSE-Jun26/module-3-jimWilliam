import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/server/auth";
import { gate, readBody, respond } from "@/lib/server/http";
import { listUsers, registerUser } from "@/lib/server/store";

// GET /api/users -> every user, without passwords. Superadmins only (users:manage).
// Not in the Module 2 Flask API yet - see the README.
export async function GET(req: NextRequest) {
  const blocked = await gate();
  if (blocked) return blocked;
  const denied = requirePermission(req, "users:manage");
  if (denied) return denied;
  return respond(listUsers());
}

// POST /api/users -> 201 { message, user } | 400 { error, fields } | 409 email already registered
// Public: this is the register form. It always creates a customer.
export async function POST(req: NextRequest) {
  const blocked = await gate();
  if (blocked) return blocked;
  const body = await readBody(req);
  return body instanceof Response ? body : respond(registerUser(body));
}
