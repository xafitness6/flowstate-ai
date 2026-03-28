# Flowstate — Local End-to-End Testing Checklist

## Setup

```bash
npm run dev
# open http://localhost:3000
```

The **Dev Panel** appears in the bottom-left corner of every page. Use it to:
- Switch between 4 demo users (Master / Trainer / Client / Member)
- Seed 21 days of realistic demo data
- Seed a "missed days" scenario for recovery panel testing
- Simulate a first-run (clears onboarding flag)
- Reset all local data
- Quick-navigate to any route

---

## Step 1 — First-run flow

1. Open Dev Panel → **Simulate first run** → page reloads to `/onboarding`
2. Confirm welcome screen renders with 4 pillars and "Let's go →" button
3. Click **Let's go** → redirects to `/onboarding/calibration`
4. Walk through all 7 calibration steps (intro → measurements → photos → sleep → food → limitations → complete)
5. Confirm "Back to dashboard" from completion screen routes to `/`

---

## Step 2 — Dashboard (returning user)

1. Open Dev Panel → **Seed 21 days** → reloads to `/`
2. Confirm 4 dashboard cards render (AI Insight, Today's Plan, Body Status, Accountability)
3. Click **Start →** in Today's Plan → navigates to `/program` ✓
4. Click **COMMIT** in AI Insight card → button state changes to "Committed" ✓
5. Toggle **lock/unlock** icon (top-right of dashboard) → drag cards to reorder → reload → confirm order persisted
6. Open Dev Panel → test role **member** → confirm Master link is hidden in sidebar

---

## Step 3 — Program / workout

1. Navigate to `/program`
2. Check off exercises using the checkbox on each card
3. Click **Start rest** → timer overlay appears with countdown
4. Expand swap panel → select an alternative exercise → name updates
5. Click **FINISH SESSION** → post-workout popup appears
6. Select RPE (1–10) and add a session note
7. Click **Log session** → button changes to "Session logged" ✓
8. Open `/accountability` → verify "training" habit is now checked for today

---

## Step 4 — Nutrition

1. Navigate to `/nutrition`
2. Confirm page renders with mock meal data and macro bars
3. Confirm empty state doesn't crash (no data scenarios handled)

---

## Step 5 — Coach

1. Navigate to `/coach`
2. Send a message using the input or click a suggested prompt pill
3. Confirm AI response appears with simulated typing
4. Navigate to `/coach/intro` — walk through the 4-step intro flow

---

## Step 6 — Accountability

1. Navigate to `/accountability`
2. Confirm 7-day analytics strip shows stats (requires seeded data)
3. Confirm 30-day trajectory chart renders
4. Check off habits across all 4 categories
5. Confirm bottom button turns **green** when all weight-3 ("key") habits are done
6. Select an identity state → confirm it saves on reload
7. Type and save a journal entry → confirm it appears in history
8. Open Dev Panel → **Seed missed days** → reload → confirm recovery panel appears at top

---

## Step 7 — Calendar

1. Navigate to `/calendar`
2. Confirm month grid renders with event dots on seeded days
3. Click a day → confirm event detail panel updates
4. Navigate months with arrows

---

## Step 8 — Profile

1. Navigate to `/profile`
2. Confirm push level slider is interactive
3. Confirm dashboard default preference saves (select "Accountability" → go home → redirects to `/accountability`)
4. Open avatar dropdown (top-right) → confirm menu appears with View Profile / Settings / Log out

---

## Step 9 — Role-based visibility

### As Master
- Sidebar shows "Master" link
- `/master` renders full admin dashboard with user table
- Hover over a user name in master table → hover card appears with snapshot data
- Click trainer name → hover card shows trainer snapshot
- Click "Open profile" in hover card → navigates to `/profile/[id]`

### As Trainer (Jordan Lee)
- Switch to trainer via Dev Panel
- Hover cards only appear on assigned clients (Kai Nakamura, Priya Sharma, Sofia Reyes, Claire Dubois)
- No hover card on non-assigned users or other trainers

### As Client / Member
- No hover cards visible on other users
- Profile page shows own data only
- `/master` is not linked in sidebar

---

## Step 10 — Profile/ID pages

1. Navigate to `/profile/u1` (Kai Nakamura, client)
   - As master: full profile + metrics visible
   - As trainer (Jordan Lee): visible (assigned client)
   - As trainer (Marcus Webb): access restricted message
   - As client/member: access restricted message
2. Navigate to `/profile/u99` → "User not found" state

---

## Step 11 — Pricing

1. Navigate to `/pricing`
2. Toggle billing cycle (Monthly / Annual) → prices update with 20% discount
3. Expand/collapse comparison table
4. Confirm Pro plan is highlighted with amber border

---

## Step 12 — Showcase / Docs

1. Navigate to `/showcase` → AdjustmentCard components render
2. Click COMMIT on a card → state updates

---

## All Routes Inventory

| Route                    | Status   | Notes                                    |
|--------------------------|----------|------------------------------------------|
| `/`                      | ✅        | Dashboard + DnD + first-run redirect     |
| `/onboarding`            | ✅        | Welcome screen → calibration             |
| `/onboarding/calibration`| ✅        | 7-step multi-form wizard                 |
| `/dashboard`             | ✅        | Redirects to `/`                         |
| `/program`               | ✅        | Workout logger + post-completion popup   |
| `/program/builder`       | ✅        | Program builder with DnD                 |
| `/program/assign`        | ✅        | Trainer client assignment UI             |
| `/nutrition`             | ✅        | Macro & meal tracking                    |
| `/calendar`              | ✅        | Monthly view with event dots             |
| `/coach`                 | ✅        | AI chat with simulated responses         |
| `/coach/intro`           | ✅        | Onboarding coach setup flow              |
| `/accountability`        | ✅        | Full execution tracker + journal         |
| `/profile`               | ✅        | Own profile + settings                   |
| `/profile/[id]`          | ✅        | Role-gated user profile view             |
| `/master`                | ✅        | Admin dashboard (master only)            |
| `/pricing`               | ✅        | Pricing page with toggle                 |
| `/showcase`              | ✅        | Component dev showcase                   |

---

## localStorage Keys Reference

| Key                         | Content                              |
|-----------------------------|--------------------------------------|
| `flowstate-onboarded`       | `"true"` once onboarding complete    |
| `flowstate-active-role`     | Current demo role key                |
| `accountability-habits-v2`  | Habit definitions (order, visibility)|
| `accountability-logs`       | Daily logs keyed by `YYYY-MM-DD`     |
| `accountability-journal`    | Journal entry history array          |
| `workout-logs`              | Completed workout sessions           |
| `dashboard-card-order`      | Dashboard card order array           |
| `dashboard-locked`          | Layout lock boolean                  |
| `dashboard-default`         | Preferred starting screen            |

---

## Known Gaps (not blocking testing)

- Coach responses are pre-scripted; not wired to personality/profanity settings yet
- Program builder and assign pages use static mock data only
- Nutrition page uses static mock meals; no add/remove functionality
- Calendar uses static mock events; not yet wired to workout logs
- No persistent auth; role and user state is fully local/mock
