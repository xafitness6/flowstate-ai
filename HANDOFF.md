# HANDOFF — Password Reset Code Not Delivering

**Date:** 2026-05-24
**Status:** Bug isolated to ONE Vercel env value. Fix is below.

> Supersedes the prior 2026-05-15 handoff (tutorial bounce-loop) — that issue
> is resolved.

---

## 1. The verdict (one line)

The reset code never lands in inboxes because Vercel's
`PASSWORD_RESET_FROM_EMAIL` is set to the **placeholder value with literal
quote marks around it**. Resend rejects the malformed `from` field (HTTP 422)
and the app route swallows the error silently. Nothing else is wrong.

---

## 2. The definitive evidence

Authenticated as admin and hit the live diagnostic
(`GET /api/admin/email-diagnostics?send=1` on
`https://flowstate-ai-pi.vercel.app`). Live server returned:

```json
{
  "diagnostics": {
    "hasResendApiKey": true,
    "hasFromEmail": true,
    "from": "\"Flowstate AI <no-reply@your-verified-domain.com>\"",
    "appUrl": "https://flowstate-ai-pi.vercel.app",
    "hasResetCodeSecret": true,
    "usingResendSandboxSender": false,
    "productionDebugResetCodes": true
  },
  "passwordResetPreflight": {
    "authPasswordTokensTable": { "ok": true, "error": null },
    "profile": { "checked": true, "found": true, "archived": false, "error": null }
  },
  "liveSend": {
    "attempted": true,
    "sent": false,
    "error": "{\"statusCode\":422,\"name\":\"validation_error\",\"message\":\"Invalid `from` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.\"}"
  }
}
```

Two problems with the live `from` value:

1. **Placeholder text:** `no-reply@your-verified-domain.com` instead of the
   real verified sender on `flowstateai.site`.
2. **Literal quotes around it:** the JSON shows `"\"...\""` — the stored
   value includes `"` characters. Vercel takes raw text; surrounding quotes
   are kept verbatim and break the `Name <addr>` format.

Everything else is green: API key present, reset secret present, token
table works, profile found, app URL correct, sender not the Resend sandbox.

---

## 3. The fix (Vercel — one env var, then redeploy)

1. Vercel → project `flowstate-ai` → **Settings → Environment Variables**.
2. Edit **`PASSWORD_RESET_FROM_EMAIL`**.
3. Set the value to **exactly** (NO surrounding quotes):

```
Flowstate AI <noreply@flowstateai.site>
```

4. Save → **Redeploy** (env changes only apply to new builds).

That's it. After redeploy, the reset code email will arrive.

---

## 4. How to verify the fix in 10 seconds

While logged into the live site as admin, open:

```
https://flowstate-ai-pi.vercel.app/api/admin/email-diagnostics?send=1
```

Expected JSON:

```json
"diagnostics": { "from": "Flowstate AI <noreply@flowstateai.site>", ... },
"liveSend": { "attempted": true, "sent": true, "id": "<resend-uuid>" }
```

If `liveSend.sent` is `true`, real users' reset emails will deliver.
If `liveSend` shows another error, the JSON tells you exactly what to fix.

---

## 5. Headless verification (no browser needed)

`?send=1` is admin-gated. To call it from a script:

```bash
# 1. sign in as admin to get a session
ANON=<NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local>
URL=https://czofyrwvzbdnmngrhgqj.supabase.co
curl -s -X POST "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"xavellis4@gmail.com","password":"<your password>"}' > /tmp/sess.json

# 2. build the @supabase/ssr cookie + call the diagnostic
node --input-type=module -e '
import fs from "node:fs";
const sess = JSON.parse(fs.readFileSync("/tmp/sess.json","utf8"));
const ref  = "czofyrwvzbdnmngrhgqj";
const name = `sb-${ref}-auth-token`;
const payload = "base64-" + Buffer.from(JSON.stringify(sess)).toString("base64");
const CHUNK = 3180;
const cookies = [];
if (payload.length <= CHUNK) cookies.push(`${name}=${payload}`);
else for (let i=0,n=0; i<payload.length; i+=CHUNK,n++) cookies.push(`${name}.${n}=${payload.slice(i,i+CHUNK)}`);
const res = await fetch(
  "https://flowstate-ai-pi.vercel.app/api/admin/email-diagnostics?send=1&email=xavellis4@gmail.com",
  { headers: { Cookie: cookies.join("; ") } },
);
console.log("HTTP", res.status);
console.log(await res.text());
'
```

