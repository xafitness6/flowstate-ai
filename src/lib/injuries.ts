// Injury contraindication engine — the single source of "what to avoid and what
// to swap in" for an injured area. Used to (a) filter the deterministic starter
// plan, (b) feed the AI program generator, and (c) power the "Can't do" swap.
//
// It's not medical advice and won't be perfect — it's a sensible safety net that
// keeps obviously-aggravating movements out and offers a safer alternative.

export type InjuryRule = {
  match:  RegExp;        // matches the injured-area label(s) a user might pick
  avoid:  string[];      // exercise-name keywords to NEVER prescribe
  safe:   string[];      // safe alternatives to swap in (in priority order)
  note:   string;        // one-line guidance for the coach / AI
};

// Universal safe movements (don't load the lower limbs / spine much).
const UNIVERSAL_SAFE = [
  "Seated Cable Row", "Lat Pulldown", "Chest-Supported Row", "Machine Chest Press",
  "Seated Dumbbell Press", "Face Pull", "Cable Curl", "Tricep Pushdown",
];

export const INJURY_RULES: InjuryRule[] = [
  {
    match: /achilles|ankle|calf/i,
    avoid: ["calf raise", "leg press", "lunge", "step-up", "step up", "jump", "box jump", "sprint", "skater", "bound", "deadlift", "romanian", "rdl", "good morning", "running", "skipping", "plyo"],
    safe:  ["Seated Leg Curl", "Lying Leg Curl", "Leg Extension", "Hip Thrust", "Glute Bridge", ...UNIVERSAL_SAFE],
    note:  "Recently-healed/aggravated Achilles: no calf loading, jumping, lunging, leg press, or loaded standing hip-hinge (RDL/deadlift). Seated/machine lower work + upper body only.",
  },
  {
    match: /knee/i,
    avoid: ["squat", "leg press", "lunge", "leg extension", "step-up", "step up", "jump", "sprint", "pistol", "wall sit"],
    safe:  ["Seated Leg Curl", "Lying Leg Curl", "Hip Thrust", "Glute Bridge", "Romanian Deadlift", ...UNIVERSAL_SAFE],
    note:  "Knee: avoid deep knee flexion under load (squat/leg press/lunge/extension) and impact. Favor hip-hinge + hamstring + upper body.",
  },
  {
    match: /lower back|back\b|spine|lumbar/i,
    avoid: ["deadlift", "romanian", "rdl", "good morning", "barbell row", "bent-over", "bent over", "back squat", "overhead press", "hyperextension", "back extension"],
    safe:  ["Chest-Supported Row", "Leg Press", "Leg Extension", "Seated Leg Curl", "Lat Pulldown", "Machine Chest Press", "Seated Dumbbell Press"],
    note:  "Lower back: no loaded spinal flexion/extension or axial loading (deadlift/RDL/good-morning/barbell row/back squat/overhead). Use supported + machine variants.",
  },
  {
    match: /shoulder|rotator/i,
    avoid: ["overhead press", "military press", "behind the neck", "upright row", "dip", "barbell bench"],
    safe:  ["Neutral-Grip Dumbbell Press", "Machine Chest Press", "Cable Row", "Lat Pulldown", "Face Pull", "Leg Press", "Leg Extension"],
    note:  "Shoulder: avoid overhead pressing, upright rows, dips and behind-the-neck work. Neutral-grip/machine pressing + horizontal pulling.",
  },
  {
    match: /hip/i,
    avoid: ["squat", "deadlift", "lunge", "leg press", "hip thrust", "good morning"],
    safe:  ["Leg Extension", "Seated Leg Curl", "Lying Leg Curl", ...UNIVERSAL_SAFE],
    note:  "Hip: avoid deep hip flexion / heavy hinging. Isolation leg work + upper body.",
  },
  {
    match: /wrist|elbow|forearm/i,
    avoid: ["barbell curl", "skull", "close-grip", "chin-up", "pushdown", "preacher"],
    safe:  ["Hammer Curl", "Cable Curl", "Machine Chest Press", "Lat Pulldown", "Leg Press", "Leg Extension"],
    note:  "Wrist/elbow: avoid straight-bar curls, skullcrushers, close-grip and chin-ups. Neutral-grip / cable / machine.",
  },
  {
    match: /neck|trap/i,
    avoid: ["shrug", "upright row", "overhead press", "behind the neck"],
    safe:  ["Chest-Supported Row", "Machine Chest Press", "Lat Pulldown", "Leg Press"],
    note:  "Neck: avoid shrugs, upright rows and overhead loading.",
  },
];

