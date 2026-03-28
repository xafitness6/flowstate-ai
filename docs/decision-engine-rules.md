# Flowstate AI — Decision Engine Rules

**Version:** 1.1
**Type:** Product Logic Specification

---

## 1. Step Adjustment Logic

### 1.1 Behavior

Step adjustments are adaptive. The system does not apply a fixed increment.

The default increase is **+1,000 steps**, but the engine calculates the actual delta based on:
- Current daily step average (rolling 7-day)
- Calorie deficit headroom
- Training load on the day
- User's training difficulty setting

### 1.2 Increase tiers

| Condition                                                    | Adjustment      | Estimated time shown |
|--------------------------------------------------------------|-----------------|----------------------|
| Weight flat, adherence good, low deficit pressure            | +500 steps      | ~5 min walking       |
| Weight flat, moderate deficit gap, recovery okay             | +1,000 steps    | ~10 min walking      |
| Weight flat, calorie reduction not preferred, recovery okay  | +1,500 steps    | ~15 min walking      |
| Weight flat, strong case for NEAT increase, no injury flags  | +2,000 steps    | ~20 min walking      |
| Weight flat, all other levers maxed, high confidence signal  | +2,500 steps    | ~25 min walking      |

The system never jumps more than **+2,500 steps** in a single adjustment. If more output is needed, it adds steps across consecutive days.

### 1.3 Walking time display

Whenever a step adjustment is shown to the user, display the estimated walking time alongside:

```
+1,500 steps  ·  ~15 min walking
```

Calculation: 1 minute of walking ≈ 100 steps (flat terrain, moderate pace). Round to nearest 5 minutes for display.

### 1.4 Step reduction

Step reductions are permitted when:
- Training load is very high (RPE 9+)
- Recovery signal is degraded
- User is sick or flagged high stress

Reductions follow the same tier structure in reverse.

---

## 2. Training Difficulty / Push Level

### 2.1 Definition

A user-set 10-point scale that controls how aggressively the AI adjusts training variables when the system would otherwise increase load.

This is not an effort rating. It is a **ceiling preference** — how hard the user wants to be pushed by the system.

### 2.2 Scale

| Level | Label       | System behavior                                                  |
|-------|-------------|------------------------------------------------------------------|
| 1–2   | Easy        | Maintain current load. No increases unless asked explicitly.     |
| 3–4   | Light       | Conservative increases. Small rep bumps only. No set additions.  |
| 5–6   | Average     | Standard progression. Weight, reps, or sets increased normally.  |
| 7–8   | Hard        | Aggressive load increases. Willing to add sets and reduce rest.  |
| 9–10  | Extra hard  | Maximum progression rate. System pushes all available levers.    |

### 2.3 Change limits

- **Users** can change this setting a maximum of **2 times per calendar month**.
- The remaining changes available are displayed inline in the profile setting.
- A change attempt beyond the limit is blocked with a message:
  > *"You've used both adjustments this month. This resets on [date]."*
- **Trainers** can override this setting for assigned clients at any time, with no frequency limit.
- **Masters** can override for any user at any time.

### 2.4 Override behavior

When a trainer or master overrides a user's push level:
- The new value is applied immediately
- The user sees the updated value in their profile
- A note appears: *"Set by your coach."*
- The user cannot change it again until their monthly reset, unless the trainer has returned control

### 2.5 Reset

Change count resets on the **1st of each calendar month**, not on a rolling 30-day window.

---

## 3. Weight-Flat Assessment Logic

When the user's weight has been flat for **5 or more days** and is expected to have moved, the engine runs a full-signal assessment before making any adjustment.

### 3.1 Inputs assessed

| Signal              | Source                       | Weight in decision |
|---------------------|------------------------------|--------------------|
| Plan adherence (%)  | Session and nutrition logs   | High               |
| Hunger level        | User-reported, 1–5 scale     | Medium             |
| Step average        | Daily step log               | Medium             |
| Workout response    | User-reported post-session   | High               |
| Training difficulty | User profile setting         | High               |
| Recovery signal     | Sleep, HRV, RPE trend        | Medium             |
| Body weight trend   | 7-day rolling average        | High               |

### 3.2 Decision tree

**Branch A: Adherence is below 80%**
> Do not adjust the plan. Coach surfaces the gap. No step increase, no calorie cut.
> Message: *"Adherence is the variable. The plan is right — let's focus on execution first."*

**Branch B: Adherence ≥ 80%, hunger ≥ 4**
> Do not reduce calories. Step increase only.
> System prefers NEAT increase over a calorie cut when hunger is elevated.
> Adjustment: +1,000 to +1,500 steps depending on recovery.

