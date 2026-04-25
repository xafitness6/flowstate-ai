"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Edit3,
  Bookmark,
  Users,
  X,
  Check,
  Lock,
  ChevronRight,
  Zap,
  ArrowLeft,
  Plus,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { hasAccess } from "@/lib/roles";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenerateMode  = "quick" | "prompt";
type GenerateScope = "workout" | "week" | "program" | "phase";

type GenExercise = {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  note?: string;
};

type GenSection = {
  label: string;
  exercises: GenExercise[];
};

type GenWorkout = {
  id: string;
  name: string;
  goal: string;
  duration: string;
  difficulty: string;
  split: string;
  rationale: string;
  sections: GenSection[];
};

type GenProgram = {
  id: string;
  name: string;
  goal: string;
  weeks: number;
  daysPerWeek: number;
  rationale: string;
  workouts: (GenWorkout & { day: string })[];
};

type GenerateOutput =
  | { type: "workout"; data: GenWorkout   }
  | { type: "program"; data: GenProgram   };

type SavedTemplate = {
  id:        string;
  name:      string;
  category:  string;
  savedAt:   string;
  output:    GenerateOutput;
};

type CreativeTune = {
  id:    string;
  label: string;
  desc:  string;
};

// ─── Quick inputs ─────────────────────────────────────────────────────────────

const GOAL_OPTIONS = [
  { id: "hypertrophy", label: "Hypertrophy", sub: "Moderate reps, volume"   },
  { id: "strength",    label: "Strength",    sub: "Heavy compound, low reps" },
  { id: "fat_loss",    label: "Fat Loss",    sub: "High density, circuits"  },
  { id: "performance", label: "Performance", sub: "Athletic, power-focused" },
];

const DURATION_OPTIONS = ["20", "30", "45", "60", "75", "90"];

const EQUIPMENT_OPTIONS = [
  "Full gym", "Barbell", "Dumbbells", "Cables", "Machines",
  "Bodyweight", "Resistance bands", "Kettlebells",
];

const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced", "Elite"];

const SPLIT_OPTIONS = [
  "Full body", "Upper body", "Lower body",
  "Push", "Pull", "Legs",
  "Push / Pull", "Upper / Lower",
];

const SCOPE_OPTIONS: { id: GenerateScope; label: string; sub: string }[] = [
  { id: "workout", label: "One workout",    sub: "Single session"           },
  { id: "week",    label: "One week",       sub: "Full training week"       },
  { id: "program", label: "Full program",   sub: "Multi-week structure"     },
  { id: "phase",   label: "Full phase",     sub: "Periodised block (4–8w)"  },
];

const TRAINING_AGE_OPTIONS = [
  "< 1 year", "1–2 years", "2–4 years", "4–6 years", "6+ years",
];

// ─── Creative tunes ───────────────────────────────────────────────────────────

const CREATIVE_TUNES: CreativeTune[] = [
  { id: "athletic",     label: "More athletic",           desc: "Explosive, compound-dominant"  },
  { id: "hypertrophy",  label: "More hypertrophy",        desc: "Volume, moderate rep ranges"   },
  { id: "conditioning", label: "More conditioning",       desc: "Circuits, density, cardio mix" },
  { id: "creative",     label: "More creative",           desc: "Unusual combos, fresh patterns" },
  { id: "minimal",      label: "Minimal equipment",       desc: "Bodyweight/band priority"      },
  { id: "recovery",     label: "Easier recovery",         desc: "Lower volume, longer rest"     },
  { id: "aggressive",   label: "More aggressive",         desc: "High intensity, drop sets"     },
  { id: "joints",       label: "Lower joint stress",      desc: "No heavy axial loading"        },
];

// ─── Mock workout library ─────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

