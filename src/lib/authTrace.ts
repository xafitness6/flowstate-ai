// ─── Auth/identity diagnostic tracer (Phase 0) ───────────────────────────────
// Instrumentation ONLY — no behavior change. Wraps identity-related calls so we
// can see, from a real session, exactly which step is slow or failing.
//
// In the browser console:
//   __authTrace            → array of recent { event, ms, ok, error } records
//   dumpAuthTrace()        → a copy-pasteable text report (hand this back)
//
// Server-side (Vercel logs / terminal): each record prints as
//   [auth-trace] <event> ok=<bool> ms=<n> err=<message?>

export type AuthTraceRecord = {
  ts: string;        // ISO timestamp
  event: string;     // e.g. "getMyProfile", "AppShell.getSession"
  ms: number;        // duration
  ok: boolean;       // resolved without throw / without .error
  error?: string;    // error message if any
  detail?: string;   // optional extra context
};

const RING_MAX = 100;
const ring: AuthTraceRecord[] = [];

function record(rec: AuthTraceRecord) {
  ring.push(rec);
  if (ring.length > RING_MAX) ring.shift();

  // Console line — visible in browser devtools AND server logs.
  const line = `[auth-trace] ${rec.event} ok=${rec.ok} ms=${rec.ms}${rec.error ? ` err=${rec.error}` : ""}${rec.detail ? ` (${rec.detail})` : ""}`;
  if (rec.ok) console.info(line);
  else console.warn(line);

  if (typeof window !== "undefined") {
    (window as unknown as { __authTrace?: AuthTraceRecord[] }).__authTrace = ring;
  }
}

/** Wrap an async identity call. Records timing + outcome, never alters the result. */
export async function trace<T>(
  event: string,
  fn: () => PromiseLike<T>,
  opts?: { detail?: string; isError?: (v: T) => string | null },
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - start;
    const errMsg = opts?.isError ? opts.isError(result) : null;
    record({
      ts: new Date().toISOString(),
      event,
      ms,
      ok: !errMsg,
      error: errMsg ?? undefined,
      detail: opts?.detail,
    });
    return result;
  } catch (e) {
    record({
      ts: new Date().toISOString(),
      event,
      ms: Date.now() - start,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      detail: opts?.detail,
    });
    throw e;
  }
}

/** Synchronous marker (e.g. "AppShell: redirecting to X", "fallback persona used"). */
export function mark(event: string, detail?: string) {
  record({ ts: new Date().toISOString(), event, ms: 0, ok: true, detail });
}

export function getAuthTrace(): AuthTraceRecord[] {
  return [...ring];
}

if (typeof window !== "undefined") {
  (window as unknown as { dumpAuthTrace?: () => string }).dumpAuthTrace = () => {
    const text = ring
      .map((r) => `${r.ts}  ${r.event}  ok=${r.ok}  ${r.ms}ms${r.error ? `  ERR: ${r.error}` : ""}${r.detail ? `  (${r.detail})` : ""}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.log("=== AUTH TRACE (copy below) ===\n" + text + "\n=== END ===");
    return text;
  };
}
