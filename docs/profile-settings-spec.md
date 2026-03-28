# Flowstate AI — Profile & Settings Spec

**Version:** 1.1
**Type:** Product Specification
**Supersedes:** Block 4 profile spec (original)

---

## 1. Role Visibility Rules

### 1.1 Current behavior (deprecated)

The profile page previously showed all four roles (Member, Client, Trainer, Master) as selectable cards. This was a development convenience and is not the correct production behavior.

### 1.2 Correct behavior

A user sees **only their own role** in the profile settings. The role is displayed as a read-only badge — not a selector.

| User's role | What they see in Profile                       |
|-------------|------------------------------------------------|
| member      | Role badge: "Member" — read-only               |
| client      | Role badge: "Client" — read-only               |
| trainer     | Role badge: "Trainer" — read-only              |
| master      | Role switcher — can change any user's role     |

### 1.3 Role display component

Replace the 2×2 role selector grid with a single read-only row:

```
Role
────────────────────────────────────────
[Trainer badge]  Assigned by your operator.
```

- Badge color follows the existing `ROLE_COLOR` map
- A one-line description of what the role means (same text as before, not selectable)
- No checkmarks, no click behavior, no grid

### 1.4 Master exception

Masters see their own role badge plus a separate "Role management" entry that links to the Master Dashboard user table — where role changes are actually made. Role changes are not done in the self-service profile screen even for masters.

### 1.5 Client-trainer relationship display

If the user is a client with an assigned trainer, show a read-only "Your coach" section directly below the role row:

```
Your coach
────────────────────────────────────────
[Trainer initials avatar]  Jordan Lee  ·  Assigned Jan 2025
```

- No edit controls
- Trainer assignment is managed by the trainer or master only

---

## 2. Training Difficulty Setting

### 2.1 Location

Training Difficulty lives in the **Coaching** section of Profile Settings, directly below "Coaching tone." It is always visible regardless of role — but behavior differs:

| Role    | Can edit?                       |
|---------|---------------------------------|
| member  | Yes — 2x/month limit applies    |
| client  | Yes — 2x/month limit applies    |
| trainer | Yes (their own profile only)    |
| master  | Yes (their own profile only)    |

Trainer/master override for a *client's* push level happens in the client management view, not the client's own profile.

### 2.2 Component spec

**Component type:** Horizontal slider with labeled range markers

**Slider:**
- 10 discrete steps (1–10), snap to integer
- Track: `bg-white/8`
- Filled track: `bg-[#B48B40]` from 0 to current value
- Thumb: `bg-[#B48B40]` circle, slightly raised on active

**Range labels (below the slider):**
```
Easy    Light    Average    Hard    Extra hard
1  2  3  4  5  6  7  8  9  10
```
Labels sit at the midpoint of each band:
- Easy: below 1–2
- Light: below 3–4
- Average: below 5–6
- Hard: below 7–8
- Extra hard: below 9–10

**Active label display:**
A single line above the slider shows the current value and its label:

```
Level 7 — Hard
```

Color of the label text scales with intensity:
- 1–4: `text-white/55`
- 5–6: `text-white/70`
- 7–8: `text-amber-400`
- 9–10: `text-[#F87171]`

### 2.3 Change limit display

Below the slider, show the remaining changes inline:

**When changes remain:**
```
text-white/28, text-xs
"2 changes remaining this month"
```

**When 1 change remains:**
```
text-amber-400/70, text-xs
"1 change remaining this month"
```

**When limit is reached:**
```
text-white/20, text-xs
"No changes remaining. Resets April 1."
```

When the limit is reached, the slider is visually disabled (opacity 40%) and non-interactive. Attempting to drag it shows the reset message inline — no toast, no modal.

### 2.4 Coach-set state

When a trainer or master has set the push level for this user:

- Slider renders at the override value
- Slider is non-interactive for the user (disabled state)
- Label below reads: *"Set by your coach."* in `text-white/28`
- No change count is shown (irrelevant when coach-controlled)
- Trainer can see this field in the client management view with full edit access

---

## 3. Full Profile Settings Structure (Updated)

### Section order

1. Profile header (avatar, name, role badge, status)
2. Your coach *(clients only, read-only)*
3. Coaching
4. Display
5. Notifications
6. Account
7. Danger zone *(delete account — collapsed by default)*

### Section: Coaching

