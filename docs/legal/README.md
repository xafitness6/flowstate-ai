# Legal & Compliance — Flowstate AI

What lives here:

- [`pii-inventory.md`](./pii-inventory.md) — every piece of personally identifiable data the app touches, where it lives, who it's shared with, and how it's retained.
- [`observability-plan.md`](./observability-plan.md) — what we log, how PII is scrubbed before logs persist, and the next steps to layer in Sentry / equivalent.
- [`compliance-checklist.md`](./compliance-checklist.md) — what's done, what's deferred, what needs a real lawyer.

User-facing legal pages live in the app:

- `/privacy` — what we collect, why, who we share it with, your rights
- `/terms` — terms of service, subscription, ROSCA-compliant cancellation
- `/disclaimer` — health, AI, use-at-your-own-risk

These pages are wired through [`src/components/legal/LegalShell.tsx`](../../src/components/legal/LegalShell.tsx) so they share editorial styling, the brand header, and the in-page nav.

## Important framing

Nothing in this folder is legal advice. The pages and docs here are written to be **specific to what the app actually does** (real third parties, real tables, real flows) so a lawyer reviewing them can focus on edits, not start from scratch. Before taking real paying users:

1. Run `/privacy`, `/terms`, `/disclaimer` past counsel.
2. Confirm the **subscription auto-renewal** language meets ROSCA (FTC has been actively enforcing).
3. Confirm the **health disclaimer** keeps us out of HIPAA scope and away from "medical advice" claims.
4. Decide whether to add an explicit **cookie banner** if we ever add analytics or tracking.

## When you change something material

- Bump `EFFECTIVE_DATE` at the top of the affected page.
- For changes that affect what data we collect or how we use it, notify users by email / in-app at least 30 days before the change takes effect (the privacy policy says we will).
- Update the relevant section in [`pii-inventory.md`](./pii-inventory.md).
