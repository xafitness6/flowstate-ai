"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionKey, ROLE_TO_USER_ID } from "@/lib/routing";
import { loadOnboardingState, completeProgramGeneration } from "@/lib/onboarding";
import { initStore } from "@/lib/data/store";

// ─── Program builder ──────────────────────────────────────────────────────────

type GeneratedWorkout = {
  day:       number;    // 1-7
  dayLabel:  string;    // "Monday"
  focus:     string;    // "Upper Body — Push"
  exercises: Exercise[];
};

type Exercise = {
  name:   string;
  sets:   number;
  reps:   string;   // "8–12" or "3x5"
  note?:  string;
};

type GeneratedProgram = {
  id:          string;
  name:        string;
  description: string;
  weeks:       number;
  daysPerWeek: number;
  split:       string;
  goal:        string;
  week1:       GeneratedWorkout[];
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function generateProgram(planning: NonNullable<ReturnType<typeof loadOnboardingState>["planningData"]>): GeneratedProgram {
  const id          = `prog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const weeks       = parseInt(planning.planDuration?.replace("_weeks", "") ?? "8", 10);
  const daysPerWeek = planning.weeklyTrainingDays ?? 4;
  const split       = planning.split ?? "upper_lower";
  const goal        = planning.planFocus ?? "muscle_gain";

  // Build workout schedule based on split type
  const workouts: GeneratedWorkout[] = [];
  const startDay = 1; // Monday

  if (split === "full_body") {
    const focusLabel = goal === "strength" ? "Full Body — Strength" : "Full Body — Hypertrophy";
    for (let i = 0; i < daysPerWeek; i++) {
      workouts.push({
        day:      (startDay + i * Math.floor(7 / daysPerWeek)) % 7,
        dayLabel: DAYS[(startDay + i * Math.floor(7 / daysPerWeek)) % 7],
        focus:    focusLabel,
        exercises: buildFullBodyWorkout(goal),
      });
    }
  } else if (split === "upper_lower") {
    const labels = ["Upper Body", "Lower Body", "Upper Body", "Lower Body"];
    for (let i = 0; i < Math.min(daysPerWeek, 4); i++) {
      workouts.push({
        day:      (startDay + i) % 7,
        dayLabel: DAYS[(startDay + i) % 7],
        focus:    labels[i % 4],
        exercises: i % 2 === 0 ? buildUpperWorkout(goal) : buildLowerWorkout(goal),
      });
    }
  } else if (split === "push_pull_legs") {
    const ppl = ["Push", "Pull", "Legs", "Push", "Pull", "Legs"];
    for (let i = 0; i < Math.min(daysPerWeek, 6); i++) {
      workouts.push({
        day:      (startDay + i) % 7,
        dayLabel: DAYS[(startDay + i) % 7],
        focus:    ppl[i % 6],
        exercises: i % 3 === 0
          ? buildPushWorkout(goal)
          : i % 3 === 1
          ? buildPullWorkout(goal)
          : buildLegWorkout(goal),
      });
    }
  } else {
    // bro_split
    const bodyParts = ["Chest", "Back", "Shoulders", "Arms", "Legs"];
    for (let i = 0; i < Math.min(daysPerWeek, 5); i++) {
      workouts.push({
        day:      (startDay + i) % 7,
        dayLabel: DAYS[(startDay + i) % 7],
        focus:    bodyParts[i % 5],
        exercises: buildBodyPartWorkout(bodyParts[i % 5], goal),
      });
    }
  }

  const splitLabel: Record<string, string> = {
    full_body:       "Full Body",
    upper_lower:     "Upper / Lower",
    push_pull_legs:  "Push / Pull / Legs",
    bro_split:       "Body Part Split",
  };

  const goalLabel: Record<string, string> = {
    muscle_gain: "Hypertrophy",
    fat_loss:    "Fat Loss",
    strength:    "Strength",
    endurance:   "Endurance",
    recomp:      "Body Recomp",
  };

  return {
    id,
    name:        `${goalLabel[goal] ?? "Performance"} Block — ${splitLabel[split] ?? split}`,
    description: `${weeks}-week ${goalLabel[goal] ?? "performance"} program. ${daysPerWeek} sessions/week. Designed around your body focus and training history.`,
    weeks,
    daysPerWeek,
    split:       splitLabel[split] ?? split,
    goal,
    week1:       workouts,
  };
}

// ─── Exercise templates ───────────────────────────────────────────────────────

const reps = (goal: string) => goal === "strength" ? "3–5" : goal === "endurance" ? "15–20" : "8–12";
const sets = (goal: string) => goal === "strength" ? 5 : 3;

function buildFullBodyWorkout(goal: string): Exercise[] {
  return [
    { name: "Barbell Squat",        sets: sets(goal), reps: reps(goal) },
    { name: "Bench Press",          sets: sets(goal), reps: reps(goal) },
    { name: "Barbell Row",          sets: sets(goal), reps: reps(goal) },
    { name: "Overhead Press",       sets: 3,          reps: reps(goal) },
    { name: "Romanian Deadlift",    sets: 3,          reps: "10–12"    },
    { name: "Cable Curl",           sets: 2,          reps: "12–15"    },
  ];
}

function buildUpperWorkout(goal: string): Exercise[] {
  return [
    { name: "Bench Press",          sets: sets(goal), reps: reps(goal) },
    { name: "Incline Dumbbell Press", sets: 3,        reps: "10–12"    },
    { name: "Cable Row",            sets: sets(goal), reps: reps(goal) },
    { name: "Lat Pulldown",         sets: 3,          reps: "10–12"    },
    { name: "Overhead Press",       sets: 3,          reps: reps(goal) },
    { name: "Tricep Pushdown",      sets: 3,          reps: "12–15"    },
    { name: "Dumbbell Curl",        sets: 3,          reps: "12–15"    },
  ];
}

function buildLowerWorkout(goal: string): Exercise[] {
  return [
    { name: "Barbell Squat",        sets: sets(goal), reps: reps(goal) },
    { name: "Romanian Deadlift",    sets: 4,          reps: "8–10"     },
    { name: "Leg Press",            sets: 3,          reps: "12–15"    },
    { name: "Leg Curl",             sets: 3,          reps: "12–15"    },
    { name: "Leg Extension",        sets: 3,          reps: "15–20"    },
    { name: "Standing Calf Raise",  sets: 4,          reps: "15–20"    },
  ];
}

function buildPushWorkout(goal: string): Exercise[] {
  return [
    { name: "Bench Press",          sets: sets(goal), reps: reps(goal) },
    { name: "Overhead Press",       sets: 4,          reps: reps(goal) },
    { name: "Incline DB Press",     sets: 3,          reps: "10–12"    },
    { name: "Lateral Raise",        sets: 4,          reps: "15–20"    },
    { name: "Tricep Pushdown",      sets: 3,          reps: "12–15"    },
    { name: "Skull Crushers",       sets: 3,          reps: "10–12"    },
  ];
}

function buildPullWorkout(goal: string): Exercise[] {
  return [
    { name: "Deadlift",             sets: sets(goal), reps: goal === "strength" ? "3–5" : "5–6" },
    { name: "Pull-ups",             sets: 4,          reps: "6–10"     },
    { name: "Cable Row",            sets: 3,          reps: "10–12"    },
    { name: "Face Pulls",           sets: 3,          reps: "15–20"    },
    { name: "Barbell Curl",         sets: 3,          reps: "10–12"    },
    { name: "Hammer Curl",          sets: 3,          reps: "12–15"    },
  ];
}

function buildLegWorkout(goal: string): Exercise[] {
  return buildLowerWorkout(goal);
}

function buildBodyPartWorkout(part: string, goal: string): Exercise[] {
  const maps: Record<string, Exercise[]> = {
    Chest: [
      { name: "Bench Press",          sets: 4, reps: reps(goal) },
      { name: "Incline DB Press",     sets: 3, reps: "10–12"    },
      { name: "Cable Fly",            sets: 3, reps: "12–15"    },
      { name: "Dips",                 sets: 3, reps: "10–15"    },
    ],
    Back: [
      { name: "Deadlift",             sets: 4, reps: reps(goal) },
      { name: "Pull-ups",             sets: 4, reps: "6–10"     },
      { name: "Cable Row",            sets: 3, reps: "10–12"    },
      { name: "Lat Pulldown",         sets: 3, reps: "10–12"    },
    ],
    Shoulders: [
      { name: "Overhead Press",       sets: 4, reps: reps(goal) },
      { name: "Lateral Raise",        sets: 4, reps: "15–20"    },
      { name: "Front Raise",          sets: 3, reps: "12–15"    },
      { name: "Face Pulls",           sets: 3, reps: "15–20"    },
    ],
    Arms: [
      { name: "Barbell Curl",         sets: 4, reps: "10–12"    },
      { name: "Hammer Curl",          sets: 3, reps: "12–15"    },
      { name: "Tricep Pushdown",      sets: 4, reps: "12–15"    },
      { name: "Skull Crushers",       sets: 3, reps: "10–12"    },
    ],
    Legs: buildLowerWorkout(goal),
  };
  return maps[part] ?? buildFullBodyWorkout(goal);
}

// ─── Persist program ──────────────────────────────────────────────────────────

function saveGeneratedProgram(userId: string, program: GeneratedProgram): void {
  try {
    const key = `flowstate-generated-program-${userId}`;
    localStorage.setItem(key, JSON.stringify(program));
  } catch { /* ignore */ }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const STEPS = [
  "Analyzing your goals and intake…",
  "Building your training split…",
  "Selecting exercises for your focus areas…",
  "Scheduling your weekly sessions…",
  "Finalizing program details…",
  "Program ready.",
];

export default function ProgramGenerationPage() {
  const router = useRouter();

  const [stepIdx,   setStepIdx]   = useState(0);
  const [done,      setDone]      = useState(false);
  const [program,   setProgram]   = useState<GeneratedProgram | null>(null);

  useEffect(() => {
    const key = getSessionKey();
    if (!key || key === "master") { router.replace("/welcome"); return; }
    const uid      = ROLE_TO_USER_ID[key] ?? key;
    const state    = loadOnboardingState(uid);
    const planning = state.planningData;

    if (!planning) {
      // No planning data — skip to tutorial
      completeProgramGeneration(uid, "default");
      router.replace("/onboarding/tutorial");
      return;
    }

    initStore();

    // Animate through steps
    const intervals: NodeJS.Timeout[] = [];
    STEPS.forEach((_, i) => {
      intervals.push(
        setTimeout(() => {
          setStepIdx(i);
          if (i === STEPS.length - 1) {
            // Generate and save program
            const gen = generateProgram(planning);
            saveGeneratedProgram(uid, gen);
            completeProgramGeneration(uid, gen.id);
            setProgram(gen);
            setDone(true);
          }
        }, i * 700)
      );
    });

    return () => intervals.forEach(clearTimeout);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[#B48B40]/[0.04] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm space-y-10">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
          <span className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate AI</span>
        </div>

        {!done ? (
          <div className="space-y-8">
            {/* Pulsing orb */}
            <div className="flex justify-center">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border border-[#B48B40]/20 animate-ping" />
                <div className="relative w-20 h-20 rounded-full bg-[#B48B40]/8 border border-[#B48B40]/25 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-[#B48B40]" strokeWidth={1.5} />
                </div>
              </div>
            </div>

            {/* Step progress */}
            <div className="space-y-3">
              {STEPS.slice(0, -1).map((s, i) => (
                <div key={i} className={cn(
                  "flex items-center gap-3 transition-all duration-300",
                  i <= stepIdx ? "opacity-100" : "opacity-0"
                )}>
                  <div className={cn(
                    "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all",
                    i < stepIdx
                      ? "border-[#B48B40]/40 bg-[#B48B40]/15"
                      : i === stepIdx
                      ? "border-[#B48B40]/60 bg-[#B48B40]/20 animate-pulse"
                      : "border-white/10"
                  )}>
                    {i < stepIdx && <Check className="w-2 h-2 text-[#B48B40]" strokeWidth={3} />}
                  </div>
                  <p className={cn(
                    "text-sm transition-colors",
                    i === stepIdx ? "text-white/70" : i < stepIdx ? "text-white/35" : "text-white/15"
                  )}>
                    {s}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Success */}
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-[#B48B40]/15 border border-[#B48B40]/30 flex items-center justify-center">
                <Check className="w-8 h-8 text-[#B48B40]" strokeWidth={2} />
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-xl font-semibold text-white/85">Your program is ready</h2>
                <p className="text-sm text-white/40">{program?.name}</p>
              </div>
            </div>

            {/* Program summary */}
            {program && (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] divide-y divide-white/[0.05]">
                {[
                  { label: "Duration",    value: `${program.weeks} weeks`          },
                  { label: "Frequency",   value: `${program.daysPerWeek} days/week` },
                  { label: "Split",       value: program.split                      },
                  { label: "First workout", value: program.week1[0]?.focus ?? "—"  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-5 py-3">
                    <span className="text-xs text-white/35 uppercase tracking-[0.1em]">{label}</span>
                    <span className="text-sm font-semibold text-white/75">{value}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => router.push("/onboarding/tutorial")}
              className="w-full rounded-2xl bg-[#B48B40] text-black py-4 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#c99840] active:scale-[0.98] transition-all"
            >
              Continue <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
