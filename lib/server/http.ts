import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import type { Result } from "@/lib/server/store";

export const respond = (r: Result) => NextResponse.json(r.body, { status: r.status });

/** Parse a JSON body, answering 400 the way Flask does when it is missing or malformed. */
export async function readBody(req: NextRequest): Promise<Record<string, unknown> | NextResponse> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  return NextResponse.json({ error: "request body must be a JSON object" }, { status: 400 });
}

/** Route ids arrive as strings; anything that is not a positive integer is simply "not found". */
export const toId = (raw: string) => (/^\d+$/.test(raw) ? Number(raw) : -1);

/**
 * Demo switches, so loading.tsx and error.tsx can be shown on demand - an in-process API
 * cannot be "stopped" the way the Flask one could:
 *   MOCK_API_LATENCY_MS=1500  delay every response (loading skeletons)
 *   MOCK_API_DOWN=1           answer 503 to everything (error boundaries)
 */
export async function gate(): Promise<NextResponse | null> {
  const latency = Number(process.env.MOCK_API_LATENCY_MS ?? 0);
  if (latency > 0) await new Promise((r) => setTimeout(r, latency));
  if (process.env.MOCK_API_DOWN === "1") {
    return NextResponse.json({ error: "service unavailable (MOCK_API_DOWN=1)" }, { status: 503 });
  }
  return null;
}
