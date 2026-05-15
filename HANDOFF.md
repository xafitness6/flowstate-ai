# Flowstate AI Handoff: Invite Onboarding Starter Plan Then Upgrade

## Current User-Reported Blocker

The concierge tutorial final actions are not working:

- `Show me my plan` on the final tutorial card does not advance to `/program`.
- `Skip tour` also does not advance to `/program`.

Observed in the UI on `/onboarding/tutorial`, final card:

- Title: `Let's start training.`
- Button: `Show me my plan`
- Link/button: `Skip tour`

This needs to be debugged first in the next session.

## Goal Of The Change

Implement invite onboarding as:

1. Invite link -> auth/account creation.
2. Invite users skip old pre-calibration walkthrough.
3. Six-question calibration runs first.
4. Six-question calibration creates and saves an active deterministic starter plan.
5. User sees concierge tour.
6. Tour ends at `/program`.
7. Program page shows a one-time starter reveal: `Your starter plan is ready.`
8. Program page prompts user to complete deep calibration with `Make this plan smarter`.
9. Deep calibration generates a new AI plan, archives the starter, saves the AI plan active.
10. Program page shows one-time upgrade reveal: `Your program has been updated.`

## Important Files Changed

- `src/app/invite/[token]/page.tsx`
  - Invite account completion now routes to `/onboarding/calibration`.
  - Sets `flowstate-via-invite=true`.

- `src/app/auth/finish/page.tsx`
  - If invite acceptance succeeds or `flowstate-via-invite` is present, routes to `/onboarding/calibration`.

- `src/app/login/page.tsx`
  - Existing invite-user login bypasses `/onboarding/walkthrough` and routes to `/onboarding/calibration`.

- `src/app/onboarding/page.tsx`
  - Smart onboarding router also respects `flowstate-via-invite` and bypasses walkthrough only when the next blocker is `/onboarding/walkthrough`.

- `src/app/onboarding/calibration/page.tsx`
  - Six-question calibration now:
    - Saves intake.
    - Generates starter plan.
    - Saves starter metadata.
    - Saves active v2 starter program for real Supabase UUID users using `saveBuilderWorkoutForSelf`.
    - Saves local active starter program fallback for non-Supabase/demo users.
    - Marks onboarding complete but leaves tutorial incomplete.
    - Sets `sessionStorage.flowstate-program-reveal=starter`.
    - Routes to `/onboarding/tutorial`.

- `src/app/onboarding/tutorial/page.tsx`
  - Changed UUID detection so real Supabase UUIDs are not treated as `anonymous`.
  - `finishTutorial()` now:
    - Calls `completeTutorial(userId)`.
    - For real UUID users, awaits `upsertOnboardingState(userId, { tutorial_complete: true })`.
    - Calls `router.push("/program")`.
  - Current blocker likely lives here.

- `src/app/onboarding/deep-calibration/page.tsx`
  - Deep calibration now acts as upgrade path.
  - It waits for `/api/ai/program-generator`.
  - Saves returned AI program active with `saveBuilderWorkoutForSelf(userId, payload, true)`.
  - That function archives prior active program, so starter becomes archived.
  - Sets `sessionStorage.flowstate-program-reveal=upgraded`.
  - Routes to `/program`.

- `src/app/(app)/program/ProgramClient.tsx`
  - Adds one-time reveal banner support:
    - `starter`: `Your starter plan is ready.`
    - `upgraded`: `Your program has been updated.`
  - Starter reveal includes:
    - plan name
    - goal
    - days/week
    - next workout
    - first 2-3 exercises
    - `Start Workout`
    - `Make this plan smarter`
  - Suppresses `DeepCalPrompt` while reveal banner is visible.
  - Refetches active program client-side if SSR returns no program.
  - Shows loading state before falling back to `No active program`.

- `src/app/(app)/program/page.tsx`
  - SSR Program page now supports both v2 and legacy weekly split shapes.

- `src/lib/starterPlan.ts`
  - Added `starterPlanToBuilderPayload(plan)`, converting deterministic starter plan into the same v2 builder payload shape the Program page prefers.

- `src/lib/workout.ts`
  - Added `saveActiveProgram(userId, stored)` for local/demo active-program fallback.

