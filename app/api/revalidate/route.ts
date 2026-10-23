import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { can, type Permission } from "@/lib/roles";
import { actor } from "@/lib/server/auth";
import { TAG } from "@/lib/server/cache-tags";

// POST /api/revalidate  { tags: ["catalog" | "content-home" | "content-about" | "settings"] }
//
// Writes go straight to the Flask API, so after a successful one the browser asks this route to
// expire the cached pages that show the data (lib/api.client.ts). Each tag needs what it takes to
// change that data - nobody else can make the site re-render on demand.
//   -> 200 { revalidated: [...] } | 400 | 401 | 403

/** What a caller needs per tag; null = any signed-in user. */
const NEEDS: Record<string, Permission | null> = {
  // any customer's order moves stock, which the catalogue pages show
  [TAG.catalog]: null,
  [TAG.content("home")]: "content:write",
  [TAG.content("about")]: "content:write",
  [TAG.settings]: "settings:write",
};

export async function POST(req: NextRequest) {
  let tags: unknown;
  try {
    ({ tags } = await req.json());
  } catch {
    return NextResponse.json({ error: "request body must be a JSON object" }, { status: 400 });
  }
  if (!Array.isArray(tags) || !tags.length || tags.some((t) => typeof t !== "string" || !(t in NEEDS))) {
    return NextResponse.json(
      { error: "validation failed", details: [`tags must be some of ${Object.keys(NEEDS).join(", ")}`] },
      { status: 400 }
    );
  }

  const unique = [...new Set(tags as string[])];
  const user = await actor(req); // one /auth/me call, however many tags
  if (!user) return NextResponse.json({ error: "authentication required -- send a Bearer token" }, { status: 401 });
  const missing = unique.map((tag) => NEEDS[tag]).find((permission) => permission && !can(user.role, permission));
  if (missing) {
    return NextResponse.json({ error: "your role is not allowed to perform this action", role: user.role, permission: missing }, { status: 403 });
  }
  for (const tag of unique) revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ revalidated: unique });
}
