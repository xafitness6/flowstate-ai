# PII Inventory

Every piece of personal data Flowstate AI touches, where it lives, and who can see it. Source of truth for what `/privacy` claims — keep them in sync.

Categories follow the GDPR/CCPA shorthand: **Identifiers**, **Body data**, **Behavioral**, **Communications**, **Financial**, **Sensitive**.

## Identifiers

| Field              | Where it lives                        | Shared with               | Retention |
|--------------------|---------------------------------------|---------------------------|-----------|
| Email              | `auth.users`, `profiles.email`        | Supabase, Resend (sends), OpenAI (never), Stripe (subscription metadata) | Account life + 24mo closed-account record |
| Name               | `profiles.full_name`                  | Supabase, AI coach context | Account life |
| Phone              | `profiles.phone` (optional)           | Supabase                  | Account life |
| Role               | `profiles.role`                       | Supabase                  | Account life |
| User ID (UUID)     | `auth.users.id`, `profiles.id`        | Supabase, Stripe, OpenAI (in trace headers only) | Account life |
| IP address         | Supabase auth logs, server runtime logs | Supabase                  | 30d in our logs, Supabase governed elsewhere |
| Auth tokens / cookies | Browser `sb-<ref>-auth-token`     | Supabase                  | Session-bound |

## Body data

| Field              | Where it lives                        | Shared with               | Retention |
|--------------------|---------------------------------------|---------------------------|-----------|
| Height (cm)        | `onboarding_state.raw_answers`, `profiles` | Supabase, AI coach context | Account life |
| Weight (kg)        | `onboarding_state.raw_answers`, `weight_logs` | Supabase, AI coach context | Account life |
| Sex at birth       | `onboarding_state.raw_answers`        | Supabase, AI coach context | Account life |
| Age / DOB          | `onboarding_state.raw_answers`        | Supabase, AI coach context | Account life |
| Body-fat %         | `onboarding_state.raw_answers` (optional) | Supabase, AI coach context | Account life |
| Weight trend       | `weight_logs(weight_kg, logged_at)`   | Supabase, trainer if assigned, AI coach context | Account life |

## Behavioral

| Field              | Where it lives                        | Shared with               | Retention |
|--------------------|---------------------------------------|---------------------------|-----------|
| Workout logs       | `workout_logs(exercise_results)`      | Supabase, trainer if assigned, AI coach context | Account life |
| Set / rep / load   | inside `exercise_results` JSONB       | "" | "" |
| RPE / feel         | inside `exercise_results` JSONB       | "" | "" |
| Meal logs          | `nutrition_logs(items, totals, source, raw_transcript, clean_transcript, needs_review)` | Supabase, trainer if `meal_logs_visible`, AI coach context | Account life |
| Hydration logs     | `hydration_logs`                      | Supabase, trainer if `meal_logs_visible` | Account life |
| Daily check-ins    | `daily_checkins`, `accountability_logs` localStorage | Supabase (where applicable) | Account life |
| Habit streaks      | localStorage `accountability-logs`    | Browser-local              | Browser-local |
| Onboarding intake  | `onboarding_state.raw_answers` (JSONB) | Supabase, AI coach context | Account life |
| Nutrition approach | `profiles.nutrition_approach` (JSONB) | Supabase, trainer if assigned, AI coach context | Account life |

## Communications

| Field                  | Where it lives                              | Shared with               | Retention |
|------------------------|---------------------------------------------|---------------------------|-----------|
| Coach conversations    | `coach_conversations(transcript)`           | Supabase, OpenAI (for inference), trainer if `coach_chat_visible` | Account life |
| Coach messages         | within `transcript` JSONB                   | "" | "" |
| Client ↔ trainer notes | `client_notes`                              | Supabase                   | Account life |
| Reflections            | `reflections`                               | Supabase, trainer if shared | Account life |
| Coach intent / pipeline | localStorage `flowstate-ai-results` (last 30) | Browser-local            | Browser-local |
| Voice transcripts (in flight) | request only, not persisted          | OpenAI                     | Request lifetime only |

## Financial

