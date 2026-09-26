import type { NextRequest } from "next/server";
import { gate, readBody, respond } from "@/lib/server/http";
import { login } from "@/lib/server/store";

// POST /api/auth/login -> 200 { message, access_token, user } | 401 { error }
export async function POST(req: NextRequest) {
  const blocked = await gate();
  if (blocked) return blocked;
  const body = await readBody(req);
  return body instanceof Response ? body : respond(login(body));
}
