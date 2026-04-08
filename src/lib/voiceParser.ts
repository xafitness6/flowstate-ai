// ─── Voice intent classifier + structured data parsers ───────────────────────
//
// All parsing is regex / keyword-based with confidence scores.
// Swap classifyIntent() or the parse functions to route to an LLM
// (e.g. GPT-4o, Claude) for higher accuracy — the interfaces stay the same.

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceIntent = "chat" | "meal_log" | "workout_log" | "unknown";

export interface ParsedMealItem {
  food:      string;
  quantity?: string;
  unit?:     string;
}

export interface ParsedMeal {
  name:          string;
  items:         ParsedMealItem[];
  mealType?:     "breakfast" | "lunch" | "dinner" | "snack";
  totalCals?:    number;
  confidence:    number;
  rawTranscript: string;
}

export interface ParsedExercise {
  name:    string;
  sets?:   number;
  reps?:   string;
  load?:   string;
  notes?:  string;
}

export interface ParsedFreestyleWorkout {
  title:         string;
  bodyFocus:     string;
  exercises:     ParsedExercise[];
  durationMins?: number;
  cardio?:       string;
  notes:         string;
  confidence:    number;
  rawTranscript: string;
}

// ─── Intent classifier ────────────────────────────────────────────────────────

const MEAL_KEYWORDS = [
  "ate", "eaten", "had", "eating", "breakfast", "lunch", "dinner", "snack",
  "drank", "drink", "coffee", "tea", "protein", "calories", "meal", "food",
  "shake", "bar", "yogurt", "chicken", "rice", "eggs", "oats", "salad",
];
const WORKOUT_KEYWORDS = [
  "workout", "trained", "training", "session", "gym", "sets", "reps", "lifted",
  "ran", "run", "miles", "km", "minutes", "press", "squat", "bench", "deadlift",
  "pullups", "pull-ups", "pushups", "push-ups", "curls", "rows", "lunges",
  "cardio", "hiit", "exercise", "did", "completed",
];

export function classifyIntent(transcript: string): { intent: VoiceIntent; confidence: number } {
  const t = transcript.toLowerCase();
  const mealScore    = MEAL_KEYWORDS.filter((k) => t.includes(k)).length;
  const workoutScore = WORKOUT_KEYWORDS.filter((k) => t.includes(k)).length;

  if (mealScore === 0 && workoutScore === 0) return { intent: "chat",        confidence: 0.5  };
  if (mealScore > workoutScore)              return { intent: "meal_log",    confidence: Math.min(mealScore    / 4, 1) };
  if (workoutScore > mealScore)              return { intent: "workout_log", confidence: Math.min(workoutScore / 4, 1) };
  return { intent: "chat", confidence: 0.4 };
}

// ─── Meal parser ──────────────────────────────────────────────────────────────

const MEAL_TYPE_MAP: [string, ParsedMeal["mealType"]][] = [
  ["breakfast",    "breakfast"],
  ["lunch",        "lunch"    ],
  ["dinner",       "dinner"   ],
  ["supper",       "dinner"   ],
  ["snack",        "snack"    ],
  ["pre-workout",  "snack"    ],
  ["post-workout", "snack"    ],
  ["preworkout",   "snack"    ],
  ["postworkout",  "snack"    ],
];

function detectMealType(t: string): ParsedMeal["mealType"] {
  for (const [kw, type] of MEAL_TYPE_MAP) {
    if (t.includes(kw)) return type;
  }
  return undefined;
}

function extractMealItems(raw: string): ParsedMealItem[] {
  const t = raw.toLowerCase();
  const items: ParsedMealItem[] = [];

  // Pattern: "200g chicken" / "3 eggs" / "1 cup oats" / "2 scoops protein"
  const re =
    /(\d+(?:\.\d+)?)\s*(g|kg|oz|ml|l|cups?|tbsps?|tsps?|pieces?|slices?|scoops?|servings?|oz)?\s+(?:of\s+)?([a-z][a-z\s-]{2,28}?)(?=[,.\d]|and\b|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const food = m[3].trim().replace(/\s+/g, " ");
    if (food.length > 1) items.push({ quantity: m[1], unit: m[2] ?? undefined, food });
  }

  // Fallback: split by conjunctions / commas
  if (items.length === 0) {
    t.split(/,|\band\b/i)
      .map((p) => p.replace(/^(i (had|ate|drank)\s+)/i, "").trim())
      .filter((p) => p.length > 2 && !/^\d+$/.test(p))
      .forEach((p) => items.push({ food: p }));
  }

  return items.slice(0, 12);
}

