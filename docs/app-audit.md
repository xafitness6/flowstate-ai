# Flowstate AI — App Audit (2026-05-24)

Plain-English, service-by-service breakdown of how the app works, what's
solid, and what's shaky. Grounded in code tracing + live checks against
`flowstate-ai-pi.vercel.app` (all pages return 200; POST-only APIs return 405
on GET as expected).

---

## TL;DR (layman's terms)

- **The app itself runs well.** Every page loads on the live site, the core
  loop (sign in → onboarding → see your program → log workouts/nutrition →
  AI coach) is wired and working.
- **The recurring pain isn't the code — it's the database falling behind.**
  Your live Supabase database was missing tables/columns the code expected,
  and the app *hides* those errors instead of showing them. That single
  pattern caused almost every "it doesn't work" moment (Luca Ferretti,
  stuck onboarding, no reset email).
- **Password reset:** the app correctly generates a code every time, and your
  email service (Resend) works perfectly when tested directly. The only gap
  is the *live server's* email settings — covered in detail below.

---

## The onboarding sequence (the flow we built)

**Path:** invite link or signup → `/onboarding` router → calibration (6 quick
questions) → tutorial (concierge tour) → `/program`. Invite users are forced
through deep calibration first; self-signups can opt in later.

| Step | What it does | Status |
|---|---|---|
| `/onboarding` router | Sends you to your next step; owner → /admin | ✅ Works; owner short-circuit added |
| Calibration (6 Q) | Goal, experience, schedule, diet, recovery, equipment | ✅ Works; multi-select + scroll fixes in |
| Starter plan | Builds a deterministic program instantly, saves to DB | ✅ Works (after the UUID-regex fix) |
| Tutorial | Concierge tour, ends on /program | ✅ Works (after the bounce-loop fix) |
| Deep calibration | 27-question deep dive, AI builds upgraded program | ✅ Works; weight/time inputs + build screen fixed |
| Pre-fill from notes | Trainer pastes notes → AI maps to fields → client confirms | ✅ Built; needs live testing |

**What works well:** the flow no longer hangs or bounces; every step has
timeouts; pre-filled answers hydrate so clients don't re-answer.

**What's still shaky:**
- Onboarding correctness depends on migrations being applied to the live DB
  (e.g., `daily_checkins` is still missing — see Data Layer).
- The pre-fill → client-confirm path is built but hasn't been exercised
  end-to-end on the live site with a real client yet.

---

## Service-by-service

### Auth & identity — ✅ solid now (was the #1 problem area)
- Sign-in (password, Google OAuth, magic link), sign-out, session refresh.
- **Owner (`xavellis4@gmail.com`) is now always admin** by email + DB role, so
  a slow profile read can't demote you to "member" anymore.
- Logout is timeout-protected (was hanging).
- *Watch:* admin authority relies on the hardcoded owner email + DB role.

### Onboarding — ✅ works (see section above)

### Programs & workouts — ✅ works
- Active program, week view, logging sets/reps, program library, builder,
  AI generator. SSR so pages paint fast.

### Nutrition — ✅ works, ⚠️ one missing table
- Meal logging, macros, AI meal parsing.
- `nutrition_notes` table is **missing on live** → the notes feature errors
  until migration 008 is applied.

### AI coach & pipeline — ✅ works, now personalized
- Unified coach endpoint; 4-stage performance pipeline.
- Coach now reads the athlete's intake so it coaches to their specifics.

### Calendar — ⚠️ partially broken on live
- iCal feed + Google push exist in code, but `google_calendar_tokens` (014)
  and the multi-reminder columns (015) are **missing on live** → connecting
  Google Calendar and stacked reminders will error until applied.

### Invites & client management — ✅ works
- Admin/trainer invites, client detail page, intake view, client notes
  (`client_notes` is applied on live), PDF export.

### Email & password reset — ⚠️ see dedicated audit below

### Billing (Stripe) — ✅ works, currently bypassed
- Early-access mode grants complimentary access and disables live checkout.
  Confirm `NEXT_PUBLIC_EARLY_ACCESS_MODE` matches your intent on Vercel.

### Data layer / migrations — ⚠️ the root cause of most issues
- The live DB does NOT auto-apply repo migrations; they must be run manually
  in the Supabase SQL editor (`SUPABASE_ACCESS_TOKEN` is unset, so the apply
  script can't run).
- **Still missing on live:** 008 (`daily_checkins`, `nutrition_notes`), 014
  (`google_calendar_tokens`), 015 (calendar reminder columns).
- Errors from missing tables are **swallowed silently** by route catch-alls,
  which is why these surface as "it just doesn't work" with no message.

---

## Password reset — detailed audit

**Symptom:** a code came once, then never again.

**What I verified:**
1. The app **creates a reset code on every request** — 3 unused tokens were
   created today in `auth_password_tokens`. So the endpoint runs to completion.
2. The live deployment **is running the latest code** (recent routes return
   401, not 404).
3. **Resend works perfectly** — the API key is valid, `flowstateai.site` is
   verified (sending enabled), and a direct send returned HTTP 200 with a
   message id, twice.
4. The DB pieces it needs (`auth_password_tokens`, `profiles.archived_at`) are
   now present.

**Conclusion:** code generation + email infrastructure both work. The failure
is at the **send step on the live server**, and it's silent because the route
catches the error and returns "ok" regardless. The most likely cause is an
**environment mismatch on Vercel** — the `RESEND_API_KEY` (or
`PASSWORD_RESET_FROM_EMAIL`) value the live server uses differs from the
verified-working value in `.env.local` (e.g. the key was rotated and Vercel
wasn't updated/redeployed), OR repeated identical emails are being filtered
to spam by Gmail.

**How to pinpoint it in 30 seconds (now that you can log in):**
While logged into the live site as admin, visit:
```
/api/admin/email-diagnostics?send=1
```
This reads the LIVE server's email settings AND fires a real test send,
returning the exact result:
- `diagnostics.hasResendApiKey` — is the key present on live?
- `diagnostics.usingResendSandboxSender` — is the sender correct on live?
- `liveSend` — did the real send succeed, or what error did Resend return?

**Fix (most likely):** re-paste `RESEND_API_KEY` in Vercel with the exact value
from `.env.local`, confirm `PASSWORD_RESET_FROM_EMAIL=Flowstate AI
<noreply@flowstateai.site>`, then **redeploy**. Re-run the diagnostic above to
confirm `liveSend.sent: true`.

**Hardening recommendation:** stop swallowing send failures. The reset request
route should record the send outcome (it logs to Vercel function logs today,
but that's invisible day-to-day). Surfacing it in the admin diagnostics — now
done via `?send=1` — is the first step.

---

## Cross-cutting recommendations (priority order)

1. **Apply the 3 missing migrations** (008, 014, 015) so check-ins, Google
   Calendar, and reminders stop erroring.
2. **Fix the Vercel email env** (verify `RESEND_API_KEY` matches the working
   key; redeploy) so reset emails reach real users.
3. **Stop silent failures:** the pattern of `catch → return ok` across auth
   routes is why bugs are invisible. Add structured logging/telemetry so a
   missing table or failed send is observable.
4. **Migration discipline:** set `SUPABASE_ACCESS_TOKEN` and keep the apply
   script current, OR adopt a migration step in deploy, so the live DB never
   drifts behind the code again.
5. **End-to-end test the pre-fill onboarding** with a real client on live.