**Branch C: Adherence ≥ 80%, hunger ≤ 2, calories have room**
> Small calorie reduction is appropriate.
> Maximum single-session cut: **−150 kcal**.
> Never reduce below protein floor or into a deficit deeper than 500 kcal/day.

**Branch D: Adherence ≥ 80%, steps already high (> 12,000/day), hunger moderate**
> Step increase unlikely to be sustainable. Consider intensity increase instead.
> Apply workout intensity logic (see Section 4).

**Branch E: Mixed signals — no dominant factor**
> Apply a small mixed adjustment:
> - +500 steps
> - −75–100 kcal
> - One small training variable increase (reps only)
> Show the user all three changes together as a single grouped adjustment.

### 3.3 Output format

All weight-flat assessments surface as a grouped `AdjustmentGroup` card, not individual `AdjustmentCard` items. The headline reads:

> *"Weight has been flat for X days. Here's what I'm changing."*

The subline reads the leading cause:

> *"Based on your adherence, hunger level, and current step count."*

---

## 4. Workout Intensity Adjustment Logic

### 4.1 Trigger conditions

The system evaluates a workout intensity increase when **all three** of the following are true:

1. The user reported the last session as **"Light," "Easy," or "Too easy"** (or equivalent RPE ≤ 5)
2. Recovery signal is **not degraded** (sleep ≥ 6h, no high soreness flag, no injury flag active)
3. The same exercise or session type has been at current load for **2 or more consecutive sessions**

### 4.2 Available adjustments

The engine selects from the following levers, in order of preference:

| Lever               | Notes                                                         |
|---------------------|---------------------------------------------------------------|
| Weight increase     | First choice for compound lifts. Min +2.5kg.                 |
| Rep increase        | First choice for isolation work. +1–2 reps per set.          |
| Set addition        | Used when weight and rep increases would overshoot.           |
| Rest reduction      | Used sparingly — reduces rest by 15–30s max per adjustment.   |

The engine applies **one lever at a time** unless the push level is 9–10, in which case it may combine two.

### 4.3 Push level scaling

The user's training difficulty setting directly scales how aggressively adjustments are applied:

| Push level | Increase applied                                                   |
|------------|---------------------------------------------------------------------|
| 1–2        | No adjustment made. Flag for trainer review if applicable.         |
| 3–4        | Minimum increment only (e.g. +1 rep, no weight change).            |
| 5–6        | Standard increment (e.g. +2.5kg or +2 reps).                       |
| 7–8        | Full increment (e.g. +5kg or +2–3 reps + possible rest reduction). |
| 9–10       | Aggressive increment. May combine two levers.                       |

### 4.4 Limits

- The system never increases weight by more than **+10kg in a single adjustment**, regardless of push level.
- The system never reduces rest below **30 seconds** for compound lifts, **15 seconds** for isolation.
- If the user has an active injury flag on a specific movement, that movement is excluded from intensity adjustment.
- All intensity adjustments are shown to the user as a single card before the next session. They are not applied silently.

### 4.5 No auto-decrease

The system does not automatically decrease intensity. If recovery is degraded, the system holds load flat and flags it. Decreases require either:
- The user requesting simplification via coach chat
- A trainer or master manually overriding the program
- A multi-day recovery signal that triggers a coach recommendation

---

## 5. Signal Definitions

For consistent interpretation across all logic above.

### Hunger scale (user-reported, 1–5)
| Value | Meaning                                    |
|-------|--------------------------------------------|
| 1     | Not hungry at all                          |
| 2     | Slight hunger, manageable                  |
| 3     | Normal hunger, satisfied after meals       |
| 4     | Noticeably hungry, meals feel insufficient |
| 5     | Very hungry, difficult to stay on plan     |

### Workout response (user-reported)
| Label      | RPE equivalent | System read              |
|------------|----------------|--------------------------|
| Too easy   | ≤ 4            | Load is below threshold  |
| Easy       | 5              | Load is suboptimal       |
| Light      | 5–6            | Load is borderline       |
| Good       | 7–8            | Load is appropriate      |
| Hard       | 8–9            | Load is at ceiling       |
| Too hard   | 9–10           | Load is above threshold  |

### Recovery signal
Recovery is considered **degraded** when any two of the following are true:
- Sleep average < 6h over last 3 nights
- User-reported soreness ≥ 4/5
- Workout RPE has been ≥ 9 for 3+ consecutive sessions
- User has flagged fatigue or illness in check-in
