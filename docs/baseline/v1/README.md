# Flowstate AI — V1 Visual Baseline

Frozen snapshot of every major page as of **2026-06-10**.

Captured before the editorial-premium + tactile-magazine redesign so future
iterations can be visually diffed against the prior state. Do not edit the
PNGs in this folder — they are the official V1 record.

## How the snapshots were taken

- iPhone 15 Pro logical viewport (393 × 852, DSR 2)
- Mobile Safari user-agent
- Demo-mode `master` session (sees every surface: client, trainer, admin)
- `networkIdle` → 1.8s settle → full-page screenshot
- Script: [`scripts/snapshot-v1-baseline.mjs`](../../../scripts/snapshot-v1-baseline.mjs)

Re-run with:

```sh
PORT=3099 npx next dev --port 3099 &   # in another shell
node scripts/snapshot-v1-baseline.mjs
```

## Pages

| Slug                  | Route                  | Audience |
|-----------------------|------------------------|----------|
| `login`               | `/login`               | anon |
| `welcome`             | `/welcome`             | anon |
| `onboarding-welcome`  | `/onboarding/welcome`  | anon |
| `dashboard`           | `/dashboard`           | every authed role |
| `nutrition`           | `/nutrition`           | member+ |
| `coach`               | `/coach`               | member+ |
| `program`             | `/program`             | member+ |
| `program-library`     | `/program/library`     | member+ |
| `learn`               | `/learn`               | member+ |
| `progress`            | `/progress`            | member+ |
| `accountability`      | `/accountability`      | member+ |
| `calendar`            | `/calendar`            | member+ |
| `my-clients`          | `/my-clients`          | trainer + master |
| `admin`               | `/admin`               | master |
| `admin-invites`       | `/admin/invites`       | master |
| `pricing`             | `/pricing`             | every authed role |
| `settings-billing`    | `/settings/billing`    | every authed role |
| `profile-master`      | `/profile/master`      | master |

## Design direction (next)

Editorial Premium foundation + Tactile Magazine warmth. See
[`public/design-mockups/`](../../../public/design-mockups/) for the direction
mockups and the conversation that picked this blend.

The redesign is intentionally **not** a single sweep across every page in this
list. We pick one surface, redesign it end-to-end against the new direction,
then propagate the patterns once they hold up in real use.