const PRESETS: Record<string, GenWorkout> = {

  "hypertrophy_pull": {
    id: "", name: "Upper Body · Pull", goal: "Hypertrophy", duration: "50 min",
    difficulty: "Intermediate", split: "Pull",
    rationale: "Vertical and horizontal pull pattern loaded in a 4×10 strength-hypertrophy rep range. Rear delt and bicep accessories are programmed last to avoid pre-fatigue on the compound movements. Rest periods are kept at 90s to maintain training density without compromising load.",
    sections: [
      { label: "Warm-up", exercises: [
        { name: "Band pull-apart",    sets: "3", reps: "15",    rest: "—",   note: "Focus on scapular retraction" },
        { name: "Face pull",          sets: "3", reps: "15",    rest: "45s"  },
      ]},
      { label: "Main lifts", exercises: [
        { name: "Lat pulldown",       sets: "4", reps: "8–10",  rest: "90s", note: "Full stretch at top, controlled eccentric" },
        { name: "Seated cable row",   sets: "4", reps: "10",    rest: "90s", note: "Row to lower chest, big chest through the pull" },
      ]},
      { label: "Accessories", exercises: [
        { name: "Single-arm DB row",  sets: "3", reps: "12 /side", rest: "60s" },
        { name: "Rear delt fly",      sets: "3", reps: "15",    rest: "60s", note: "Controlled, no momentum" },
        { name: "Hammer curl",        sets: "3", reps: "12",    rest: "60s" },
      ]},
    ],
  },

  "hypertrophy_push": {
    id: "", name: "Upper Body · Push", goal: "Hypertrophy", duration: "50 min",
    difficulty: "Intermediate", split: "Push",
    rationale: "Pressing pattern prioritised through incline and flat angles. Lateral deltoid isolation added to widen shoulder appearance — a common weak point in hypertrophy-focused programs. Tricep volume is moderate to preserve recovery for the next session.",
    sections: [
      { label: "Warm-up", exercises: [
        { name: "Shoulder circles + arm swings", sets: "2", reps: "30s",   rest: "—"   },
        { name: "Push-up",                       sets: "2", reps: "12",    rest: "30s" },
      ]},
      { label: "Main lifts", exercises: [
        { name: "Incline barbell press", sets: "4", reps: "8–10",  rest: "90s", note: "Upper chest emphasis, 45° bench" },
        { name: "Flat dumbbell press",   sets: "3", reps: "10–12", rest: "90s" },
      ]},
      { label: "Accessories", exercises: [
        { name: "Lateral raise",         sets: "4", reps: "15",    rest: "60s", note: "Cable or DB — avoid swinging" },
        { name: "Cable fly (low-to-high)", sets: "3", reps: "15",  rest: "60s" },
        { name: "Overhead tricep extension", sets: "3", reps: "12", rest: "60s" },
      ]},
    ],
  },

  "strength_upper": {
    id: "", name: "Strength Upper A", goal: "Strength", duration: "60 min",
    difficulty: "Advanced", split: "Upper body",
    rationale: "Paused bench and barbell row as primary compound movements. Both loaded in the 3–5 rep strength range with full rest periods. Supplemental work uses moderate reps to build supporting musculature without accumulating excessive fatigue.",
    sections: [
      { label: "Activation", exercises: [
        { name: "Band pull-apart",     sets: "3", reps: "15",    rest: "—"    },
        { name: "Empty bar warm-up",   sets: "2", reps: "10",    rest: "—",   note: "2 warm-up sets before working sets" },
      ]},
      { label: "Primary compound", exercises: [
        { name: "Paused bench press",  sets: "5", reps: "3",     rest: "3min", note: "2-sec pause at chest, drive explosively" },
        { name: "Barbell row",         sets: "4", reps: "5",     rest: "2min", note: "Overhand, pull to lower chest" },
      ]},
      { label: "Supplemental", exercises: [
        { name: "Incline DB press",    sets: "3", reps: "6–8",   rest: "90s"  },
        { name: "Weighted pull-up",    sets: "3", reps: "5",     rest: "90s"  },
        { name: "Face pull",           sets: "3", reps: "15",    rest: "60s", note: "Shoulder health — don't skip" },
      ]},
    ],
  },

  "fat_loss_fullbody": {
    id: "", name: "Full Body Circuit A", goal: "Fat Loss", duration: "40 min",
    difficulty: "Intermediate", split: "Full body",
    rationale: "Three-block circuit structure designed for metabolic output and caloric expenditure. Compound movements are paired to keep heart rate elevated between sets. Rest is kept short to maintain density — the goal is work capacity, not max load.",
    sections: [
      { label: "Block A — 3 rounds, 45s rest between", exercises: [
        { name: "Goblet squat",        sets: "3", reps: "15",    rest: "—"    },
        { name: "Push-up",             sets: "3", reps: "15",    rest: "—"    },
        { name: "DB Romanian DL",      sets: "3", reps: "15",    rest: "45s"  },
      ]},
      { label: "Block B — 3 rounds, 45s rest between", exercises: [
        { name: "Reverse lunge",       sets: "3", reps: "12/side", rest: "—"  },
        { name: "DB row",              sets: "3", reps: "12/side", rest: "—"  },
        { name: "Plank hold",          sets: "3", reps: "40s",    rest: "45s"  },
      ]},
      { label: "Finisher", exercises: [
        { name: "KB swings",           sets: "1", reps: "AMRAP 3min", rest: "—", note: "Push for max quality reps in 3 minutes" },
      ]},
    ],
  },

  "performance_fullbody": {
    id: "", name: "Athletic Power Session", goal: "Performance", duration: "55 min",
    difficulty: "Advanced", split: "Full body",
    rationale: "Power-first sequencing — explosive work is performed while the CNS is fresh. Contrast loading pairs a heavy strength lift with a plyometric to potentiate power output. Conditioning finisher builds aerobic base without sacrificing movement quality.",
    sections: [
      { label: "CNS Activation", exercises: [
        { name: "Box jump",            sets: "4", reps: "5",     rest: "90s", note: "Max height, full reset each rep" },
        { name: "Med ball slam",       sets: "3", reps: "8",     rest: "60s"  },
      ]},
      { label: "Contrast block", exercises: [
        { name: "Trap bar deadlift",   sets: "4", reps: "4",     rest: "90s", note: "Heavy — drive floor away" },
        { name: "Broad jump",          sets: "4", reps: "4",     rest: "2min", note: "Immediately after DL" },
        { name: "DB bench press",      sets: "3", reps: "6",     rest: "90s"  },
        { name: "Clap push-up",        sets: "3", reps: "6",     rest: "90s", note: "Plyometric contrast"    },
      ]},
      { label: "Conditioning", exercises: [
        { name: "Assault bike sprint", sets: "6", reps: "20s on / 40s off", rest: "—" },
      ]},
    ],
  },

  // ── Creative tune variants ──

  "tune_athletic": {
    id: "", name: "Athletic Upper Body", goal: "Performance", duration: "50 min",
    difficulty: "Advanced", split: "Upper body",
    rationale: "Retuned for athletic output. Push movements are explosive first, then supplemented with pulling for postural balance. The plyometric push-up and rotational row pattern add athleticism often missing from standard hypertrophy work.",
    sections: [
      { label: "Power primer", exercises: [
        { name: "Clap push-up",            sets: "4", reps: "5",     rest: "90s", note: "Explosive — quality over quantity" },
        { name: "Med ball rotational throw", sets: "3", reps: "6/side", rest: "60s" },
      ]},
      { label: "Compound strength", exercises: [
        { name: "Push press",             sets: "4", reps: "5",     rest: "2min"  },
        { name: "Pendlay row",            sets: "4", reps: "5",     rest: "2min"  },
      ]},
      { label: "Supplemental", exercises: [
        { name: "1-arm landmine press",   sets: "3", reps: "8/side", rest: "75s"  },
        { name: "Chest-supported row",    sets: "3", reps: "10",    rest: "75s"   },
        { name: "External rotation",      sets: "3", reps: "15",    rest: "45s", note: "Rotator cuff health" },
      ]},
    ],
  },

  "tune_minimal": {
    id: "", name: "Bodyweight & Bands Pull", goal: "Hypertrophy", duration: "40 min",
    difficulty: "Intermediate", split: "Pull",
    rationale: "Fully re-engineered for minimal equipment. Band-assisted pull-ups and unilateral rows provide sufficient tension for hypertrophy. Density sets replace load-based progression — this version is ideal for travel or equipment-limited environments.",
    sections: [
      { label: "Warm-up", exercises: [
        { name: "Band pull-apart",        sets: "3", reps: "20",    rest: "—"    },
        { name: "Dead hang",              sets: "3", reps: "30s",   rest: "30s"  },
      ]},
      { label: "Main", exercises: [
        { name: "Band-assisted pull-up",  sets: "4", reps: "8–10",  rest: "90s", note: "Use minimum band assistance needed" },
        { name: "Inverted row",           sets: "4", reps: "12",    rest: "75s", note: "Elevate feet to increase difficulty" },
      ]},
      { label: "Accessories", exercises: [
        { name: "Band face pull",         sets: "3", reps: "20",    rest: "60s"  },
        { name: "Band bicep curl",        sets: "3", reps: "15",    rest: "45s", note: "Peak contraction hold at top" },
        { name: "Superman hold",          sets: "3", reps: "10×3s", rest: "45s"  },
      ]},
    ],
  },

  "tune_recovery": {
    id: "", name: "Low Intensity Pull (Recovery)", goal: "Hypertrophy", duration: "35 min",
    difficulty: "Beginner", split: "Pull",
    rationale: "Reduced volume and extended rest for a deload or recovery week. All movements use machine or cable variations to limit joint stress. Total sets are cut by ~40% — this is designed to maintain motor patterns without accumulating fatigue.",
    sections: [
      { label: "Activation", exercises: [
        { name: "Band pull-apart",        sets: "2", reps: "15",    rest: "—"    },
      ]},
      { label: "Main", exercises: [
        { name: "Machine lat pulldown",   sets: "3", reps: "12",    rest: "2min", note: "60–65% of usual load" },
        { name: "Cable seated row",       sets: "3", reps: "12",    rest: "2min"  },
      ]},
      { label: "Light accessories", exercises: [
        { name: "Cable face pull",        sets: "2", reps: "15",    rest: "90s"  },
        { name: "DB hammer curl",         sets: "2", reps: "12",    rest: "90s"  },
      ]},
    ],
  },

  "tune_aggressive": {
    id: "", name: "High-Intensity Pull", goal: "Hypertrophy", duration: "55 min",
    difficulty: "Elite", split: "Pull",
    rationale: "Maximum mechanical tension through rest-pause and drop-set protocols. Only appropriate for advanced trainees with high work capacity. The first three sets establish a strength-hypertrophy base; intensity techniques are reserved for the final set of each exercise.",
    sections: [
      { label: "Warm-up", exercises: [
        { name: "Band pull-apart",        sets: "3", reps: "20",    rest: "—"    },
        { name: "Cable pull-through",     sets: "2", reps: "15",    rest: "30s"  },
      ]},
      { label: "Main lifts", exercises: [
        { name: "Weighted pull-up",       sets: "5", reps: "6",     rest: "2min", note: "Final set: rest-pause to failure" },
        { name: "Barbell row",            sets: "4", reps: "8",     rest: "90s",  note: "Final set: drop set ×2" },
      ]},
      { label: "Intensity block", exercises: [
        { name: "Cable row (wide grip)",  sets: "3", reps: "12",    rest: "60s"  },
        { name: "Incline DB curl",        sets: "3", reps: "10",    rest: "60s",  note: "Strict, no swing" },
        { name: "Straight-arm pulldown",  sets: "3", reps: "15",    rest: "45s", note: "Mind-muscle, lat connection" },
      ]},
    ],
  },

};

