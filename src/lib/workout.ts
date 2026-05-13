// ─── Types ────────────────────────────────────────────────────────────────────

export type WarmUpItem = {
  id:           string;
  name:         string;
  description:  string;
  durationSecs?: number;
  reps?:        string;
  targetArea:   string;
  category:     "general" | "activation" | "mobility";
};

export type WorkoutSet = {
  setNumber:   number;
  targetReps:  string;
  targetLoad:  string;
  restSeconds: number;
  rpe:         number;
};

export type WorkoutExercise = {
  exerciseId:    string;
  name:          string;
  notes:         string;
  sets:          WorkoutSet[];
  substitutions: string[];
};

export type Warmup = {
  general:    WarmUpItem[];
  activation: WarmUpItem[];
  mobility:   WarmUpItem[];
};

export type Workout = {
  workoutId:         string;   // array index as string
  name:              string;
  scheduledDay:      number;   // 0=Sunday … 6=Saturday
  dayLabel:          string;
  focus:             string;
  warmup:            Warmup;
  exercises:         WorkoutExercise[];
  estimatedDuration: number;   // minutes
};

export type ActiveProgram = {
  programId:     string;
  name:          string;
  description:   string;
  goal:          string;
  durationWeeks: number;
  currentWeek:   number;
  startDate:     string;
  split:         string;
  daysPerWeek:   number;
  workouts:      Workout[];
};

// ─── Log types ────────────────────────────────────────────────────────────────

export type Feel = "easy" | "good" | "hard";

export type SetLog = {
  setNumber:      number;
  completedReps:  string;
  completedLoad:  string;
  rpe?:           number;
  feel?:          Feel;
  completed:      boolean;
};

export type ExerciseLog = {
  exerciseId: string;
  name:       string;
  setLogs:    SetLog[];
  note?:      string;
  tempo?:     string;
  rest?:      number;
};

export type WorkoutLogType = "prescribed" | "modified" | "freestyle" | "coach_note";

export type WorkoutLog = {
  logId:             string;
  workoutId:         string;
  workoutName:       string;
  userId:            string;
  startedAt:         number;
  completedAt:       number;
  durationMins:      number;
  setsCompleted:     number;
  exercises:         ExerciseLog[];
  difficulty?:       number;
  notes?:            string;
  // Voice / log type fields
  logType?:          WorkoutLogType;  // defaults to "prescribed" when absent
  voiceTranscript?:  string;          // raw transcript if voice-logged
  voiceEntryId?:     string;          // reference to VoiceEntry in voiceLogs
  parsedConfidence?: number;          // parser confidence 0–1
  bodyFocus?:        string;          // for freestyle logs
};

// ─── Storage keys ─────────────────────────────────────────────────────────────

const PROG_KEY = (uid: string) => `flowstate-generated-program-${uid}`;
const LOGS_KEY = (uid: string) => `flowstate-workout-logs-${uid}`;
const META_KEY = (uid: string) => `flowstate-program-meta-${uid}`;
const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRealUser(userId: string): boolean {
  return _UUID_RE.test(userId) && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
}

type ProgramMeta = { programId: string; startDate: string };

type StoredProgram = {
  id:          string;
  name:        string;
  description: string;
  weeks:       number;
  daysPerWeek: number;
  split:       string;
  goal:        string;
  week1:       Array<{
    day:       number;
    dayLabel:  string;
    focus:     string;
    exercises: Array<{ name: string; sets: number; reps: string; note?: string }>;
  }>;
};

function toActiveProgram(stored: StoredProgram, meta: ProgramMeta): ActiveProgram {
  const weeksPassed = Math.floor((Date.now() - new Date(meta.startDate).getTime()) / 6.048e8);
  const currentWeek = Math.min(Math.max(weeksPassed + 1, 1), stored.weeks);

  const workouts: Workout[] = stored.week1.map((w, idx) => ({
    workoutId:         String(idx),
    name:              w.focus,
    scheduledDay:      w.day,
    dayLabel:          w.dayLabel,
    focus:             w.focus,
    warmup:            generateWarmUp(w.focus),
    exercises:         w.exercises.map((ex, eIdx) => enrichExercise(ex, eIdx)),
    estimatedDuration: Math.max(40, w.exercises.length * 9),
  }));

  return {
    programId:     stored.id,
    name:          stored.name,
    description:   stored.description,
    goal:          stored.goal,
    durationWeeks: stored.weeks,
    currentWeek,
    startDate:     meta.startDate,
    split:         stored.split,
    daysPerWeek:   stored.daysPerWeek,
    workouts,
  };
}