This is exactly how the bug above was confirmed.

---

## 6. Emergency: log in without the reset email

If the email path is broken you can always reset the admin password directly
via the setup script (service-role admin API, bypasses email entirely):

```bash
ADMIN_PASSWORD='your-new-pass' node scripts/setup-admin.mjs
```

Requires `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` in
`.env.local`. Sets `xavellis4@gmail.com`'s password and ensures
master/is_admin.

---

## 7. If it's STILL not working after the fix

Run the verification in §4. The JSON will narrow it to one of:

| `liveSend.error` includes | Cause | Fix |
|---|---|---|
| `Invalid \`from\` field` | Env value still has placeholder/quotes | Re-edit; remove quotes; redeploy |
| `401` / `Invalid API Key` | Vercel `RESEND_API_KEY` doesn't match a current Resend key | Generate a fresh Resend key, paste into Vercel, redeploy |
| `domain ... not verified` | `flowstateai.site` lost verified status in Resend | Resend → Domains → re-verify |
| `rate limit` / `too many` | Hit free-tier rate cap | Wait or upgrade Resend |
| `liveSend.sent: true` | Email IS sending | **Check Gmail Spam / All Mail** — repeated reset emails get filtered |

If `diagnostics.hasResendApiKey: false` — the key isn't reaching the runtime
(env not saved, or saved to wrong scope/branch, or no redeploy after save).

---

## 8. Code paths involved (for future debugging)

- **Request route** (creates code + calls send):
  `src/app/api/auth/password-reset/request/route.ts`
  Note: catches errors and returns `{ok:true}` to prevent email enumeration —
  THIS is why send failures are invisible without the diagnostic.
- **Complete route** (consumes code + sets password):
  `src/app/api/auth/password-reset/complete/route.ts`
- **Send + template** (the HTML, the Resend call):
  `src/lib/server/email.ts` → `sendPasswordResetEmail`, `passwordResetHtml`,
  `sendViaResend`, `emailConfig`.
- **Token store** (HMAC + insert/lookup):
  `src/lib/server/passwordResetTokens.ts`. Table: `auth_password_tokens`.
- **Diagnostic endpoint** (the tool that found the bug):
  `src/app/api/admin/email-diagnostics/route.ts`. GET = config + preflight;
  GET `?send=1` = real send; POST = real send.
- **Forgot-password page**:
  `src/app/forgot-password/page.tsx` → POSTs to the request route above.
- **Reset-password page** (enters code, sets new password):
  `src/app/reset-password/page.tsx`.

---

## 9. Required env vars (for the full reset flow)

| Var | Where | Value |
|---|---|---|
| `RESEND_API_KEY` | Vercel + `.env.local` | Live Resend key, starts with `re_` |
| `PASSWORD_RESET_FROM_EMAIL` | Vercel + `.env.local` | `Flowstate AI <noreply@flowstateai.site>` (no quotes!) |
| `PASSWORD_RESET_CODE_SECRET` | Vercel + `.env.local` | 32-byte hex from `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | Vercel | `https://flowstate-ai-pi.vercel.app` (or custom domain) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + `.env.local` | Supabase service role |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | `https://czofyrwvzbdnmngrhgqj.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Supabase anon key |
| `ENABLE_DEV_ROUTE` | `.env.local` ONLY | `true` (do NOT set in production — diagnostic flagged this is currently on in prod) |

---

## 10. Wider context (set by this session)

- **Migration drift** is the recurring root cause across this whole app —
  live Supabase DB lags repo migrations because they don't auto-apply.
  Apply via Supabase SQL editor. Still missing on live: 008
  (`daily_checkins`, `nutrition_notes`), 014 (`google_calendar_tokens`),
  015 (calendar reminder columns). See `docs/app-audit.md` for the full
  service-by-service breakdown.
- **Owner-always-admin** fix is in: `xavellis4@gmail.com` is master by both
  email + DB role; never falls back to a member persona.
- **Silent-failure pattern** is the second root cause — auth/email routes
  catch errors and return `{ok:true}` to avoid leaking info. The
  `email-diagnostics` `?send=1` is the antidote for the reset path; consider
  similar visibility for other auth routes.
