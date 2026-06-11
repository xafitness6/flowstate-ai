# Observability Plan

Goal: see what the app is doing in production well enough to fix problems fast, without ever shipping a user's PII to a third-party logging service.

## Today (in-tree)

### PII-scrubbing logger — `src/lib/server/log.ts`

A thin wrapper around `console.*` that scrubs known PII patterns before the line is written. Use it instead of `console.error` / `console.log` in server-side code that touches user input or third-party errors.

```ts
import { log } from "@/lib/server/log";

log.info("[coach]", "request received");
log.error("[stripe-webhook]", err);
log.warn("[higgsfield]", "Pro plan required");
```

What it scrubs before printing:

- Email addresses → `***@***`
- Phone numbers (E.164-ish) → `***-***-****`
- Bearer tokens / API keys (anything starting with `sk-`, `pk-`, `Bearer `, `re_`, `sbp_`) → `***`
- UUIDs longer than what's safe to identify a row → kept (you'll need them to debug), but only the first 8 chars
- Stripe ids (`cus_`, `sub_`, `pi_`, `ch_`) → prefix kept, body scrubbed
- Anything inside `[user wrote: "..."]` brackets (already sanitized at input but belt-and-braces)

Limitations: this only protects log output **inside our codebase**. Vercel platform logs, Supabase logs, and any third-party SDK that logs to stderr can still surface raw values — review SDK options for those individually.

### What we log

| Source                      | Level | What                                                        |
|-----------------------------|-------|-------------------------------------------------------------|
| `[coach]`                   | error | OpenAI failure, sanitizer rejection                         |
| `[coach-voice]`             | error | TTS failure                                                 |
| `[coach-avatar]`            | warn  | Higgsfield CLI absent / unauthed / plan-gated               |
| `[form-check]`              | error | OpenAI vision failure, JSON parse failure                   |
| `[stripe-webhook]`          | error | Signature check failure, row update failure                 |
| `[supabase]`                | error | Row-level security / migration drift surfacing as PGRST errors |
| `[middleware]`              | warn  | Unauthenticated access to protected page                    |

### What we never log

- The user's input message verbatim.
- Coach response bodies.
- OpenAI prompts.
- Stripe card details (Stripe never sends them to us — but make sure error blobs from Stripe don't echo raw).
- Photo metadata or filenames.
- Auth tokens or cookies.

## Next (when we have spend + traffic)

1. **Sentry** for server + browser error tracking.
   - Use `beforeSend` to run every event through the same scrubber used by `log.ts`.
   - Disable `Replay` on routes that show user data (coach chat, nutrition, progress photos).
   - Set sample rates conservatively (10% for performance traces).
2. **Uptime monitoring** (Better Stack / Cronitor / similar) hitting `/api/health` every minute.
3. **Daily Stripe reconciliation report** — emailed summary so a stuck subscription is caught within a day.
4. **Supabase log drains** to an external bucket so the audit trail outlives Supabase's retention window.
5. **Audit table** for admin actions (`audit_logs`) — who reassigned a trainer, who deleted whose data, who triggered a migration via Management API.

## Rules

- Add a new log line only with a reason to look at it later. Noise is a security risk because it hides signal.
- Errors carry context strings, not stack-only.
- Don't catch and swallow without logging.
- Anything that reaches the user's screen is also fine to log; anything that doesn't, do not log.

## Compliance touch points

- `/privacy` claims "server logs are scrubbed of identifiers and retained for up to 30 days." Vercel default platform log retention matches that on the Pro plan. If we move off Vercel, update the policy.
- `/privacy` claims "if we ever experience a breach, we will notify affected users without undue delay." A real breach response runbook lives outside this repo — add a Sentry alert that pages the operator within 5 minutes of an authentication or RLS-related error spike.