const WEEK_STRUCTURE: (GenWorkout & { day: string })[] = [
  { ...PRESETS["hypertrophy_push"], id: uid(), day: "Monday"    },
  { ...PRESETS["hypertrophy_pull"], id: uid(), day: "Tuesday"   },
  { id: uid(), name: "Lower Body · Squat", goal: "Hypertrophy", duration: "55 min",
    difficulty: "Intermediate", split: "Legs", day: "Thursday",
    rationale: "Quad-dominant pattern built around the back squat. Romanian DL added for hamstring balance.",
    sections: [
      { label: "Warm-up", exercises: [
        { name: "Leg swing",         sets: "2", reps: "10/side", rest: "—"    },
        { name: "Goblet squat",      sets: "3", reps: "10",      rest: "60s"  },
      ]},
      { label: "Main", exercises: [
        { name: "Back squat",        sets: "4", reps: "8",   rest: "2min", note: "Depth to parallel" },
        { name: "Romanian DL",       sets: "3", reps: "10",  rest: "90s"  },
      ]},
      { label: "Accessories", exercises: [
        { name: "Leg press",         sets: "3", reps: "12",  rest: "90s"  },
        { name: "Leg curl",          sets: "3", reps: "12",  rest: "75s"  },
        { name: "Calf raise",        sets: "4", reps: "15",  rest: "60s"  },
      ]},
    ],
  },
  { id: uid(), name: "Upper Body · Strength", goal: "Hypertrophy", duration: "50 min",
    difficulty: "Intermediate", split: "Upper body", day: "Saturday",
    rationale: "Moderate volume upper day to close the week. Rep ranges run slightly higher than earlier sessions as fatigue accumulates — quality over load.",
    sections: [
      { label: "Main", exercises: [
        { name: "Dumbbell bench press", sets: "4", reps: "10–12", rest: "90s" },
        { name: "Cable row",           sets: "4", reps: "12",    rest: "90s" },
        { name: "Lateral raise",       sets: "3", reps: "15",    rest: "60s" },
        { name: "Rear delt fly",       sets: "3", reps: "15",    rest: "60s" },
        { name: "Bicep curl",          sets: "2", reps: "15",    rest: "60s" },
      ]},
    ],
  },
];