| Setting            | Component       | Notes                                           |
|--------------------|-----------------|--------------------------------------------------|
| Coaching tone      | 3-pill toggle   | Direct / Supportive / Analytical                 |
| Training difficulty| Slider (1–10)   | 2x/month limit, coach override                  |
| Units              | 2-pill toggle   | Metric / Imperial                                |

### Section: Display

| Setting               | Component     | Notes                          |
|-----------------------|---------------|--------------------------------|
| Default dashboard     | 3-pill toggle | Overview / Program / Nutrition |

### Section: Notifications

| Setting               | Component | Default |
|-----------------------|-----------|---------|
| Workout reminders     | Toggle    | On      |
| Nutrition check-ins   | Toggle    | On      |
| AI adjustments        | Toggle    | On      |
| Weekly summary        | Toggle    | Off     |

### Section: Account

| Field          | Type      | Notes                        |
|----------------|-----------|------------------------------|
| Email          | Read-only |                              |
| Member since   | Read-only |                              |
| Plan           | Read-only | Links to /pricing for upgrade|

---

## 4. Profile Page Code Changes Required

The following changes are needed to align the current `/profile` page with this spec:

### 4.1 Remove role selector grid

Remove the 2×2 role grid (`ROLES.map(...)`) and `setRole()` call.

Replace with a read-only role display:

```tsx
// Read-only role row
<SettingsCard>
  <SettingsRow label="Role">
    <span className={cn(
      "text-xs font-semibold tracking-[0.08em] uppercase px-2 py-0.5 rounded-md border",
      ROLE_COLOR[user.role]
    )}>
      {ROLE_LABELS[user.role]}
    </span>
  </SettingsRow>
  {user.role === "client" && assignedTrainer && (
    <SettingsRow label="Your coach" last>
      <span className="text-xs text-white/40">{assignedTrainer.name}</span>
    </SettingsRow>
  )}
</SettingsCard>
```

### 4.2 Add Training Difficulty slider

Add between "Coaching tone" and "Units" rows in the Coaching section.

State required:
```ts
const [pushLevel, setPushLevel]             = useState(6);
const [pushChangesUsed, setPushChangesUsed] = useState(0);
const PUSH_LIMIT = 2;
```

Change handler:
```ts
function handlePushLevelChange(newLevel: number) {
  if (pushChangesUsed >= PUSH_LIMIT) return;
  setPushLevel(newLevel);
  setPushChangesUsed((n) => n + 1);
}
```

Push level labels:
```ts
const PUSH_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Easy",       color: "text-white/55"  },
  2: { label: "Easy",       color: "text-white/55"  },
  3: { label: "Light",      color: "text-white/55"  },
  4: { label: "Light",      color: "text-white/55"  },
  5: { label: "Average",    color: "text-white/70"  },
  6: { label: "Average",    color: "text-white/70"  },
  7: { label: "Hard",       color: "text-amber-400" },
  8: { label: "Hard",       color: "text-amber-400" },
  9: { label: "Extra hard", color: "text-[#F87171]" },
  10:{ label: "Extra hard", color: "text-[#F87171]" },
};
```

### 4.3 Add push level to mock user type

Update `MockUser` in `src/types/index.ts`:

```ts
type MockUser = {
  id:         string;
  name:       string;
  role:       Role;
  avatarUrl?: string;
  status:     UserStatus;
  pushLevel:  number;          // 1–10, default 6
  coachOverridePushLevel?: number; // set by trainer/master
};
```

Update `UserContext` mock:
```ts
const MOCK_USER: MockUser = {
  id:        "usr_001",
  name:      "Xavier Ellis",
  role:      "master",
  status:    "active",
  pushLevel: 6,
};
```

---

## 5. Decision Engine Integration Points

These are the profile fields the decision engine reads at adjustment time:

| Profile field        | Used in                                   |
|----------------------|-------------------------------------------|
| `pushLevel`          | Workout intensity adjustments (Section 4) |
| `units`              | Display of all step/weight values         |
| `coachingTone`       | AI coach message tone                     |
| `dashboardDefault`   | Default tab on app open                   |

The engine always reads `coachOverridePushLevel` first. If set, it takes precedence over the user's `pushLevel`. If not set, the user's value is used.

```ts
const effectivePushLevel = user.coachOverridePushLevel ?? user.pushLevel;
```
