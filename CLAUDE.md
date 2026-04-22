# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context Navigation

Before reading any file in this project, follow this order:

1. **Start here:** Read `brain-graph.md` in the project root — it's a compact map of every doc, route, key file, and rule. Read this instead of individual files whenever possible.
2. **Then check memory:** Review `~/.claude/projects/-Users-xavierellis-Projects-flowstate-ai/memory/MEMORY.md` for decisions and patterns not in the code.
3. **Only read raw files** when the task requires actual implementation details, or the user explicitly says "read the file."
4. **Keep the graph updated:** After adding or changing a doc, update `brain-graph.md` to reflect it.

## Commands

```bash
npm run dev      # Start dev server (port 3000)
npm run build    # Production build
npm run start    # Start production server
```

No test runner is configured. No lint script is defined — TypeScript checking is the primary quality gate:
```bash
npx tsc --noEmit   # Type check only, no emit
```

When running a dev server for API testing, use a non-default port to avoid conflicts:
```bash
npx next dev --port 3099
```

## Stack

Next.js 16 App Router · TypeScript 5 · React 19 · Supabase · OpenAI gpt-4o · Stripe · Tailwind v4 · shadcn/ui

## Architecture

### Route Groups

All authenticated app pages live under `src/app/(app)/` and are wrapped by `AppShell` (via the group's `layout.tsx`). Pages outside `(app)/` — login, onboarding, auth callback, welcome — are unauthenticated and receive no shell.

### Auth & Session Model

The app runs in two modes simultaneously:
- **Demo mode:** session key is a role name (`"master"`, `"trainer"`, `"client"`, `"member"`) stored in `localStorage` (`flowstate-active-role`) or `sessionStorage` (`flowstate-session-role`). User data comes from hard-coded `DEMO_USERS` in `UserContext`.
- **Supabase mode:** session key is the real UUID stored in the same keys. User data fetched from `profiles` table via `getMyProfile()`.

Every page that reads a userId must guard with `UUID_RE.test(userId) && process.env.NEXT_PUBLIC_SUPABASE_URL` before making any Supabase call. Demo users have non-UUID ids (`usr_001`, `u4`, etc.).

**AppShell guard order:** Wait for `UserContext.isLoading` → master/admin bypass → Supabase session check + `resolveOnboardingRoute()` DB check → demo session check → `setReady(true)`. Errors are logged, not redirected to `/login` (silent redirect was causing freeze bugs).

**Post-login routing:** All routing decisions after login go through `resolvePostLoginRoute()` in `src/lib/routing.ts`. Never call `router.replace()` with hard-coded routes outside this function.

**Auth callback:** Magic link / OAuth code exchange happens at `src/app/auth/callback/route.ts` → redirects to `/onboarding` on success.

### Supabase Clients

| File | Use when |
|------|----------|
| `src/lib/supabase/client.ts` | Client Components, browser |
| `src/lib/supabase/server.ts` | Server Components, Route Handlers, Server Actions |
| `src/lib/supabase/admin.ts` | Privileged server-only ops (service role key) |

The middleware (`src/middleware.ts`) calls `supabase.auth.getUser()` on every request to refresh tokens into cookies. It does NOT redirect — auth enforcement is client-side via AppShell.

### Database Schema

Seven migrations in `supabase/migrations/`. Core tables:
- `profiles` — extends `auth.users`; has `role`, `plan`, `subscription_status`, `first_login`
- `onboarding_state` — per-user flags; `resolveOnboardingRoute()` reads this to gate the onboarding flow
- `programs` — training blocks; has `weekly_split` (JSONB), `body_focus_areas`, `equipment_profile`
- `workouts` — individual sessions inside a program; `exercises` stored as JSONB column
- `workout_logs` — completed sessions; `exercise_results` JSONB, `parsed_confidence` for AI-parsed entries
- `nutrition_logs` — meals; `items` JSONB, macros as columns, `needs_review` flag for low-confidence AI parses

`handle_new_user()` Postgres trigger auto-creates a `profiles` row on `auth.users` insert. `xavellis4@gmail.com` is hard-coded as `is_admin = true` in that trigger.

TypeScript types for all tables live in `src/lib/supabase/types.ts` — keep in sync when adding columns.

### Role & Plan Access

```
member < client < trainer < master
foundation < training < performance < coaching
```

- `hasAccess(userRole, requiredRole)` — `src/lib/roles.ts`
- `planHasAccess(userPlan, requiredPlan)` — `src/lib/plans.ts`
- `canAccessFeature(userPlan, feature)` — `src/lib/entitlements.ts` (feature-flag registry)

Role is stored in Supabase `profiles` and injected into the JWT via a custom claim hook.

### AI Pipeline

The performance coaching flow is a 4-stage sequential pipeline — each stage is a separate API endpoint:

```
detect (intent) → summarize (biometrics) → decide (adjustment) → format (athlete output)
```

All stages use GPT-4o. The orchestrator (`src/lib/ai/pipeline.ts`) runs them via `useAIPipeline` hook, storing results in `localStorage` (`flowstate-ai-results`, last 30 entries) for adaptation context.

Other AI endpoints are standalone (not part of the pipeline):
- `/api/ai/coach` — unified chat; handles education + performance Q&A in one endpoint
- `/api/ai/educate` — training/nutrition concept explanations
- `/api/ai/reflect` — post-session behavior analysis
- `/api/ai/nutrition` — meal parsing from text transcript or photo (two modes in one route)

All AI routes follow the same pattern: `POST`, `OpenAI` client from `process.env.OPENAI_API_KEY`, return `{ content }` or a typed JSON object, `try/catch` returning `{ error, status: 500 }`.

### Data Layer Conventions

- **DB helpers** live in `src/lib/db/` — one file per table (`profiles.ts`, `onboarding.ts`, `workoutLogs.ts`, etc.)
- **localStorage helpers** live in `src/lib/` — `onboarding.ts`, `workout.ts`, `nutrition/store.ts`, etc. Write-through to Supabase is done inside these helpers when UUID is detected.
- **Intake / starter plan** — `src/lib/data/intake.ts` + `src/lib/starterPlan.ts`. Calibration answers saved here; starter plan generated client-side from intake, not AI.

### Key Invariants

- **No redirects outside `resolvePostLoginRoute()`** — the one exception is role-based fast exits in `login/page.tsx` (`trainer → /trainers`, `master → /admin`).
- **No Supabase calls without UUID guard** — demo users have non-UUID IDs; calling Supabase with them causes RLS errors.
- **`exercises` in `workouts` table is JSONB** — there is no separate `exercises` table. Exercise data is embedded in the workout row.
- **`exercise_results` in `workout_logs` is JSONB** — same pattern for logged sets/reps/weight.
- **Service role key is server-only** — `createAdminClient()` in `src/lib/supabase/admin.ts`; never import in Client Components.
- **No gamification push notifications** — hard rule, see `brain-graph.md`.

## What to Save to Memory

After each session, save anything that would save re-reading time:
- Architectural decisions and why they were made
- Constraints or requirements the user mentioned
- Non-obvious patterns or workarounds
- Features in progress or planned

Do NOT save: code snippets, file contents, anything already in the code itself.