function isStoredWeek(value: unknown): value is StoredProgram["week1"] {
  return Array.isArray(value);
}

// ─── Warm-up generator ────────────────────────────────────────────────────────

function wu(
  id: string, name: string, desc: string, area: string,
  cat: WarmUpItem["category"],
  extra: Partial<WarmUpItem> = {}
): WarmUpItem {
  return { id, name, description: desc, targetArea: area, category: cat, ...extra };
}

export function generateWarmUp(focus: string): Warmup {
  const f = focus.toLowerCase();

  if (f.includes("push") || f.includes("chest") || f.includes("upper")) {
    return {
      general: [
        wu("lc_p", "Light Cardio", "5 minutes of light cycling or brisk walking to elevate heart rate.", "full body", "general", { durationSecs: 300 }),
        wu("arm_cir", "Arm Circles", "Large circles forward and backward to warm the shoulder joint.", "shoulders", "general", { durationSecs: 30 }),
      ],
      activation: [
        wu("bpa_p", "Band Pull-Aparts", "Pull a resistance band apart at shoulder height, arms straight. Rear delt focus.", "rear delts", "activation", { reps: "2×20" }),
        wu("pup_plus", "Push-Up Plus", "At the top of a push-up, protract shoulder blades fully. Serratus activation.", "serratus anterior", "activation", { reps: "2×10" }),
        wu("sh_tap", "Shoulder Tap Plank", "In a plank, tap alternate shoulders. Keep hips level and core locked.", "shoulders / core", "activation", { durationSecs: 30 }),
      ],
      mobility: [
        wu("chest_door", "Chest Doorway Stretch", "Forearms on a doorway, lean forward to open chest and anterior shoulder.", "chest / anterior shoulder", "mobility", { durationSecs: 30 }),
        wu("thor_rot_p", "Thoracic Rotation", "Half-kneeling: rotate upper body open on each side.", "thoracic spine", "mobility", { reps: "10 each side" }),
        wu("wrist_cir", "Wrist Circles", "Full circles both directions — prep wrists for pressing load.", "wrists", "mobility", { durationSecs: 20 }),
      ],
    };
  }

  if (f.includes("pull") || f.includes("back") || f.includes("lat") || f.includes("bicep")) {
    return {
      general: [
        wu("lc_pu", "Light Cardio", "5 minutes of light cardio to elevate heart rate.", "full body", "general", { durationSecs: 300 }),
        wu("arm_sw", "Arm Swings", "Swing arms forward and across the chest to mobilize the shoulder joint.", "shoulders", "general", { durationSecs: 30 }),
      ],
      activation: [
        wu("scap_pu", "Scapular Pull-Ups", "Hang from a bar, depress and retract shoulder blades without bending elbows.", "lower traps / rhomboids", "activation", { reps: "2×10" }),
        wu("bpa_pu", "Band Pull-Aparts", "Pull band apart at shoulder height. Squeeze shoulder blades at end range.", "rear delts", "activation", { reps: "2×20" }),
        wu("dead_hang", "Dead Hang", "Hang passively to decompress the spine and stretch the lats.", "lats / spine", "activation", { durationSecs: 30 }),
      ],
      mobility: [
        wu("lat_str", "Lat Stretch", "Hold a rack, sit hips back, feel the lat stretch down the side.", "lats", "mobility", { durationSecs: 30 }),
        wu("chest_open", "Chest Opener", "Clasp hands behind back and lift gently to open the anterior chain.", "chest / anterior shoulder", "mobility", { durationSecs: 30 }),
        wu("neck_roll", "Neck Rolls", "Slow, controlled neck rolls to release upper trap tension.", "neck / traps", "mobility", { durationSecs: 20 }),
      ],
    };
  }

  if (f.includes("leg") || f.includes("lower") || f.includes("glute") || f.includes("quad") || f.includes("hamstring")) {
    return {
      general: [
        wu("lc_lo", "Light Cardio", "5 minutes on the bike or treadmill to warm up the lower body.", "full body", "general", { durationSecs: 300 }),
        wu("hip_cir", "Hip Circles", "Standing on one leg, large hip circles each direction per leg.", "hips", "general", { reps: "10 each direction" }),
      ],
      activation: [
        wu("glute_br", "Glute Bridges", "Supine: drive hips up and squeeze glutes hard at the top. 1-second hold.", "glutes", "activation", { reps: "2×15" }),
        wu("clam", "Clamshells", "Lying on side, knees bent. Rotate top knee up. Keep pelvis stable.", "glute medius", "activation", { reps: "2×15 each side" }),
        wu("bnd_walk", "Banded Side Walk", "Band around ankles, slight squat. Side-step 10 reps each direction.", "glutes / hip abductors", "activation", { reps: "2×10 each side" }),
      ],
      mobility: [
        wu("hf_str", "Hip Flexor Stretch", "Half-kneeling lunge: push hips forward and hold. Slight posterior tilt.", "hip flexors", "mobility", { durationSecs: 30 }),
        wu("ankle_cir", "Ankle Circles", "Seated circles both directions to improve dorsiflexion range.", "ankles", "mobility", { durationSecs: 20 }),
        wu("pigeon", "Pigeon Pose", "Bring one knee toward same-side wrist from all fours. Deep hip stretch.", "hip external rotators / glutes", "mobility", { durationSecs: 45 }),
      ],
    };
  }

  // Full body / default
  return {
    general: [
      wu("lc_fb", "Light Cardio", "5 minutes of light cardio to elevate heart rate and increase blood flow.", "full body", "general", { durationSecs: 300 }),
      wu("jj", "Jumping Jacks", "30 seconds to activate the full body and elevate breathing.", "full body", "general", { durationSecs: 30 }),
    ],
    activation: [
      wu("bwsq", "Bodyweight Squat", "Controlled squats — focus on depth and knee tracking. No load.", "quads / glutes", "activation", { reps: "2×15" }),
      wu("pup_fb", "Push-Up", "Full range push-ups to activate chest, shoulders, and triceps.", "chest / shoulders", "activation", { reps: "2×10" }),
      wu("gb_fb", "Glute Bridge", "Drive hips up from supine, squeeze glutes hard at the top.", "glutes / hamstrings", "activation", { reps: "2×15" }),
    ],
    mobility: [
      wu("wgs", "World's Greatest Stretch", "Lunge forward, rotate upper body open, reach arm to sky. Both sides.", "hips / thoracic spine", "mobility", { reps: "5 each side" }),
      wu("thor_rot_fb", "Thoracic Rotation", "Half-kneeling rotation to open the upper back each side.", "thoracic spine", "mobility", { reps: "10 each side" }),
      wu("hf_fb", "Hip Flexor Stretch", "Half-kneeling: push hips forward with slight posterior pelvic tilt.", "hip flexors", "mobility", { durationSecs: 30 }),
    ],
  };
}