- `src/lib/onboarding.ts`
  - `completeOnboarding()` now marks quick start complete but deep calibration incomplete.
  - `profileComplete` is true so Program is not blocked by profile setup.

- `src/lib/db/onboarding.ts`
  - `markOnboardingComplete()` now leaves `tutorial_complete=false`, so the concierge tour still happens after calibration.

## Verification Already Run

These passed:

```bash
npm run build
git diff --check
```

There is no `npm run lint` script in this repo.

Dev server was started on:

```text
http://localhost:3001
```

Port `3000` was already in use, so Next used `3001`.

## Current Git Status At Handoff Time

Expected modified files:

```text
M src/app/(app)/program/ProgramClient.tsx
M src/app/(app)/program/page.tsx
M src/app/auth/finish/page.tsx
M src/app/invite/[token]/page.tsx
M src/app/login/page.tsx
M src/app/onboarding/calibration/page.tsx
M src/app/onboarding/deep-calibration/page.tsx
M src/app/onboarding/page.tsx
M src/app/onboarding/tutorial/page.tsx
M src/lib/db/onboarding.ts
M src/lib/onboarding.ts
M src/lib/starterPlan.ts
M src/lib/workout.ts
```

Also this file:

```text
HANDOFF.md
```

## Likely Next Debugging Target

Start with `src/app/onboarding/tutorial/page.tsx`.

The current implementation:

```ts
async function finishTutorial() {
  const userId = getActiveUserId();
  completeTutorial(userId);

  if (UUID_RE.test(userId) && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { upsertOnboardingState } = await import("@/lib/db/onboarding");
      await upsertOnboardingState(userId, { tutorial_complete: true });
    } catch (error) {
      console.warn("[tutorial] tutorial sync skipped:", error);
    }
  }

  router.push("/program");
}
```

Potential causes to check:

1. The click handler may be firing, but `router.push("/program")` is blocked by AppShell/onboarding gating.
2. `completeTutorial(userId)` may be using the wrong user id.
3. `upsertOnboardingState` may hang/fail in the browser, preventing `router.push("/program")`.
4. The button may be inside a layout/state where `isLast` is not true or the handler is not firing.
5. If `userId` resolves to `anonymous`, local onboarding state is written for the wrong key and routing will still block.

Recommended quick fix path:

1. Add temporary `console.log` lines in `finishTutorial`, `goNext`, and `handleSkip`.
2. Change `finishTutorial` to route in a `finally` block so Supabase sync cannot trap the user:

```ts
async function finishTutorial() {
  const userId = getActiveUserId();
  completeTutorial(userId);

  try {
    if (UUID_RE.test(userId) && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { upsertOnboardingState } = await import("@/lib/db/onboarding");
      await upsertOnboardingState(userId, { tutorial_complete: true });
    }
  } catch (error) {
    console.warn("[tutorial] tutorial sync skipped:", error);
  } finally {
    router.replace("/program");
  }
}
```

3. If Program still redirects back to tutorial, inspect the AppShell route guard and DB `onboarding_state` row for the current user.
4. If the current user id is not a UUID or expected local key, fix `getActiveUserId()`.

## Product Flow To Re-Test

1. Fresh invite user opens invite link.
2. Invite user creates/signs into account.
3. User lands on `/onboarding/calibration`, not `/onboarding/walkthrough`.
4. User finishes six-question calibration.
5. Active starter program exists in `programs` table for real users.
6. User lands on `/onboarding/tutorial`.
7. `Show me my plan` routes to `/program`.
8. `Skip tour` routes to `/program`.
9. `/program` does not show `No active program`.
10. Starter reveal appears once.
11. `Make this plan smarter` opens `/onboarding/deep-calibration`.
12. Deep calibration completion saves upgraded AI program active.
13. Old starter plan is archived.
14. `/program` shows upgraded reveal once.
15. `Start Workout` opens the correct generated workout.

## Notes

- `saveBuilderWorkoutForSelf(userId, payload, true)` archives all current active programs before inserting the new active program.
- This is what should archive the starter when deep calibration saves the upgraded AI program.
- The starter plan is deterministic and intentionally fast.
- The deep calibration AI generation is now blocking on finish by design, so the user sees the updated plan immediately after returning to Program.
