import type { ApiErrorBody } from "@/lib/types";

/**
 * Shared by the server and client API helpers. The backend is the Flask API (Module 2).
 *
 *   browser   NEXT_PUBLIC_API_BASE_URL, "/api" by default. next.config.ts rewrites /api/* to the
 *             Flask API, so the browser only ever talks to this site (no CORS) - except for the
 *             few /api routes this app answers itself (uploads, page scrapers, logo, cache refresh).
 *   server    BACKEND_URL, the Flask API's own address, called directly.
 */
export function apiBase(): string {
  if (typeof window !== "undefined") return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "/api";
  return backendUrl();
}

/** The Flask API's origin, for server-side code. A local `waitress-serve --port=5000` by default. */
export function backendUrl(): string {
  return (process.env.BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");
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
      const json = (await res.json()) as ApiErrorBody & { msg?: string };
      // Flask-JWT-Extended's own errors use { msg } - normalise to { error }
      body = json.error ? json : { ...json, error: json.msg ?? res.statusText };
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