const norm = (s: string) => s.toLowerCase();

/** Human-readable movements to consider avoiding for the chosen areas — shown as
 *  toggle chips in onboarding so the athlete dials in exactly what they can't do. */
export function suggestedAvoidMovements(areas: string[]): string[] {
  const set = new Set<string>();
  for (const rule of rulesForAreas(areas)) {
    for (const k of rule.avoid) {
      if (k.length < 3) continue;            // skip cryptic partials (rdl, etc.)
      set.add(k.replace(/\b\w/, (c) => c.toUpperCase()));
    }
  }
  return [...set];
}

/** All rules that apply to a set of injured-area labels. */
export function rulesForAreas(areas: string[]): InjuryRule[] {
  const out: InjuryRule[] = [];
  for (const rule of INJURY_RULES) {
    if (areas.some((a) => rule.match.test(a))) out.push(rule);
  }
  return out;
}

/** Build the avoid-keyword set from injured areas + a free-text note + an
 *  explicit "can't do" list (exercise names the user rejected). */
export function avoidKeywords(areas: string[], note?: string | null, explicit?: string[]): string[] {
  const set = new Set<string>();
  for (const rule of rulesForAreas(areas)) rule.avoid.forEach((k) => set.add(norm(k)));
  // Free-text: pull recognizable movement words.
  if (note) {
    for (const kw of ["calf raise", "leg press", "squat", "deadlift", "romanian", "rdl", "lunge", "jump", "run", "overhead", "bench", "row", "curl", "dip", "shrug"]) {
      if (norm(note).includes(kw)) set.add(kw);
    }
  }
  for (const e of explicit ?? []) if (e && e.trim()) set.add(norm(e.trim()));
  return [...set];
}

/** True if an exercise name is contraindicated by the avoid keywords. */
export function isContraindicated(exerciseName: string, avoid: string[]): boolean {
  const n = norm(exerciseName);
  return avoid.some((k) => k && n.includes(k));
}

/** A safe alternative for a contraindicated exercise, given the injured areas,
 *  avoiding anything already used or itself contraindicated. */
export function safeAlternative(areas: string[], avoid: string[], used: string[]): string | null {
  const usedSet = new Set(used.map(norm));
  const pool = [...rulesForAreas(areas).flatMap((r) => r.safe), ...UNIVERSAL_SAFE];
  for (const candidate of pool) {
    if (usedSet.has(norm(candidate))) continue;
    if (isContraindicated(candidate, avoid)) continue;
    return candidate;
  }
  return null;
}

/** Filter a list of {name,...} exercises: swap contraindicated ones for a safe
 *  alternative, dropping if no alternative is left. Preserves sets/reps/etc. */
export function filterExercises<T extends { name: string }>(
  exercises: T[],
  areas: string[],
  note?: string | null,
  explicit?: string[],
): T[] {
  const avoid = avoidKeywords(areas, note, explicit);
  if (avoid.length === 0) return exercises;
  const out: T[] = [];
  const used = exercises.map((e) => e.name);
  for (const ex of exercises) {
    if (!isContraindicated(ex.name, avoid)) { out.push(ex); continue; }
    const alt = safeAlternative(areas, avoid, [...used, ...out.map((o) => o.name)]);
    if (alt) out.push({ ...ex, name: alt, note: "Swapped to work around your injury" } as T);
    // else drop it entirely
  }
  return out;
}