export function parseMealFromTranscript(transcript: string): ParsedMeal {
  const t        = transcript.toLowerCase();
  const mealType = detectMealType(t);
  const items    = extractMealItems(transcript);
  const conf     = Math.min((items.length > 0 ? 0.5 : 0.2) + (mealType ? 0.3 : 0), 1);

  const name = mealType
    ? mealType.charAt(0).toUpperCase() + mealType.slice(1)
    : "Logged meal";

  return { name, items, mealType, confidence: conf, rawTranscript: transcript };
}

// ─── Workout parser ───────────────────────────────────────────────────────────

const BODY_FOCUS_MAP: [string[], string][] = [
  [["chest", "push", "bench", "fly", "pec", "dip"],                   "Push / Chest"  ],
  [["back", "pull", "row", "lat", "deadlift", "pullup", "pull-up"],   "Pull / Back"   ],
  [["leg", "squat", "quad", "hamstring", "glute", "lunge", "rdl"],    "Legs"          ],
  [["shoulder", "overhead", "press", "delt", "ohp"],                  "Shoulders"     ],
  [["arm", "bicep", "tricep", "curl", "skull"],                       "Arms"          ],
  [["core", "abs", "plank", "crunch", "sit-up"],                      "Core"          ],
  [["cardio", "run", "bike", "swim", "hiit", "circuit", "sprint"],    "Cardio"        ],
];

function detectBodyFocus(t: string): string {
  for (const [keywords, label] of BODY_FOCUS_MAP) {
    if (keywords.some((k) => t.includes(k))) return label;
  }
  return "Full Body";
}

function extractExercises(t: string): ParsedExercise[] {
  const exercises: ParsedExercise[] = [];

  // Pattern A: "3 sets of bench press at 80kg for 8 reps"
  const patA =
    /(\d+)\s+sets?\s+of\s+([a-z][a-z\s-]{2,30}?)(?:\s+(?:at|@)\s+(\d+(?:\.\d+)?)\s*(?:kg|lbs?))?(?:\s+(?:for\s+)?(\d+)\s+reps?)?/gi;
  let m: RegExpExecArray | null;
  while ((m = patA.exec(t)) !== null) {
    exercises.push({
      name: m[2].trim(),
      sets: parseInt(m[1]),
      reps: m[4] ?? undefined,
      load: m[3] ? `${m[3]}kg` : undefined,
    });
  }

  // Pattern B: "bench press 3x8 @ 80kg" or "bench press 3 x 8"
  const patB =
    /([a-z][a-z\s-]{2,30}?)\s+(\d+)\s*[x×]\s*(\d+)(?:\s*@?\s*(\d+(?:\.\d+)?)\s*(?:kg|lbs?))?/gi;
  while ((m = patB.exec(t)) !== null) {
    if (!exercises.some((e) => e.name === m![1].trim())) {
      exercises.push({
        name: m[1].trim(),
        sets: parseInt(m[2]),
        reps: m[3],
        load: m[4] ? `${m[4]}kg` : undefined,
      });
    }
  }

  // Fallback: split by "then" / "and" / commas — at least capture exercise names
  if (exercises.length === 0) {
    t.split(/\bthen\b|\band\b|,/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 3 && !/^\d+$/.test(p))
      .forEach((p) => exercises.push({ name: p }));
  }

  return exercises.slice(0, 12);
}

function extractDuration(t: string): number | undefined {
  const m = t.match(/(\d+)\s*(?:min(?:utes?)?|hour?s?|hr?s?)/i);
  if (!m) return undefined;
  const n = parseInt(m[1]);
  return /h(?:our|r)/i.test(m[0]) ? n * 60 : n;
}

function extractCardio(t: string): string | undefined {
  const m = t.match(/(\d+(?:\.\d+)?)\s*(km|miles?|m)\s+(?:run|jog|sprint|walk)/i)
         ?? t.match(/(ran|jogged|walked|cycled|swam)\s+(?:for\s+)?(.+?)(?:\.|,|$)/i);
  return m ? m[0].trim() : undefined;
}

export function parseWorkoutFromTranscript(transcript: string): ParsedFreestyleWorkout {
  const t          = transcript.toLowerCase();
  const bodyFocus  = detectBodyFocus(t);
  const exercises  = extractExercises(t);
  const durationMins = extractDuration(t);
  const cardio     = extractCardio(t);
  const conf       = exercises.length > 0 ? Math.min(0.4 + exercises.length * 0.1, 0.9) : 0.3;

  return {
    title:         `Freestyle — ${bodyFocus}`,
    bodyFocus,
    exercises,
    durationMins,
    cardio,
    notes:         transcript,
    confidence:    conf,
    rawTranscript: transcript,
  };
}
