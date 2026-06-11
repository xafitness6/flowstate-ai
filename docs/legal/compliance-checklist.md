# Compliance Checklist

The honest state of what's done, what's deferred, and what needs a real lawyer.

## Done

- [x] **Privacy Policy** at `/privacy` — specific to what the app actually does (third parties named, retention quantified, rights enumerated).
- [x] **Terms of Service** at `/terms` — includes ROSCA-friendly auto-renewal language (clear notice of renewal, easy cancellation, no dark patterns).
- [x] **Disclaimer** at `/disclaimer` — fitness, AI, "not medical advice", listen-to-body warnings.
- [x] **Right to delete** — `DELETE /api/users/[id]` exists and cascades via FK + Supabase Storage cleanup.
- [x] **Auth-only sensitive routes** — `src/lib/server/security.ts` `requireAuthenticatedUser`, `requireAiAccess`, `requireClientAccess` gate every personal-data route.
- [x] **Rate limits** on AI routes, meal-plan image generation, and other expensive endpoints.
- [x] **Prompt-injection defenses** — input length caps, role-override detection, system prompt boundaries.
- [x] **Coach-visibility opt-ins** — `profiles.coach_chat_visible`, `photos_visible`, `meal_logs_visible` (migration 041) so trainers don't see sensitive data by default.
- [x] **AI disclosure** — `/privacy` and `/disclaimer` both name every AI feature explicitly. Coach surface labels its replies. **Verify**: ensure no AI surface implies a human source.
- [x] **PII-scrubbing logger** at `src/lib/server/log.ts`.
- [x] **PII inventory** in `docs/legal/pii-inventory.md`.

## Needs a real lawyer before launch

- [ ] **Counsel review of `/privacy`, `/terms`, `/disclaimer`.** Project-specific drafts, not legal advice.
- [ ] **State / country of operating entity.** Terms reference "the state where the operator is established" — name it explicitly.
- [ ] **Subscription auto-renewal copy** at the checkout step. FTC ROSCA requires the renewal terms, price, and cancellation method to be **clearly and conspicuously** disclosed before the user enters card details — the Stripe Checkout configuration should match.
- [ ] **GDPR cookie banner** if we ever add analytics / tracking cookies (today we don't; auth cookies + localStorage are essential and don't require a banner).
- [ ] **Data Processing Agreement (DPA)** with Supabase, OpenAI, Stripe, Resend, Vercel — most have standard DPAs accessible via account settings; sign them.
- [ ] **Subprocessor list page** — Stripe and OpenAI each have one; counsel may want us to mirror it.
- [ ] **Trainer-as-independent-contractor language** — review with counsel if trainers are paid through the platform.
- [ ] **Age verification flow** — if we serve users in regions with stricter minimum ages (EU 16, etc.), enforce at signup or set a global 18+ floor.
- [ ] **Account deletion confirmation flow** — currently API-driven; add a user-facing "Delete my account" button in Settings with email confirmation.

## Deferred (post-launch)

- [ ] Sentry + scrubbing config (see `observability-plan.md`).
- [ ] Audit-log table for admin actions.
- [ ] Daily Stripe reconciliation email.
- [ ] Public security disclosure policy (`/security` page) + an issue intake email.
- [ ] SOC2 / ISO if we land enterprise clients.

## Touch points to revisit on every release

- Update `EFFECTIVE_DATE` in the affected page when its terms materially change.
- Add new tables to the cascade list in `pii-inventory.md` "Right-to-delete flow".
- Re-check `/api/users/[id]` `DELETE` actually cleans up new tables.
- Confirm AI surfaces still disclose AI use (label / footer / placeholder copy).