// ─── Exercise cues ────────────────────────────────────────────────────────────

const CUES: Record<string, string> = {
  "Bench Press":              "Control the descent. Touch chest. Drive up explosively.",
  "Incline Dumbbell Press":   "Slight arch. Elbows ~75°. Full stretch at bottom.",
  "Incline DB Press":         "Slight arch. Elbows ~75°. Full stretch at bottom.",
  "Cable Fly":                "Slight elbow bend. Chest stretch at bottom, squeeze at top.",
  "Dips":                     "Lean forward for chest emphasis. Lock out at top.",
  "Overhead Press":           "Tuck elbows slightly in. Press straight up. Full lockout.",
  "Lateral Raise":            "Lead with elbows. Don't shrug. Slight forward torso lean.",
  "Front Raise":              "Controlled up to shoulder height. Slow negative.",
  "Barbell Squat":            "Brace hard. Chest up. Knees track over toes. Hit depth.",
  "Deadlift":                 "Neutral spine. Bar close to body. Drive hips through at lockout.",
  "Romanian Deadlift":        "Hip hinge, slight knee bend. Feel the hamstring stretch deeply.",
  "Leg Press":                "Feet hip-width. Don't let knees cave. Full ROM.",
  "Leg Curl":                 "Avoid hip flexion. Controlled negative. Full extension.",
  "Leg Extension":            "Squeeze quads at top. Controlled negative.",
  "Standing Calf Raise":      "Full stretch at bottom. Pause. Squeeze hard at top.",
  "Pull-ups":                 "Full dead hang at bottom. Lead with elbows. Chin over bar.",
  "Cable Row":                "Retract blades first. Keep torso upright throughout.",
  "Lat Pulldown":             "Pull to upper chest. Full stretch with arms extended.",
  "Barbell Row":              "Hinge at 45°. Pull to lower chest. Retract blades.",
  "Face Pulls":               "Pull to face, elbows high. Externally rotate at end range.",
  "Tricep Pushdown":          "Elbows pinned to sides. Full extension at bottom.",
  "Skull Crushers":           "Elbows vertical, no flare. Lower to forehead level. Controlled.",
  "Barbell Curl":             "No swinging. Full extension at bottom. Squeeze at top.",
  "Dumbbell Curl":            "Slight supination as you curl. Full ROM.",
  "Hammer Curl":              "Neutral grip throughout. Elbows fixed at sides.",
};