| Field                   | Where it lives                           | Shared with               | Retention |
|-------------------------|------------------------------------------|---------------------------|-----------|
| Stripe customer ID      | `profiles.stripe_customer_id`            | Stripe (controller), Supabase | Account life |
| Stripe subscription ID  | `profiles.stripe_subscription_id`        | Stripe, Supabase           | Account life |
| Subscription status     | `profiles.subscription_status`           | Supabase                   | Account life |
| Plan tier               | `profiles.plan`                          | Supabase                   | Account life |
| Last 4 / card brand     | Held by Stripe (not by us)               | Stripe                     | Stripe governed |
| Billing events          | Stripe webhooks → `profiles` updates     | Stripe, Supabase           | Account life |

## Sensitive

| Field                   | Where it lives                           | Shared with                | Retention | Notes |
|-------------------------|------------------------------------------|----------------------------|-----------|-------|
| Injuries / pain notes   | `onboarding_state.raw_answers.deep`      | Supabase, AI coach context (always — needed for safe programming) | Account life | Inform users this drives program safety |
| Dietary style           | `onboarding_state.raw_answers.dietStyle` | Supabase, AI coach context | Account life | Religious / ethical signal |
| Progress photos         | Supabase Storage `progress-photos/` (private bucket) + `progress_photos` metadata | Supabase, signed URL only to owner + assigned trainer if `photos_visible` | Account life | Bucket is private; access by short-lived signed URL only |
| Disordered-eating signals | inferred only, never explicitly stored | — | — | Disclaimer page warns affected users to seek clinical help |
| Password (hashed)       | Supabase Auth                            | Supabase                   | Account life | Never plaintext anywhere |
| Password reset tokens   | `auth_password_tokens` (HMAC hashed)     | Server only                | 30 minute TTL | Short-lived, single-use |

## Coach-visibility opt-ins

Migration 041 added explicit opt-in flags so trainers don't see sensitive data by default:

| Field on `profiles`     | What it gates                            |
|-------------------------|------------------------------------------|
| `coach_chat_visible`    | Whether the trainer can see the client's AI coach conversations |
| `photos_visible`        | Whether the trainer can request signed URLs for the client's progress photos |
| `meal_logs_visible`     | Whether the trainer can see meal + hydration logs |

These default to `false`. Trainers see only what the client has chosen to share.

## Storage outside Supabase

| System              | What's there                                    | Why |
|---------------------|--------------------------------------------------|-----|
| Browser localStorage | UI state (unit system, selected tab, nutrition approach, last role), AI pipeline results (last 30), demo session role, picker positions | Snappy UI, no roundtrip |
| Browser sessionStorage | Demo session role | Cross-tab session boundary |
| Browser auth cookies | `sb-<ref>-auth-token` (chunked, HttpOnly) | Sign-in |
| Resend             | Outgoing email metadata (recipient, subject, status) | Email delivery |
| OpenAI             | Per-request prompts + responses (not retained for training under API terms) | AI inference |
| Stripe             | Card, billing address, subscription state         | Payment |
| Vercel             | App hosting + runtime logs                       | Hosting |
| Higgsfield         | Portrait + audio file + generated mp4 URL (when avatar feature is enabled — currently off) | Avatar render |

## What we explicitly do NOT collect

- Government IDs.
- Biometric identifiers (FaceID, fingerprints — we never ask for these).
- Real-time location.
- Contact lists, calendars, or messages outside of what users explicitly enter into Flowstate features.
- Health-care provider information.
- HIPAA-covered PHI. We are not a covered entity.

## Right-to-delete flow

`DELETE /api/users/[id]` exists; verify it cascades through:

- `auth.users` (deletes session + login)
- `profiles` (FK cascade)
- All `user_id` FK tables: `workout_logs`, `nutrition_logs`, `weight_logs`, `progress_photos`, `coach_conversations`, `onboarding_state`, etc.
- Supabase Storage objects in `progress-photos/<userId>/`
- Stripe customer (cancel + archive)

Keep this list in sync with new tables. Adding a `user_id`-keyed table without wiring it into the delete flow is a privacy bug.
