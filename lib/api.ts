import type { ApiErrorBody } from "@/lib/types";

/**
 * Shared by the server and client API helpers.
 *
 * NEXT_PUBLIC_API_BASE_URL decides where every request goes. By default that is this app's
 * own /api (the mock of the Module 2 Flask API); set it to the Flask deployment and the whole
 * frontend talks to the real backend instead.
 */
export function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "/api";
  // An absolute URL (e.g. the Flask deployment) is used as-is, everywhere.
  if (!configured.startsWith("/")) return configured;
  // A relative base works as-is in the browser; the server needs an origin to resolve it against.
  if (typeof window !== "undefined") return configured;
  return `${serverOrigin()}${configured}`;
}

function serverOrigin(): string {
  // On Vercel production use the stable production domain: per-deployment URLs sit behind
  // Deployment Protection by default, and a server-side fetch to one would get a 401.
  const host =
    process.env.VERCEL_ENV === "production"
      ? (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL)
      : process.env.VERCEL_URL;
  return host ? `https://${host}` : `http://localhost:${process.env.PORT ?? 8100}`;
}

/** Thrown whenever a response is not ok, carrying the Flask-style `{ error, details }` body. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error || `request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  static async from(res: Response): Promise<ApiError> {
    let body: ApiErrorBody;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      body = { error: res.statusText || `request failed with status ${res.status}` };
    }
    return new ApiError(res.status, body);
  }

  /** "validation failed: price is required, stock_quantity must be ..." */
  get message_full(): string {
    const extra = this.body.details ?? this.body.fields;
    return extra?.length ? `${this.message}: ${extra.join(", ")}` : this.message;
  }
}

/** A human-readable message for anything a request might throw. */
export function describeError(e: unknown): string {
  if (e instanceof ApiError) return capitalise(e.message_full);
  if (e instanceof TypeError) return "Could not reach the server. Check your connection and try again.";
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
