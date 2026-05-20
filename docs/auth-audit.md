# Auth audit — login & logout

Snapshot of every login/logout entry point, the defects found, what's fixed
in this pass, and what's left for the wider refactor (Phases 1–5).

---

## Logout — entry points

| Where | What it calls |
|---|---|
| TopBar dropdown → "Log out" | `useUser().logout()` → `signOutEverywhere()` |
| AppShell guard (ghost session detected, no Supabase session but UUID in storage) | `signOutEverywhere()` |
| AppShell (archived account detected) | `signOutEverywhere({ redirect: "/login?error=archived" })` |
| `/onboarding` smart router (ghost session) | `signOutEverywhere()` |
| `/login` page (archived account caught during sign-in) | `signOutEverywhere({ redirect: "/login?error=archived" })` |
| `/reset-password` (after successful password change) | `supabase.auth.signOut()` direct, fire-and-forget |

## Logout — what was broken (the "sticky" symptom)

The TopBar logout chain was:
```
button click → handleItem(null) → logout() → signOutEverywhere()
                                                    │
                                                    └─ await supabase.auth.signOut()   ← NO TIMEOUT
                                                       …local storage cleanup
                                                       …window.location.href = "/login"
```

Defects:
1. **No timeout on `supabase.auth.signOut()`** — a slow/hung network call blocks every subsequent step (storage cleanup, biometric clear, navigation). The user sees nothing happen.
2. **No UI feedback** — `handleItem` doesn't `await` `logout()` and shows no spinner; the dropdown closes and the user is left wondering whether anything happened.
3. **Single Supabase sign-out path** — only the browser client is called. If that fails, the HttpOnly auth cookies are never cleared and middleware refreshes a "logged-in" session on the next page load.
4. **No fallback navigation** — if `signOutEverywhere` itself never reaches `window.location.href`, the user is stuck.

## Logout — what's fixed in this pass

1. **Hard 2.5 s timeout on the entire Supabase sign-out step** ([signOut.ts](../src/lib/auth/signOut.ts)). It can never hang the logout flow again.
2. **Parallel server-side sign-out route** ([/api/auth/sign-out](../src/app/api/auth/sign-out/route.ts)) — runs `supabase.auth.signOut()` on the SSR client so HttpOnly `sb-*` cookies get cleared via `Set-Cookie` even if the browser-side call stalls.
3. **Best-effort `sb-*` cookie sweep** in browser cookies (non-HttpOnly).
4. **TopBar shows "Signing out…"** with a spinner; the button disables. ([TopBar.tsx](../src/components/layout/TopBar.tsx))
5. **4 s safety-net redirect** in TopBar's handler — even if `signOutEverywhere` somehow doesn't navigate, the page forces `/login`.
6. **`authTrace` marks** at every signOut step so a stuck logout shows up in `dumpAuthTrace()`.

## Login — entry points (inventory only — defects deferred to Phase 1)

| File | Method |
|---|---|
| `src/app/login/page.tsx` | `signInWithPassword`, `signInWithOAuth` (Google), `signInWithOtp` (magic link) |
| `src/app/auth/callback/route.ts` | `exchangeCodeForSession`, `verifyOtp` (server-side post-OAuth/magic-link) |
| `src/app/auth/confirm/route.ts` | `exchangeCodeForSession`, `verifyOtp` (email confirmation) |
| `src/app/auth/finish/page.tsx` | client-side session settle after callback |
| `src/app/invite/[token]/page.tsx` | `signUp` then session seed |
| `src/app/forgot-password/page.tsx` | `resetPasswordForEmail` (fixed prior turn) |
| `src/app/reset-password/page.tsx` | client-side `exchangeCodeForSession` / `verifyOtp` (fixed prior turn) |
| `src/app/join/page.tsx` | invite-driven sign-in |

## Login — known issues (queued for Phase 1)

These are not "stuck" today, but they're the same root-cause family that produced the logout hang. Phase 1 (single hardened data layer) will eliminate them in one pass:

- `signInWithPassword`, `signInWithOAuth`, `signInWithOtp` in `/login` are awaited with **no timeout**.
- `/auth/callback` and `/auth/confirm` route handlers `await exchangeCodeForSession(code)` server-side — vulnerable to the same email-prefetch consumption that broke password reset (the recovery flow is now patched, but generic OAuth/magic-link still flow through `/auth/callback`).
- `/auth/finish` uses a client-side `getSession` poll loop with its own retry — duplicates logic in AppShell and UserContext.
- No central retry/error-surfacing helper, so individual sign-in errors surface with bespoke messages or get swallowed.

## How to validate the logout fix

1. Deploy.
2. Log in.
3. Click avatar → "Log out".
   - You should immediately see the button switch to a spinner + "Signing out…".
   - Within ~2.5 s (or sooner) you land on `/login`.
4. Open DevTools → Console → run `dumpAuthTrace()` and you should see entries like:
   ```
   signOut  ok=true  0ms  (start)
   signOut.supabase  ok=true  Nms  (ok | timeout 2500ms)
   signOut  ok=true  0ms  (local cleanup done — navigating)
   ```
5. If the trace shows `timeout 2500ms`, that's the new behavior catching a slow Supabase call — logout still completes locally, you still land on `/login`, the bug is no longer "sticky."

## Next (Phase 1 plan — applied to login)

A single `safeSupabase(call, { timeout, label })` wrapper that:
- Adds a uniform timeout to every auth call.
- Returns a typed `Result` (no more naked throws).
- Logs to `authTrace` automatically.
- Replaces every naked `await supabase.auth.*` in the login surface above.

That's the next deliverable once the user pastes a real auth trace from a live reproduction.
