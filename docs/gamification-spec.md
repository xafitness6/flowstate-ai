# Flowstate AI — Gamification System Spec

**Version:** 1.0
**Type:** Product Specification
**Tone:** Earned. High-status. Not loud.

---

## Philosophy

The gamification system in Flowstate should feel like a record of what actually happened — not a reward loop designed to manufacture engagement.

The guiding principle: **recognition, not reward**. A milestone appears because the user did something real. It doesn't flash. It doesn't pop up uninvited. It waits for the user to find it, or surfaces quietly at the right moment. The rarity of acknowledgement is what makes it feel significant.

**What this system is not:**
- Points, leaderboards, or rankings
- Daily login streaks for their own sake
- Badges for things that don't matter (first login, profile photo added)
- Notification spam disguised as progress feedback
- Confetti, animations that feel like a mobile game

**What this system is:**
- A quiet record of execution
- A reflection of momentum, not just effort
- Something that feels earned weeks after the work happened
- Visual language that communicates status without shouting it

---

## 1. Core Dimensions

The system tracks five orthogonal dimensions of performance. Each feeds a different set of signals and unlocks different recognition. They do not combine into a single score.

### 1.1 Streaks — Consistency in motion

A streak measures unbroken execution across a single behavior type. Streaks exist for training sessions, nutrition logging, and sleep targets — not a combined "all-around" streak, which is too gameable and too punishing.

**Streak types:**

