// ─── PII-scrubbing server logger ─────────────────────────────────────────────
// Thin wrapper around console.* that strips known PII patterns BEFORE they
// reach Vercel logs / stderr. Use this in any server-side path that touches
// user input or third-party error blobs.
//
//   log.info("[coach]", "request received");
//   log.error("[stripe-webhook]", err);
//
// Scrubs: emails, phone numbers, bearer / API tokens, full UUIDs, Stripe ids,
// and any [user wrote: "..."] payloads that slipped through the input gate.
// See docs/legal/observability-plan.md for the full policy.

type Loggable = string | number | boolean | null | undefined | Error | object;

const PATTERNS: Array<[RegExp, string]> = [
  // Emails — keep just the shape, lose the address.
  [/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, "***@***"],
  // E.164-ish phone numbers (10–15 digits, optional +, optional separators).
  [/\b\+?\d[\d\s.\-()]{8,15}\d\b/g, "***-***-****"],
  // Bearer tokens.
  [/\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/g, "Bearer ***"],
  // OpenAI keys.
  [/\bsk-[A-Za-z0-9_-]{16,}\b/g, "sk-***"],
  [/\bpk-[A-Za-z0-9_-]{16,}\b/g, "pk-***"],
  // Stripe live + test keys.
  [/\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{16,}\b/g, "$1_$2_***"],
  // Resend keys.
  [/\bre_[A-Za-z0-9_-]{16,}\b/g, "re_***"],
  // Supabase management tokens.
  [/\bsbp_[A-Za-z0-9_-]{16,}\b/g, "sbp_***"],
  // Stripe ids — keep the prefix so we can find rows; scrub the body.
  [/\b(cus|sub|pi|ch|in|seti|si|cs|prod|price)_[A-Za-z0-9]{8,}\b/g, "$1_***"],
  // Full UUIDs → keep the first 8 chars so we can grep for a row.
  [/\b([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "$1-***"],
  // Anything our sanitizer flagged.
  [/\[user wrote:\s*"[^"]*"\]/g, "[user wrote: ***]"],
];

function scrub(value: Loggable): string {
  let str: string;
  if (value === null || value === undefined) str = String(value);
  else if (value instanceof Error) str = `${value.name}: ${value.message}`;
  else if (typeof value === "object") {
    try { str = JSON.stringify(value); } catch { str = "[unserializable]"; }
  }
  else str = String(value);

  for (const [pattern, replacement] of PATTERNS) {
    str = str.replace(pattern, replacement);
  }
  // Bound the line so a runaway error blob can't fill the log.
  if (str.length > 2000) str = str.slice(0, 2000) + " …[truncated]";
  return str;
}

function emit(level: "info" | "warn" | "error", parts: Loggable[]): void {
  const line = parts.map(scrub).join(" ");
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info:  (...parts: Loggable[]) => emit("info",  parts),
  warn:  (...parts: Loggable[]) => emit("warn",  parts),
  error: (...parts: Loggable[]) => emit("error", parts),
};

// Exposed for the (rare) caller that needs a scrubbed string without emitting.
export { scrub as scrubForLog };
