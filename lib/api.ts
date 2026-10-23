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
  const url = process.env.BACKEND_URL?.trim(); // a pasted value often carries a stray space
  // On Vercel there is no local API to fall back to. Say what is missing, instead of failing later
  // with "fetch failed ... ECONNREFUSED 127.0.0.1:5000" while the build prerenders the catalogue.
  if (!url && process.env.VERCEL) {
    throw new Error(
      "BACKEND_URL is not set. Add it under the Vercel project's Settings → Environment Variables (the Flask API's address, e.g. https://revotech-m2.vercel.app), then redeploy."
    );
  }
  // Without the scheme the /api rewrite is rejected ("Invalid rewrite found") and server fetches fail.
  if (url && !/^https?:\/\/[^\s/]+/.test(url)) {
    throw new Error(`BACKEND_URL must be a full address starting with https:// (e.g. https://revotech-m2.vercel.app), got "${url}".`);
  }
  return (url || "http://localhost:5000").replace(/\/+$/, "");
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