| Streak           | What it tracks                                              |
|------------------|-------------------------------------------------------------|
| Training streak  | Consecutive days a session was logged (rest days don't break it if planned) |
| Nutrition streak | Consecutive days with a complete daily log                  |
| Sleep streak     | Consecutive days sleep target was hit (within 30 min)       |
| Check-in streak  | Consecutive weeks a weekly review was completed             |

**Streak rules:**
- Planned rest days do not break a training streak. The program defines which days are training days — the streak measures execution against the plan, not raw calendar days.
- A missed day resets the streak to zero. No grace periods. Accuracy matters.
- Streaks are not surfaced until Day 3 minimum. A 2-day streak is not noteworthy.
- Streaks above 7 days get a visual indicator. Above 21 days it becomes prominent.

**Streak display:**
- A subtle counter in the top corner of the relevant section (not the global header)
- A thin amber horizontal bar that fills across the week view — no numbers, just fill state
- Long streaks (30+) earn a small symbol next to the section header that persists

---

### 1.2 Milestones — Thresholds that matter

Milestones are permanent. Once reached, they stay on the user's record and cannot be undone or reset. They are tied to absolute thresholds — not relative progress, not "first time you did X."

**Milestone categories:**

**Volume milestones** — total accumulated output
- 50 sessions completed
- 100 sessions completed
- 250 sessions completed
- 500 sessions completed
- 1,000 sessions completed

**Duration milestones** — time on the platform
- 30 days active
- 90 days active
- 180 days active
- 1 year active

**Phase milestones** — structured program completion
- First phase completed
- 3 phases completed
- 5 phases completed

**Body composition milestones** — logged result, not AI prediction
- First weigh-in logged
- 5% body weight change logged
- 10% body weight change logged

**Nutrition milestones**
- 30-day nutrition log complete
- 90-day nutrition log complete
- Weekly protein target hit 4 weeks running

**Rules:**
- Milestones have no expiry and no streak component — they are permanent unlocks.
- They do not surface automatically on completion. They appear in the profile record section. A brief, quiet in-app note appears the next time the user opens the relevant section ("Something added to your record.") — no push notification.
- Milestones cannot be retroactively awarded. The system only tracks forward from the feature's activation.

---

### 1.3 Momentum — The system's read of your current trajectory

Momentum is not a streak. It is a composite signal the AI uses to assess whether the user is building or losing momentum across all tracked behaviors in a rolling 14-day window. It surfaces as a single status word, not a score.

**Momentum states:**

| State      | Visual                         | Meaning                                              |
|------------|-------------------------------|------------------------------------------------------|
| Building   | Amber — subtle glow            | All or most tracked behaviors trending upward        |
| Holding    | White/neutral                  | Consistent but not improving                         |
| Declining  | Muted red — no glow            | Two or more behaviors trending negatively            |
| Recovering | Blue — cool tone               | Coming back after a low period; trend is upward      |

**Display rules:**
- Momentum state lives in the Body Status section of the dashboard, not the header
- It does not change daily — it recalculates weekly
- The AI references it in coach messages but does not announce it unless asked
- No push notification when momentum drops. The coach may surface it in context.

**Why this matters over a score:**
A single number would invite gaming. A state communicates direction. Users optimize toward it differently — one asks "what do I need to do?" the other asks "what's the highest number I can hit?"

---

### 1.4 Phase Completion — Program-level recognition

Phase completion is the most significant event in the system. It marks the end of a structured training block — typically 4–8 weeks of accumulated work.

**On phase completion, the system:**
1. Generates a brief end-of-phase summary: sessions completed, volume logged, key lifts at start vs. end, nutrition adherence, average recovery score
2. Adds a Phase Completion card to the user's record with the phase name, date range, and key stats
3. Unlocks the next phase (if assigned) and presents the transition in the coach view
4. Marks the trainer's dashboard (if a trainer is assigned) to signal the review point

**Phase completion display:**
- A dedicated full-screen summary card that the user is taken to after logging the final session of a phase
- It reads like a brief debrief, not a celebration
- No animation beyond a slow fade in
- A single share option (image export) — off by default, not prompted

**Phase record:**
- Completed phases appear in the user's profile as a stacked timeline of cards
- Each card shows: phase name, duration, sessions completed / total, headline stat (e.g. "Squat: +12.5kg across the block")
- The timeline is minimal — a vertical line with nodes, no icons

---

### 1.5 Execution Consistency — The signal that matters most

Execution consistency is a 4-week rolling measure of plan adherence: the ratio of planned sessions to completed sessions, plus nutrition log completion rate. It is the most honest signal of whether the plan is working.

**Display:**
- Shown as a percentage in the dashboard header area: `87% consistent this month`
- Accompanied by a minimal horizontal bar — amber fill, no gradient
- Color states: 90%+ is gold, 75–89% is neutral white, below 75% is muted

**Coach behavior based on consistency:**
- Above 90%: coach focuses on optimization — load, progression, targets
- 75–89%: coach normalizes the gap, identifies the friction point
- Below 75%: coach deprioritizes targets and refocuses on removing barriers

**Consistency record:**
- Each month gets a consistency score stored in the user's record
- The profile shows a rolling 12-month consistency grid — 12 bars, no numbers on hover, just the visual shape of the year

---

## 2. Badge System

Badges are rare. The system has a small, fixed set — not an ever-expanding catalog. Rarity is the design. A user who has three badges has a more interesting record than a user with forty.

**Design language:**
- Each badge is a minimal geometric shape: circle, diamond, hexagon — no illustrations
- Two tiers: **Marked** (base level) and **Forged** (harder, longer path)
- Color: Marked = muted white/silver. Forged = amber.
- No icons inside the badge shape — the name and tier do the work

**Badge naming language:**
Names are single words or short compound phrases. They sound like designations, not achievements. They suggest identity, not action. Think: military brevity, not app store copy.

### Active badge list (MVP set — 12 total)

| Name          | Tier   | Unlock condition                                          |
|---------------|--------|-----------------------------------------------------------|
| Grounded      | Marked | 30 consecutive active days (with at least 3 sessions/week) |
| Grounded      | Forged | 90 consecutive active days                                |
| Ironside      | Marked | 100 training sessions logged                              |
| Ironside      | Forged | 500 training sessions logged                              |
| Calibrated    | Marked | 30-day nutrition log without gaps                         |
| Calibrated    | Forged | 90-day nutrition log without gaps                         |
| Phase One     | Marked | First training phase completed                            |
| Stacked       | Marked | 3 phases completed back-to-back with no gap               |
| Stacked       | Forged | 5 phases completed back-to-back with no gap               |
| Recovered     | Marked | Sleep target hit for 14 consecutive days                  |
| Zero Drift    | Marked | Execution consistency above 90% for 2 consecutive months  |
| Zero Drift    | Forged | Execution consistency above 90% for 6 consecutive months  |

**What is not a badge:**
- First session logged
- Profile completed
- Joining a plan
- Any action that takes less than a week to achieve
- Anything related to spending or upgrading

---

## 3. Record — The User's Permanent File

The record is the primary surface for all gamification output. It lives in the Profile section under a tab called "Record." It is not the default tab — the user navigates to it intentionally.

**Record sections:**

### 3.1 Badges earned
- Grid of earned badges only — not greyed-out locked badges
- A user who has earned nothing sees: "Nothing here yet. The record fills as you work."
- Hovering/tapping a badge shows the badge name, tier, date earned, and a single line of context ("100 sessions completed.")

### 3.2 Phase history
- Vertical timeline of completed phases
- Each node: phase name, date range, adherence %, headline stat
- Minimal — no illustration, no animation

### 3.3 Consistency grid
- 12 monthly bars showing rolling consistency % — the shape of the past year
- No tooltip needed. The visual communicates enough.

### 3.4 Milestones
- Flat list, most recent first
- Each entry: milestone name + date
- No icons, no illustration — just text

---

## 4. Notification & Surface Rules

The gamification system should have a quiet footprint in the notification layer.

| Event                     | Notification behavior                                          |
|---------------------------|----------------------------------------------------------------|
| Streak hits 7 days        | No push. A subtle badge on the relevant section icon.          |
| Streak hits 21 days       | No push. In-app note on next open: "21-day streak. Still moving." |
| Streak broken             | No notification at all. Silence is the message.               |
| Badge earned              | No push. In-app: "Something added to your record." One line.  |
| Phase completed           | In-app summary card surfaces after the final session is logged.|
| Milestone hit             | No push. Appears in Record. In-app note: "Something added."   |
| Momentum state changes    | No notification. AI may reference it in the next coach message.|

**Push notification policy:** The gamification system sends zero push notifications. This is a hard rule. Push is reserved for time-sensitive actions: scheduled session reminders, coach messages, plan adjustments.

---

## 5. UI Treatment Summary

### Typography and color
- Streak numbers: `text-[#B48B40]`, slightly smaller than body, tabular-nums
- Momentum states: state word only, color-coded, no icon
- Badges in Record: `text-white/70` for Marked, `text-[#B48B40]` for Forged
- Phase cards in timeline: muted border, no background fill, minimal padding

### Motion
- Record tab: no entrance animation — contents are already there
- Phase completion summary: slow fade in (600ms), no bounce or scale
- Badge appearance in Record: static — appears on next load, not via live animation
- Streak counter: number updates without animation

### Density
- A user with 2 years of data should not see an overwhelming Record
- Phase cards paginate at 6 — "Show more" text link below
- Consistency grid shows the last 12 months only — no infinite scroll backward
- Badges: maximum 12 in the MVP set. No expansion until Phase 2.

### Absence design
- Empty states use plain text — no illustration, no encouraging copy, no empty-state art
- The system does not explain what it would show if the user had data
- It simply says nothing until there is something to say

---

## 6. Edge Cases and Rules

**Streak restoration:** Not allowed. A broken streak is broken. There is no "restore" purchase, no grace period, no coach override. This is what makes the streak meaningful.

**Multi-device:** Streaks and milestones are tied to the account, not the device. A session logged on any surface counts.

**Retroactive data:** If a user imports historical data (Phase 2 feature), milestones and phase records can be calculated retroactively. Streaks cannot — they require unbroken real-time data.

**Trainer visibility:** Trainers see their clients' consistency score and phase history only. They do not see streak counts or badge records unless the client explicitly shares them. The record is the user's.

**Data deletion:** Deleting an account permanently removes all record data. There is no archive or export for gamification data at MVP.

---

## 7. Phase 2 Additions (Not MVP)

These are worth building but not at launch:

| Feature                        | Why deferred                                                     |
|--------------------------------|------------------------------------------------------------------|
| Annual review card             | Needs 12 months of data to be meaningful                        |
| Coach-issued recognition       | Requires trainer workflow design first                          |
| Social record sharing          | Requires privacy review and share UI design                     |
| Custom phase naming            | Nice-to-have — default names work at MVP                        |
| Historical import              | Complex data mapping — valuable but not blocking               |
| Team / cohort consistency view | Only meaningful when trainer has 5+ active clients             |
