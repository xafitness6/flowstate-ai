import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AuthGate =
  | { ok: true; user: { id: string; email?: string | null } }
  | { ok: false; response: NextResponse };

const buckets = new Map<string, { count: number; resetAt: number }>();

export async function requireAuthenticatedUser(): Promise<AuthGate> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true, user: { id: user.id, email: user.email } };
}

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): NextResponse | null {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  existing.count += 1;
  if (existing.count <= options.limit) return null;

  return NextResponse.json(
    { error: "Rate limit exceeded. Try again shortly." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((existing.resetAt - now) / 1000)) },
    },
  );
}

export async function requireAiAccess(
  req: NextRequest,
  options: { limit?: number; windowMs?: number } = {},
): Promise<AuthGate> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;

  const limited = rateLimit(`ai:${auth.user.id}`, {
    limit: options.limit ?? 40,
    windowMs: options.windowMs ?? 60_000,
  });
  if (limited) return { ok: false, response: limited };

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 8 * 1024 * 1024) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Request body too large." }, { status: 413 }),
    };
  }

  return auth;
}

export function sameOriginUrl(req: NextRequest, value: unknown, fallbackPath: string): string {
  const fallback = new URL(fallbackPath, req.nextUrl.origin).toString();
  if (typeof value !== "string" || !value.trim()) return fallback;

  try {
    const url = new URL(value, req.nextUrl.origin);
    return url.origin === req.nextUrl.origin ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

export function appendQuery(urlString: string, params: Record<string, string>): string {
  const url = new URL(urlString);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function requireNonProductionDemoApi(): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  return NextResponse.json({ error: "Demo API disabled in production." }, { status: 404 });
}

// ─── Prompt-injection defenses for AI text inputs ───────────────────────────
// Caps a user-supplied text input and strips classic role-override / system-
// reveal payloads before it ever reaches the model. Returns a NextResponse if
// the input is too large; otherwise returns the cleaned, capped string.

const INJECTION_PATTERNS = [
  /ignore (all|any|previous|prior|the (above|earlier|previous)) (instructions?|prompts?|rules?|directives?)/gi,
  /(reveal|show|print|repeat|disclose|leak|output) (your|the) (system|initial|hidden) (prompt|instructions?|rules?)/gi,
  /you are (now|actually|really) (?!the|a flow|an? coach|an? trainer|in flowstate)/gi,
  /(disregard|forget|override) (everything|all|previous|prior)/gi,
];

export function sanitizeUserText(
  raw: unknown,
  options: { maxChars?: number; field?: string } = {},
): { ok: true; text: string } | { ok: false; response: NextResponse } {
  const max = options.maxChars ?? 4000;
  const field = options.field ?? "input";

  if (typeof raw !== "string") {
    return {
      ok: false,
      response: NextResponse.json({ error: `Missing ${field}.` }, { status: 400 }),
    };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      ok: false,
      response: NextResponse.json({ error: `Empty ${field}.` }, { status: 400 }),
    };
  }
  if (trimmed.length > max) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `${field} too long. Keep it under ${max} characters.` },
        { status: 413 },
      ),
    };
  }
  // Neutralize known injection patterns by surrounding them with brackets so
  // the model treats them as quoted user text, not commands.
  let cleaned = trimmed;
  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, (m) => `[user wrote: "${m}"]`);
  }
  return { ok: true, text: cleaned };
}
