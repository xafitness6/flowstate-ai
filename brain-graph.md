# Flowstate AI — Brain Graph
> Compact knowledge map. Read this first — fetch individual files only when you need implementation details.
> Auto-maintained: update this file whenever a doc changes or a new one is added.

---

## Project Identity

**Flowstate AI** — fitness coaching platform. Dual-mode: demo (localStorage) OR real Supabase.
Stack: Next.js 16 App Router · TypeScript 5 · React 19 · Supabase · OpenAI gpt-4o · Stripe · Tailwind v4 · shadcn/ui

---

## Role Hierarchy
```
master > trainer > client > member
```
- `member` — self-directed, own data only
- `client` — assigned to a trainer, read-only on their program
- `trainer` — manages assigned clients only
- `master` — full platform access, billing, admin

Use `hasAccess()` from `src/lib/roles.ts`. Role stored in Supabase `profiles`, injected into JWT via custom claim hook.

## Plan Tiers
```
foundation < training < performance < coaching
```
Use `planHasAccess()` from `src/lib/plans.ts`.

---

## Critical Rules (never break these)
- Post-login routing → always through `resolvePostLoginRoute()` in `src/lib/routing.ts`
- UUID guard → `UUID_RE.test(userId) && process.env.NEXT_PUBLIC_SUPABASE_URL` before any Supabase call
- Service role key → server-side only, never client-side
- All DB writes → validated with Zod first
- Progress photos → signed URLs only, never public URLs
- Gamification push notifications → zero. Hard rule.

---

## Knowledge Map

### [[docs/security-and-roles.md]]
Role hierarchy, RLS policies for all tables (`profiles`, `programs`, `workout_logs`), JWT custom claims, auth strategy, file upload rules (progress photos), rate limiting, audit log, MVP security checklist.
**Key patterns:** `is_master()` Postgres function, `coach_chat_visible` flag, `photos_visible` flag, signed URL delivery, Upstash rate limiting.

### [[docs/gamification-spec.md]]
5 dimensions: Streaks · Milestones · Momentum · Phase Completion · Execution Consistency. 12-badge MVP set (Grounded, Ironside, Calibrated, Phase One, Stacked, Recovered, Zero Drift). Badge tiers: Marked (silver) / Forged (amber). Record tab in Profile shows earned badges + phase history + consistency grid + milestones.
**Key rules:** No push notifications. No retroactive streaks. No points/leaderboards. Quiet, earned-feel UI.

### [[docs/decision-engine-rules.md]]
AI adjustment logic. Step increase tiers (+500 to +2,500 max). Weight-flat assessment (5+ flat days triggers full signal read). Decision branches A–E based on adherence + hunger. Training difficulty slider (1–10, 2x/month change limit for users). Workout intensity levers: weight → reps → sets → rest reduction.
**Key rules:** Max +10kg single adjustment. Min rest 30s compound / 15s isolation. No auto-decrease — holds flat, flags only.

### [[docs/profile-settings-spec.md]]
Role display → read-only badge (no selector grid). Training difficulty slider spec (amber fill, snap to integer, label per band). Profile sections order: header → your coach → coaching → display → notifications → account → danger zone.
**Key data:** `pushLevel` (1–10, default 6), `coachOverridePushLevel`, `coachingTone` (Direct/Supportive/Analytical), `units` (Metric/Imperial), `dashboardDefault`.

### [[TESTING.md]]
Full local E2E checklist. Dev Panel (bottom-left) for role switching, data seeding, first-run simulation. All routes inventory with status. localStorage keys reference. Known gaps (coach not wired to personality, nutrition static, calendar static, no persistent auth).

### [[CLAUDE.md]]
Claude-specific instructions. Memory-first navigation. Dual-mode guard. Role/plan access helpers. Post-login routing rule.

### [[README.md]]
Minimal — just the project name.

---

## All Routes
| Route | Description |
|-------|-------------|
| `/` | Dashboard (DnD cards, first-run redirect) |
| `/onboarding` | Welcome → calibration |
| `/onboarding/calibration` | 7-step wizard |
| `/program` | Workout logger |
| `/program/builder` | Program builder (DnD) |
| `/program/assign` | Trainer client assignment |
| `/nutrition` | Macro & meal tracking |
| `/calendar` | Monthly view |
| `/coach` | AI chat |
| `/coach/intro` | Coach onboarding flow |
| `/accountability` | Habits + journal + trajectory |
| `/profile` | Own profile + settings |
| `/profile/[id]` | Role-gated user view |
| `/master` | Admin dashboard (master only) |
| `/pricing` | Pricing + plan toggle |
| `/showcase` | Component dev showcase |

---

## localStorage Keys
| Key | Purpose |
|-----|---------|
| `flowstate-onboarded` | Onboarding complete flag |
| `flowstate-active-role` | Current demo role |
| `accountability-habits-v2` | Habit definitions |
| `accountability-logs` | Daily logs (keyed YYYY-MM-DD) |
| `accountability-journal` | Journal history |
| `workout-logs` | Completed sessions |
| `dashboard-card-order` | Card layout |
| `dashboard-locked` | Layout lock boolean |
| `dashboard-default` | Preferred start screen |

---

## Key Source Files (fetch only when needed)
| File | What's there |
|------|-------------|
| `src/lib/roles.ts` | `hasAccess()`, `ROLE_COLOR`, `ROLE_LABELS` |
| `src/lib/plans.ts` | `planHasAccess()`, plan tier definitions |
| `src/lib/routing.ts` | `resolvePostLoginRoute()` — all post-login routing |
| `src/types/index.ts` | `MockUser`, `Role`, `UserStatus`, all core types |
| `src/context/UserContext.tsx` | Auth context, demo user switching |

---

## In Progress / Planned
- Obsidian vault = this project folder (`/Users/xavierellis/Projects/flowstate-ai`)
- brain-graph.md = this file — read it first, not individual files
- Coach not yet wired to personality/tone settings
- Nutrition, calendar, program builder still on static mock data
- No persistent auth yet — all demo/localStorage

---

*Last updated: 2026-04-15*