const PROGRAM_OUTPUT: GenProgram = {
  id: uid(),
  name: "4-Day Hypertrophy Block · Phase 1",
  goal: "Hypertrophy",
  weeks: 8,
  daysPerWeek: 4,
  rationale: "Push/Pull/Legs structure over 4 days using an Upper/Lower split. Progressive overload is built in through weekly load increases of 2.5–5kg. Weeks 1–4 establish volume tolerance; weeks 5–8 increase intensity and introduce intensification techniques. Deload in week 4.",
  workouts: WEEK_STRUCTURE,
};

// ─── Generation logic ─────────────────────────────────────────────────────────

// Ordered rotation pool — used to cycle through distinct workouts on each Regenerate
const WORKOUT_ROTATION: (keyof typeof PRESETS)[] = [
  "hypertrophy_pull",
  "hypertrophy_push",
  "strength_upper",
  "fat_loss_fullbody",
  "performance_fullbody",
  "tune_athletic",
  "tune_minimal",
  "tune_recovery",
  "tune_aggressive",
];

function pickWorkout(
  goal: string,
  split: string,
  equipment: string[],
  tune: string | null,
  variationIndex: number = 0,
): GenWorkout {
  // Tune overrides — rotate through all presets when regenerating with a tune active
  if (tune) {
    const tuneKeys: (keyof typeof PRESETS)[] = [
      "tune_athletic", "tune_minimal", "tune_recovery", "tune_aggressive",
    ];
    const idx = variationIndex % tuneKeys.length;
    return { ...PRESETS[tuneKeys[idx]], id: uid() };
  }

  // On regeneration (variationIndex > 0), cycle through the full rotation pool
  if (variationIndex > 0) {
    const idx = variationIndex % WORKOUT_ROTATION.length;
    return { ...PRESETS[WORKOUT_ROTATION[idx]], id: uid() };
  }

  // Initial generation: respect goal + split selection
  const g = goal.toLowerCase();
  const s = split.toLowerCase();

  if (g.includes("strength"))    return { ...PRESETS["strength_upper"],       id: uid() };
  if (g.includes("fat"))         return { ...PRESETS["fat_loss_fullbody"],     id: uid() };
  if (g.includes("performance")) return { ...PRESETS["performance_fullbody"],  id: uid() };

  // Hypertrophy variants
  if (s.includes("push")) return { ...PRESETS["hypertrophy_push"], id: uid() };
  if (s.includes("pull")) return { ...PRESETS["hypertrophy_pull"], id: uid() };

  return { ...PRESETS["hypertrophy_pull"], id: uid() };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionView({ section, defaultOpen = true }: { section: GenSection; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full mb-2 px-1 group"
      >
        <Layers className="w-3 h-3 text-[#B48B40]/50 shrink-0" strokeWidth={1.5} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38 flex-1 text-left">
          {section.label}
        </span>
        {open
          ? <ChevronUp className="w-3 h-3 text-white/18 group-hover:text-white/40" strokeWidth={1.5} />
          : <ChevronDown className="w-3 h-3 text-white/18 group-hover:text-white/40" strokeWidth={1.5} />
        }
      </button>
      {open && (
        <div className="space-y-2 mb-4">
          {section.exercises.map((ex, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/7 bg-white/[0.025] px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <span className="text-[10px] text-white/20 mt-0.5 tabular-nums w-4 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/85 mb-2">{ex.name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { label: "Sets",   val: ex.sets },
                      { label: "Reps",   val: ex.reps },
                      { label: "Rest",   val: ex.rest },
                    ].map(({ label, val }) => (
                      <div
                        key={label}
                        className="rounded-lg border border-white/6 bg-white/[0.02] px-2.5 py-1 flex items-center gap-1.5"
                      >
                        <span className="text-[9px] uppercase tracking-[0.1em] text-white/22">{label}</span>
                        <span className="text-xs font-medium text-white/65 tabular-nums">{val}</span>
                      </div>
                    ))}
                  </div>
                  {ex.note && (
                    <p className="text-[11px] text-[#B48B40]/55 mt-1.5 leading-relaxed">
                      ◈ {ex.note}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkoutCard({
  workout,
  dayLabel,
  defaultExpanded = true,
}: {
  workout: GenWorkout;
  dayLabel?: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-2xl border border-white/8 bg-[#111111] overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.015] transition-colors"
      >
        {dayLabel && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B48B40]/60 w-16 shrink-0">
            {dayLabel}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/85">{workout.name}</p>
          <p className="text-[11px] text-white/30 mt-0.5">
            {workout.goal} · {workout.duration} · {workout.difficulty} · {workout.split}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-white/22 tabular-nums">
            {workout.sections.reduce((s, sec) => s + sec.exercises.length, 0)} exercises
          </span>
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-white/20" strokeWidth={1.5} />
            : <ChevronDown className="w-3.5 h-3.5 text-white/20" strokeWidth={1.5} />
          }
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-white/[0.05] pt-4">
          {/* AI rationale */}
          <div className="rounded-xl border border-[#B48B40]/14 bg-[#B48B40]/[0.03] px-4 py-3 mb-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-3 h-3 text-[#B48B40]/50" strokeWidth={1.5} />
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#B48B40]/50">AI rationale</p>
            </div>
            <p className="text-xs text-white/45 leading-relaxed">{workout.rationale}</p>
          </div>

          {workout.sections.map((s, i) => (
            <SectionView key={i} section={s} defaultOpen={i < 2} />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateModal({
  onSave,
  onClose,
}: {
  onSave: (name: string, category: string) => void;
  onClose: () => void;
}) {
  const [name,     setName]     = useState("");
  const [category, setCategory] = useState("General");

  const CATEGORIES = ["General", "Strength", "Hypertrophy", "Fat Loss", "Performance", "Rehab", "Beginner"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0F0F0F] shadow-2xl overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.06] flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bookmark className="w-4 h-4 text-[#B48B40]/70" strokeWidth={1.5} />
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/30">Save template</span>
            </div>
            <p className="text-base font-semibold text-white/90">Name this template</p>
          </div>
          <button onClick={onClose} className="text-white/25 hover:text-white/55 transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-[0.16em] text-white/22 block mb-2">Template name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hypertrophy Pull A"
              className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white/80 placeholder:text-white/22 outline-none focus:border-[#B48B40]/35 transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.16em] text-white/22 block mb-2">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all",
                    category === c
                      ? "border-[#B48B40]/35 bg-[#B48B40]/8 text-[#B48B40]"
                      : "border-white/6 text-white/40 hover:text-white/60 hover:border-white/12"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/8 py-2.5 text-sm text-white/40 hover:text-white/65 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (name.trim()) { onSave(name.trim(), category); onClose(); } }}
            disabled={!name.trim()}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all",
              name.trim()
                ? "bg-[#B48B40] text-black hover:bg-[#c99840]"
                : "bg-white/5 text-white/25 cursor-not-allowed"
            )}
          >
            Save template
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GeneratePage() {
  const router   = useRouter();
  const { user } = useUser();

  const canUse = hasAccess(user.role, "trainer");

  // ── Mode + scope ──
  const [mode,  setMode ] = useState<GenerateMode>("quick");
  const [scope, setScope] = useState<GenerateScope>("workout");

  // ── Quick inputs ──
  const [goal,       setGoal      ] = useState("hypertrophy");
  const [duration,   setDuration  ] = useState("45");
  const [equipment,  setEquipment ] = useState<string[]>(["Full gym"]);
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [split,      setSplit     ] = useState("Pull");

  // ── Prompt inputs ──
  const [prompt,       setPrompt      ] = useState("");
  const [trainingAge,  setTrainingAge  ] = useState("2–4 years");
  const [schedule,     setSchedule     ] = useState("");
  const [limitations,  setLimitations  ] = useState("");
  const [promptEquip,  setPromptEquip  ] = useState("Full gym");

  // ── Generation state ──
  const [generating,        setGenerating       ] = useState(false);
  const [output,            setOutput           ] = useState<GenerateOutput | null>(null);
  const [activeTune,        setActiveTune       ] = useState<string | null>(null);
  const [generated,         setGenerated        ] = useState(false);
  const [regenerationCount, setRegenerationCount] = useState(0);

  // ── Templates ──
  const [templates,    setTemplates   ] = useState<SavedTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [savedMsg,     setSavedMsg    ] = useState(false);

  const outputRef = useRef<HTMLDivElement>(null);

  function generate(tune: string | null = null) {
    setGenerating(true);
    setActiveTune(tune);

    const nextRegenCount = output ? regenerationCount + 1 : 0;
    setRegenerationCount(nextRegenCount);

    const delay = tune ? 700 : 1100;

    setTimeout(() => {
      let result: GenerateOutput;

      if (scope === "workout" || mode === "quick") {
        result = {
          type: "workout",
          data: pickWorkout(goal, split, equipment, tune, nextRegenCount),
        };
      } else {
        result = { type: "program", data: { ...PROGRAM_OUTPUT, id: uid() } };
      }

      setOutput(result);
      setGenerating(false);
      setGenerated(true);

      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }, delay);
  }

  function applyTune(tuneId: string) {
    if (activeTune === tuneId) {
      // Deselect — revert to base
      generate(null);
    } else {
      generate(tuneId);
    }
  }

  function saveTemplate(name: string, category: string) {
    if (!output) return;
    const t: SavedTemplate = {
      id:       uid(),
      name,
      category,
      savedAt:  new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      output,
    };
    setTemplates((prev) => [t, ...prev]);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  }

  function toggleEquipment(item: string) {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    );
  }

  // ── Access gate ──
  if (!canUse) {
    return (
      <div className="px-5 md:px-8 py-6 text-white">
        <button
          onClick={() => router.push("/program")}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Program
        </button>
        <div className="rounded-2xl border border-white/6 bg-[#111111] px-6 py-12 text-center space-y-3">
          <Lock className="w-6 h-6 text-white/20 mx-auto" strokeWidth={1.5} />
          <p className="text-sm font-medium text-white/50">AI Program Generator is available to trainers and admins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 md:px-8 py-6 text-white space-y-6 max-w-6xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <button
          onClick={() => router.push("/program")}
          className="flex items-center gap-2 text-sm text-white/35 hover:text-white/65 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Program
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/22 mb-1.5">Program · AI Generator</p>
            <h1 className="text-2xl font-semibold tracking-tight">Program Generator</h1>
            <p className="text-sm text-white/30 mt-1">Build workouts and programs from inputs or a custom prompt.</p>
          </div>

          {/* Mode tabs */}
          <div className="flex items-center gap-0.5 rounded-xl border border-white/8 bg-white/[0.02] p-1 shrink-0">
            {(["quick", "prompt"] as GenerateMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-xs font-medium tracking-wide capitalize transition-all",
                  mode === m
                    ? "bg-white/8 text-white/80"
                    : "text-white/30 hover:text-white/55"
                )}
              >
                {m === "quick" ? "Quick generate" : "Prompt builder"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">

        {/* ── LEFT: Inputs ────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* ── QUICK MODE ── */}
          {mode === "quick" && (
            <div className="rounded-2xl border border-white/8 bg-[#111111] px-6 py-5 space-y-6">

              {/* Goal */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/25 block mb-3">Goal</label>
                <div className="grid grid-cols-2 gap-2">
                  {GOAL_OPTIONS.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setGoal(g.id)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left transition-all",
                        goal === g.id
                          ? "border-[#B48B40]/40 bg-[#B48B40]/8"
                          : "border-white/6 hover:border-white/12 hover:bg-white/[0.02]"
                      )}
                    >
                      <p className={cn("text-xs font-semibold", goal === g.id ? "text-[#B48B40]" : "text-white/70")}>
                        {g.label}
                      </p>
                      <p className="text-[10px] text-white/25 mt-0.5">{g.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/25 block mb-2">Duration</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DURATION_OPTIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                        duration === d
                          ? "border-[#B48B40]/40 bg-[#B48B40]/8 text-[#B48B40]"
                          : "border-white/6 text-white/40 hover:text-white/65 hover:border-white/12"
                      )}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/25 block mb-2">Difficulty</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                        difficulty === d
                          ? "border-[#B48B40]/40 bg-[#B48B40]/8 text-[#B48B40]"
                          : "border-white/6 text-white/40 hover:text-white/65 hover:border-white/12"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/25 block mb-2">Split / Focus</label>
                <div className="flex gap-1.5 flex-wrap">
                  {SPLIT_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSplit(s)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                        split === s
                          ? "border-[#B48B40]/40 bg-[#B48B40]/8 text-[#B48B40]"
                          : "border-white/6 text-white/40 hover:text-white/65 hover:border-white/12"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equipment */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/25 block mb-2">Equipment</label>
                <div className="flex gap-1.5 flex-wrap">
                  {EQUIPMENT_OPTIONS.map((e) => (
                    <button
                      key={e}
                      onClick={() => toggleEquipment(e)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                        equipment.includes(e)
                          ? "border-emerald-400/30 bg-emerald-400/6 text-emerald-400"
                          : "border-white/6 text-white/40 hover:text-white/65 hover:border-white/12"
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PROMPT MODE ── */}
          {mode === "prompt" && (
            <div className="rounded-2xl border border-white/8 bg-[#111111] px-6 py-5 space-y-5">

              {/* Scope */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/25 block mb-2">Generate</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {SCOPE_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setScope(s.id)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left transition-all",
                        scope === s.id
                          ? "border-[#B48B40]/40 bg-[#B48B40]/8"
                          : "border-white/6 hover:border-white/12"
                      )}
                    >
                      <p className={cn("text-xs font-semibold", scope === s.id ? "text-[#B48B40]" : "text-white/65")}>
                        {s.label}
                      </p>
                      <p className="text-[10px] text-white/25 mt-0.5">{s.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/25 block mb-2">Describe what you need</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Build a 4-day hypertrophy program for an intermediate lifter with a full gym. They train Mon/Tue/Thu/Sat, want to prioritise back and shoulders, and have a left shoulder impingement that limits overhead pressing."
                  rows={5}
                  className="w-full bg-white/[0.025] border border-white/7 rounded-xl px-4 py-3 text-sm text-white/75 placeholder:text-white/20 resize-none outline-none focus:border-[#B48B40]/35 transition-colors leading-relaxed"
                />
              </div>

              {/* Context fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] text-white/22 block mb-1.5">Training age</label>
                  <select
                    value={trainingAge}
                    onChange={(e) => setTrainingAge(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/6 rounded-xl px-3 py-2 text-xs text-white/65 outline-none focus:border-[#B48B40]/35 transition-colors [color-scheme:dark]"
                  >
                    {TRAINING_AGE_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] text-white/22 block mb-1.5">Equipment</label>
                  <select
                    value={promptEquip}
                    onChange={(e) => setPromptEquip(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/6 rounded-xl px-3 py-2 text-xs text-white/65 outline-none focus:border-[#B48B40]/35 transition-colors [color-scheme:dark]"
                  >
                    {EQUIPMENT_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-white/22 block mb-1.5">Schedule / Days available</label>
                <input
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="e.g. Mon, Tue, Thu, Sat"
                  className="w-full bg-white/[0.03] border border-white/6 rounded-xl px-3 py-2 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/35 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-white/22 block mb-1.5">Limitations or injuries (optional)</label>
                <input
                  value={limitations}
                  onChange={(e) => setLimitations(e.target.value)}
                  placeholder="e.g. Left shoulder impingement, avoid overhead pressing"
                  className="w-full bg-white/[0.03] border border-white/6 rounded-xl px-3 py-2 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/35 transition-colors"
                />
              </div>
            </div>
          )}

          {/* ── Generate button ── */}
          <button
            onClick={() => generate(null)}
            disabled={generating || (mode === "prompt" && !prompt.trim())}
            className={cn(
              "w-full rounded-2xl py-4 flex items-center justify-center gap-3 text-sm font-semibold tracking-wide transition-all",
              generating
                ? "bg-white/5 text-white/30 cursor-not-allowed"
                : mode === "prompt" && !prompt.trim()
                ? "bg-white/5 text-white/20 cursor-not-allowed"
                : "bg-[#B48B40] text-black hover:bg-[#c99840] shadow-lg shadow-[#B48B40]/12"
            )}
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                Generate {scope === "workout" || mode === "quick" ? "workout" : scope}
              </>
            )}
          </button>

          {/* ── Saved templates ── */}
          {templates.length > 0 && (
            <div className="rounded-2xl border border-white/6 bg-[#111111] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">Saved templates</p>
                <span className="text-[10px] text-white/28">{templates.length}</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.015] transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-white/75 group-hover:text-white/90 transition-colors">{t.name}</p>
                      <p className="text-[10px] text-white/28 mt-0.5">{t.category} · {t.savedAt}</p>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setOutput(t.output); setGenerated(true); }}
                        className="text-[10px] text-[#B48B40]/60 hover:text-[#B48B40]/90 transition-colors font-medium"
                      >
                        Load
                      </button>
                      <button
                        className="text-[10px] text-white/25 hover:text-white/50 transition-colors"
                        onClick={() => router.push("/program/assign")}
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Output ────────────────────────────────────────────── */}
        <div ref={outputRef} className="space-y-4">

          {/* Empty state */}
          {!generated && !generating && (
            <div className="rounded-2xl border border-dashed border-white/8 bg-[#0D0D0D] px-6 py-16 text-center">
              <Sparkles className="w-8 h-8 text-white/12 mx-auto mb-4" strokeWidth={1} />
              <p className="text-sm font-medium text-white/30">Output will appear here</p>
              <p className="text-xs text-white/18 mt-1.5">
                {mode === "quick"
                  ? "Configure your inputs and click Generate"
                  : "Write a prompt and click Generate"
                }
              </p>
            </div>
          )}

          {/* Generating shimmer */}
          {generating && (
            <div className="rounded-2xl border border-white/6 bg-[#111111] px-6 py-8 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#B48B40]/12 border border-[#B48B40]/20 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-[#B48B40]/70 animate-pulse" strokeWidth={1.5} />
                </div>
                <div className="space-y-1">
                  <div className="h-3 bg-white/6 rounded animate-pulse w-40" />
                  <div className="h-2.5 bg-white/4 rounded animate-pulse w-24" />
                </div>
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 space-y-2">
                  <div className="h-3 bg-white/5 rounded animate-pulse w-32" />
                  <div className="h-2.5 bg-white/[0.03] rounded animate-pulse w-full" />
                  <div className="h-2.5 bg-white/[0.03] rounded animate-pulse w-4/5" />
                </div>
              ))}
            </div>
          )}

          {/* Generated output */}
          {!generating && output && (
            <>
              {/* Output header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <p className="text-xs text-white/40">
                    {output.type === "workout" ? "Workout generated" : "Program generated"}
                    {activeTune && (
                      <span className="ml-2 text-[#B48B40]/60">
                        · tuned for {CREATIVE_TUNES.find((t) => t.id === activeTune)?.label}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => generate(activeTune)}
                  className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/65 border border-white/8 hover:border-white/18 rounded-xl px-3 py-1.5 transition-all"
                >
                  <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                  Regenerate
                </button>
              </div>

              {/* Workout output */}
              {output.type === "workout" && (
                <WorkoutCard workout={output.data} defaultExpanded />
              )}

              {/* Program output */}
              {output.type === "program" && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[#B48B40]/18 bg-[#B48B40]/[0.04] px-5 py-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#B48B40]/55 mb-1">Program overview</p>
                    <p className="text-base font-semibold text-white/88">{output.data.name}</p>
                    <div className="flex items-center gap-4 mt-2">
                      {[
                        { label: "Weeks", value: String(output.data.weeks) },
                        { label: "Days/wk", value: String(output.data.daysPerWeek) },
                        { label: "Goal", value: output.data.goal },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[9px] uppercase tracking-[0.12em] text-white/22">{label}</p>
                          <p className="text-sm font-semibold text-white/70">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/[0.06]">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-3 h-3 text-[#B48B40]/50" strokeWidth={1.5} />
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[#B48B40]/50">AI rationale</p>
                      </div>
                      <p className="text-xs text-white/40 leading-relaxed">{output.data.rationale}</p>
                    </div>
                  </div>

                  {output.data.workouts.map((w) => (
                    <WorkoutCard key={w.id} workout={w} dayLabel={w.day} defaultExpanded={false} />
                  ))}
                </div>
              )}

              {/* ── Creative Controls ─────────────────────────────────── */}
              <div className="rounded-2xl border border-white/6 bg-[#111111] px-5 py-4">
                <div className="flex items-center gap-2 mb-3.5">
                  <Zap className="w-3.5 h-3.5 text-white/30" strokeWidth={1.5} />
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">Tune this output</p>
                  {activeTune && (
                    <button
                      onClick={() => generate(null)}
                      className="ml-auto text-[10px] text-white/28 hover:text-white/50 transition-colors flex items-center gap-1"
                    >
                      <X className="w-2.5 h-2.5" strokeWidth={2} />
                      Reset
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {CREATIVE_TUNES.map((t) => {
                    const active = activeTune === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => applyTune(t.id)}
                        disabled={generating}
                        className={cn(
                          "rounded-xl border px-3.5 py-2 text-left transition-all group",
                          active
                            ? "border-[#B48B40]/40 bg-[#B48B40]/8"
                            : "border-white/6 bg-white/[0.01] hover:border-white/12 hover:bg-white/[0.03]",
                          generating && "opacity-40 pointer-events-none"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {active && <Check className="w-2.5 h-2.5 text-[#B48B40] shrink-0" strokeWidth={2.5} />}
                          <p className={cn(
                            "text-xs font-medium whitespace-nowrap",
                            active ? "text-[#B48B40]" : "text-white/60 group-hover:text-white/80"
                          )}>
                            {t.label}
                          </p>
                        </div>
                        <p className="text-[10px] text-white/22 mt-0.5">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Action bar ───────────────────────────────────────── */}
              <div className="rounded-2xl border border-white/6 bg-[#111111] px-5 py-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3.5">Actions</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => router.push("/program/builder")}
                    className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-2.5 text-xs font-medium text-white/55 hover:bg-white/[0.05] hover:text-white/80 transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Edit in builder
                  </button>
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-2.5 text-xs font-medium text-white/55 hover:bg-white/[0.05] hover:text-white/80 transition-all"
                  >
                    <Bookmark className="w-3.5 h-3.5" strokeWidth={1.5} />
                    {savedMsg ? "Saved ✓" : "Save template"}
                  </button>
                  <button
                    onClick={() => router.push("/program/assign")}
                    className="flex items-center gap-2 rounded-xl bg-[#B48B40] px-5 py-2.5 text-xs font-semibold text-black hover:bg-[#c99840] transition-all"
                  >
                    <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Assign to client
                  </button>
                </div>
                <p className="text-[10px] text-white/18 mt-3">
                  Generated programs are not deployed until assigned. Saving as a template lets you reuse this structure with any client.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Template save modal ──────────────────────────────────────── */}
      {showTemplateModal && (
        <TemplateModal
          onSave={saveTemplate}
          onClose={() => setShowTemplateModal(false)}
        />
      )}
    </div>
  );
}