// ─── Exercise enrichment ──────────────────────────────────────────────────────

function enrichExercise(
  raw:  { name: string; sets: number; reps: string; note?: string },
  idx:  number,
): WorkoutExercise {
  const low  = parseInt(raw.reps.split(/[–\-]/)[0]) || 8;
  const rest = low <= 5 ? 180 : low <= 8 ? 120 : low <= 12 ? 90 : 60;
  const rpe  = low <= 5 ? 9   : low <= 8 ? 8.5 : 8;

  return {
    exerciseId:    `${raw.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${idx}`,
    name:          raw.name,
    notes:         CUES[raw.name] ?? raw.note ?? "",
    substitutions: [],
    sets:          Array.from({ length: raw.sets }, (_, i) => ({
      setNumber:   i + 1,
      targetReps:  raw.reps,
      targetLoad:  "",
      restSeconds: rest,
      rpe,
    })),
  };
}

// ─── Load active program ──────────────────────────────────────────────────────

export function loadActiveProgram(userId: string): ActiveProgram | null {
  try {
    const raw = localStorage.getItem(PROG_KEY(userId));
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredProgram;

    let meta: ProgramMeta;
    const rawMeta = localStorage.getItem(META_KEY(userId));
    if (rawMeta) {
      meta = JSON.parse(rawMeta) as ProgramMeta;
    } else {
      meta = { programId: stored.id, startDate: new Date().toISOString().split("T")[0] };
      localStorage.setItem(META_KEY(userId), JSON.stringify(meta));
    }

    return toActiveProgram(stored, meta);
  } catch {
    return null;
  }
}

export async function loadActiveProgramForUser(userId: string): Promise<ActiveProgram | null> {
  if (isRealUser(userId)) {
    try {
      const { getActiveProgram } = await import("@/lib/db/programs");
      const dbProgram = await getActiveProgram(userId);

      if (dbProgram && isStoredWeek(dbProgram.weekly_split)) {
        const stored: StoredProgram = {
          id:          dbProgram.id,
          name:        dbProgram.block_name,
          description: dbProgram.coaching_notes ?? `${dbProgram.duration_weeks}-week ${dbProgram.goal} program.`,
          weeks:       dbProgram.duration_weeks,
          daysPerWeek: dbProgram.weekly_training_days,
          split:       Array.isArray(dbProgram.body_focus_areas) && dbProgram.body_focus_areas.length
            ? dbProgram.body_focus_areas.join(" / ")
            : "Custom",
          goal:        dbProgram.goal,
          week1:       dbProgram.weekly_split,
        };
        const meta = {
          programId: dbProgram.id,
          startDate: dbProgram.start_date ?? dbProgram.created_at.split("T")[0],
        };
        const active = toActiveProgram(stored, meta);
        try {
          localStorage.setItem(PROG_KEY(userId), JSON.stringify(stored));
          localStorage.setItem(META_KEY(userId), JSON.stringify(meta));
        } catch { /* ignore */ }
        return active;
      }
    } catch (error) {
      console.error("[workout] loadActiveProgramForUser Supabase error:", error);
    }
    return null;
  }

  return loadActiveProgram(userId);
}

