# CONTEXT.md — Flowstate AI

## Current session: Phase 0.2 — Responsive shell

## Status of prior phases
- Phase 0.1 complete: design tokens + Card / StatTile / SectionHeader primitives shipped, dashboard / profile / program-analytics refactored. Build green.

## Goal
Fix mobile viewport globally so modals, sticky CTAs, and bottom-nav-adjacent content are always reachable on a phone. Establish primitives that future modals and sheets must use, so the off-screen-button class of bug stops happening.

## Why this now
You're shipping to mobile-first users. The AI food modal (#18) has its confirm button positioned off-screen — that means the feature is effectively broken on the device most users will be on. This is a systemic issue, not a one-off; fixing it once at the shell level prevents it from recurring in every new modal the team builds.

## Files in scope

### Create
- `src/components/ui/Sheet.tsx` — bottom-sheet modal primitive with safe-area-aware max-height, sticky footer for primary actions, scrollable body. All future modal-style overlays use this.
- `src/components/ui/StickyFooter.tsx` — bottom action bar primitive that respects safe-area inset and sits above the bottom nav.
- `src/lib/viewport.ts` — small helper exporting `safeAreaBottom`, `safeAreaTop`, `bottomNavHeight` constants and a `useViewportHeight()` hook that uses `100dvh` with fallback.

### Modify
- `src/app/globals.css` (or equivalent) — add:
  - `html, body { height: 100%; overscroll-behavior-y: none; }`
  - `meta viewport` already correct, but verify `viewport-fit=cover` is set in the root layout so safe-area insets work
  - CSS custom properties for safe-area: `--safe-top`, `--safe-bottom`, `--bottom-nav-h`
- `src/app/layout.tsx` (root layout) — confirm viewport meta includes `viewport-fit=cover`. Add the safe-area CSS vars to the body.
- The AI food analysis modal (the one on the nutrition page that wraps Photo / Voice / Camera tabs and has the off-screen "Log meal" button) — refactor to use the new `Sheet` primitive with sticky footer.

### Find the AI food modal
Search for the component rendering "AI food analysis" header or "Upload a food photo" text. Likely in `src/app/(app)/nutrition/` or `src/components/nutrition/`. If it lives somewhere unexpected, surface the path and proceed.

### Do NOT touch
- Any save/persistence logic (Phase 1.1)
- Any data wiring (Phase 1.2)
- Workout system, AI coach, breathwork (later phases)
- Other modals beyond the AI food analysis one — they'll get migrated to the Sheet primitive in their respective phases. Goal here is build the primitive + prove it on the worst offender.
- Light mode

## Component specs

### Sheet
Props: `open: boolean`, `onClose: () => void`, `title?: string`, `children: React.ReactNode`, `footer?: React.ReactNode`
- Renders as a bottom sheet on mobile (full-width, anchored to bottom, max-height `calc(100dvh - var(--safe-top) - 1rem)`)
- Optional centered modal on `md+` breakpoints (max-width ~480px, vertically centered)
- Body is scrollable when content overflows
- Footer is sticky at the bottom of the sheet, padded with `var(--safe-bottom)` so primary actions are never under the home indicator
- Backdrop dismisses on tap; escape key closes
- Use `position: fixed` + `inset: 0` for the overlay, body content uses `flex flex-col` so footer sticks to bottom

### StickyFooter
Props: `children: React.ReactNode`, `className?: string`
- `position: sticky; bottom: 0`
- Background matches surface (use `bg-[#0d0d0d]` from tokens)
- Top border `border-t border-white/[0.06]`
- Padding: `pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]`
- Used both inside Sheet and standalone on full-page flows where the primary CTA must always be visible

### viewport.ts
```ts
export const safeAreaTop = 'env(safe-area-inset-top)'
export const safeAreaBottom = 'env(safe-area-inset-bottom)'
export const bottomNavHeight = '4rem' // confirm against actual bottom nav

export function useViewportHeight() {
  // returns the actual visible viewport height accounting for mobile browser chrome
  // implementation: useState + useEffect listening to visualViewport.resize
}
```

## Refactor rules for the AI food modal
1. Replace whatever wrapper it currently uses with `<Sheet>`.
2. Move "Log meal" / "Start over" buttons into the `footer` slot — they must be sticky and always visible.
3. The detected food list, macro tiles, and image preview go in the scrollable body.
4. Test mentally: on a 375px-wide × 667px-tall screen (iPhone SE size), is the Log meal button visible without scrolling? It must be.

## Verification
1. `npm run build` passes, zero new TS errors or warnings.
2. Load `/nutrition` on phone, open AI food analysis, upload a photo, confirm "Log meal" button is visible and tappable above the bottom nav and home indicator.
3. Rotate phone to landscape — modal still functions, footer still visible.
4. Confirm Home / Profile / Analytics pages from Phase 0.1 still render correctly (no regressions from CSS changes).

## Definition of done
- [ ] `Sheet`, `StickyFooter`, `viewport.ts` exist and are typed
- [ ] Root layout has `viewport-fit=cover` and safe-area CSS vars
- [ ] AI food analysis modal refactored to use Sheet with sticky footer
- [ ] On a real phone, "Log meal" button is reachable without scrolling or zooming
- [ ] `npm run build` passes
- [ ] Pushed to `main`, Vercel deploy green

## Out of scope (do not let this expand)
- Migrating other modals to Sheet — they get migrated when their owning phase touches them
- Fixing the broken save/persistence in the AI food flow itself (Phase 2.2 handles portion entry before logging)
- Visual redesign of the modal contents — only structural / positioning changes
- Any new features

## Notes for Claude Code
- If the AI food modal is deeply coupled to nutrition page state via props/context, preserve that wiring exactly — only change the wrapper / layout structure.
- If you discover the modal is implemented as a Radix/Headless UI Dialog or similar, build Sheet on top of that primitive rather than replacing it from scratch.
- Conservative defaults: when ambiguous, preserve existing behavior and add a `// TODO(phase-X)` comment.