// ─── Workout log CRUD ─────────────────────────────────────────────────────────

export function getWorkoutLogs(userId: string): WorkoutLog[] {
  try {
    const raw = localStorage.getItem(LOGS_KEY(userId));
    return raw ? (JSON.parse(raw) as WorkoutLog[]) : [];
  } catch {
    return [];
  }
}

export async function getWorkoutLogsForUser(userId: string): Promise<WorkoutLog[]> {
  if (isRealUser(userId)) {
    try {
      const { getWorkoutLogsFromDB, dbLogToLocal } = await import("@/lib/db/workoutLogs");
      const dbLogs = await getWorkoutLogsFromDB(userId);
      return dbLogs.map(dbLogToLocal).sort((a, b) => b.completedAt - a.completedAt);
    } catch (error) {
      console.error("[workout] getWorkoutLogsForUser Supabase error:", error);
      return [];
    }
  }

  return getWorkoutLogs(userId);
}

export function saveWorkoutLog(userId: string, log: WorkoutLog): void {
  if (isRealUser(userId)) {
    import("@/lib/db/workoutLogs").then(({ syncWorkoutLog }) => {
      syncWorkoutLog(log).catch((error) => {
        console.error("[workout] saveWorkoutLog Supabase error:", error);
      });
    }).catch((error) => {
      console.error("[workout] saveWorkoutLog import error:", error);
    });
    return;
  }

  try {
    const logs = getWorkoutLogs(userId);
    const idx  = logs.findIndex((l) => l.logId === log.logId);
    if (idx >= 0) logs[idx] = log; else logs.push(log);
    localStorage.setItem(LOGS_KEY(userId), JSON.stringify(logs));
  } catch { /* ignore */ }

}

export function getLogsThisWeek(userId: string): WorkoutLog[] {
  const logs  = getWorkoutLogs(userId);
  const now   = new Date();
  const day   = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - day);
  weekStart.setHours(0, 0, 0, 0);
  return logs.filter((l) => l.completedAt >= weekStart.getTime());
}

export async function getLogsThisWeekForUser(userId: string): Promise<WorkoutLog[]> {
  const logs = await getWorkoutLogsForUser(userId);
  const now   = new Date();
  const day   = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - day);
  weekStart.setHours(0, 0, 0, 0);
  return logs.filter((l) => l.completedAt >= weekStart.getTime());
}

export function getPreviousPerf(
  logs: WorkoutLog[],
  exerciseName: string,
): { reps: string; load: string } | null {
  const relevant = logs
    .filter((l) => l.exercises.some((e) => e.name === exerciseName))
    .sort((a, b) => b.completedAt - a.completedAt);
  if (!relevant.length) return null;
  const exLog = relevant[0].exercises.find((e) => e.name === exerciseName);
  if (!exLog) return null;
  const done  = exLog.setLogs.filter((s) => s.completed && s.completedLoad !== "");
  if (!done.length) return null;
  const best  = [...done].sort((a, b) => Number(b.completedLoad) - Number(a.completedLoad))[0];
  return { reps: best.completedReps, load: best.completedLoad };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getNextWorkout(program: ActiveProgram, weekLogs: WorkoutLog[]): Workout | null {
  const today = new Date().getDay();
  const completedDaysToday = new Set(
    weekLogs
      .filter((l) => {
        const d = new Date(l.completedAt);
        return d.toDateString() === new Date().toDateString();
      })
      .map((l) => new Date(l.completedAt).getDay())
  );

  // Today's workout if not yet done
  const todayW = program.workouts.find((w) => w.scheduledDay === today);
  if (todayW && !completedDaysToday.has(today)) return todayW;

  // Next scheduled workout
  for (let offset = 1; offset <= 7; offset++) {
    const nextDay = (today + offset) % 7;
    const w = program.workouts.find((wk) => wk.scheduledDay === nextDay);
    if (w) return w;
  }

  return program.workouts[0] ?? null;
}

export function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
