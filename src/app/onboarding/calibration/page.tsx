"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  X,
} from "lucide-react";
import { cn } from "../../../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | "intro"
  | "measurements"
  | "photos"
  | "sleep"
  | "food"
  | "limitations"
  | "complete";

type StressLevel = 1 | 2 | 3 | 4 | 5;

type CalibrationData = {
  // Measurements
  weight:     string;
  weightUnit: "kg" | "lbs";
  height:     string;
  heightUnit: "cm" | "ft";
  bodyFat:    string;
  waist:      string;

  // Sleep & stress
  sleepHours:   string;
  sleepQuality: number; // 1–5
  stressLevel:  StressLevel;
  recoveryNote: string;

  // Food
  dietStyle:     string[];
  mealsPerDay:   string;
  restrictions:  string[];
  hydration:     string;

  // Training limitations
  injuries:      string;
  equipment:     string[];
  limitedDays:   string[];
  experienceNote:string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  "intro",
  "measurements",
  "photos",
  "sleep",
  "food",
  "limitations",
  "complete",
];

const STEP_LABELS: Partial<Record<Step, string>> = {
  measurements: "Measurements",
  photos:       "Progress photos",
  sleep:        "Sleep & stress",
  food:         "Food habits",
  limitations:  "Training limits",
};

const DIET_STYLES = [
  "No restrictions",
  "High protein",
  "Low carb",
  "Keto",
  "Vegan",
  "Vegetarian",
  "Intermittent fasting",
  "Flexible / IIFYM",
];

const RESTRICTIONS = [
  "Gluten-free",
  "Dairy-free",
  "Nut allergy",
  "Shellfish allergy",
  "Soy-free",
  "Halal",
  "Kosher",
];

const EQUIPMENT_OPTIONS = [
  "Full gym",
  "Home gym",
  "Dumbbells only",
  "Barbells",
  "Cables / machines",
  "Resistance bands",
  "Bodyweight only",
  "Outdoor / track",
];

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SLEEP_QUALITY_LABELS = ["Very poor", "Poor", "Average", "Good", "Excellent"];
const STRESS_LABELS         = ["Very low", "Low", "Moderate", "High", "Very high"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <p className="text-xs font-medium text-white/55">{children}</p>
      {optional && (
        <span className="text-[10px] text-white/22 tracking-wide">optional</span>
      )}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  suffix?: string;
}) {
  return (
    <div className="relative flex items-center">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 transition-colors"
      />
      {suffix && (
        <span className="absolute right-3 text-xs text-white/25 pointer-events-none">{suffix}</span>
      )}
    </div>
  );
}

function UnitToggle({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center rounded-xl border border-white/8 bg-white/[0.02] p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
            value === opt
              ? "bg-[#B48B40] text-black"
              : "text-white/35 hover:text-white/60"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function ChipGrid({
  options,
  selected,
  onToggle,
  single,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  single?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => {
              if (single) onToggle(opt);
              else onToggle(opt);
            }}
            className={cn(
              "rounded-xl border px-3.5 py-2 text-xs font-medium transition-all",
              active
                ? "border-[#B48B40]/40 bg-[#B48B40]/10 text-[#B48B40]"
                : "border-white/8 bg-white/[0.02] text-white/42 hover:text-white/65 hover:border-white/15"
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function RatingRow({
  value,
  onChange,
  labels,
  color,
}: {
  value: number;
  onChange: (v: number) => void;
  labels: string[];
  color?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              "flex-1 h-9 rounded-xl border text-xs font-semibold transition-all",
              value === n
                ? color === "stress"
                  ? "border-amber-400/40 bg-amber-400/12 text-amber-400"
                  : "border-[#B48B40]/40 bg-[#B48B40]/10 text-[#B48B40]"
                : "border-white/7 bg-white/[0.02] text-white/28 hover:text-white/55 hover:border-white/14"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {value > 0 && (
        <p className="text-xs text-white/30 text-center">{labels[value - 1]}</p>
      )}
    </div>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 transition-colors resize-none leading-relaxed"
    />
  );
}

// ─── Step panels ──────────────────────────────────────────────────────────────

function IntroPanel({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <span className="text-[#B48B40] text-base">◈</span>
        <h1 className="text-3xl font-semibold tracking-tight">
          Let's sharpen your plan.
        </h1>
        <p className="text-white/45 text-base leading-relaxed max-w-sm">
          Your foundation is set. This takes about 3 minutes and fills in the gaps that make your AI coaching significantly more accurate.
        </p>
      </div>

      <div className="space-y-3">
        {[
          {
            label: "Measurements",
            desc: "Weight, height, and body composition for precise targets.",
          },
          {
            label: "Sleep & stress",
            desc: "Recovery signals that directly affect how your plan adapts.",
          },
          {
            label: "Food habits",
            desc: "Dietary patterns and restrictions for nutrition calibration.",
          },
          {
            label: "Training limitations",
            desc: "Injuries, equipment, and schedule constraints.",
          },
        ].map(({ label, desc }) => (
          <div key={label} className="flex items-start gap-3 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3.5">
            <span className="w-4 h-4 rounded-full bg-[#B48B40]/15 border border-[#B48B40]/25 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-2.5 h-2.5 text-[#B48B40]" strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-sm font-medium text-white/72">{label}</p>
              <p className="text-xs text-white/30 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-white/22 leading-relaxed">
        Every field is optional. Skip anything that doesn't apply. The more you share, the tighter the model gets.
      </p>

      <button
        onClick={onStart}
        className="w-full rounded-2xl bg-[#B48B40] text-black font-semibold py-3.5 text-sm tracking-wide hover:bg-[#c99840] transition-colors flex items-center justify-center gap-2"
      >
        Start calibration
        <ArrowRight className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  );
}

function MeasurementsPanel({
  data,
  setData,
}: {
  data: CalibrationData;
  setData: React.Dispatch<React.SetStateAction<CalibrationData>>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-2">Step 1 of 5</p>
        <h2 className="text-2xl font-semibold tracking-tight">Measurements</h2>
        <p className="text-sm text-white/38 mt-1.5 leading-relaxed">
          Used to calibrate your calorie targets and track body composition over time.
        </p>
      </div>

      <div className="space-y-5">
        {/* Weight */}
        <div>
          <FieldLabel>Body weight</FieldLabel>
          <div className="flex gap-2">
            <div className="flex-1">
              <TextInput
                value={data.weight}
                onChange={(v) => setData((d) => ({ ...d, weight: v }))}
                placeholder="e.g. 82"
                type="number"
                suffix={data.weightUnit}
              />
            </div>
            <div className="w-24">
              <UnitToggle
                options={["kg", "lbs"]}
                value={data.weightUnit}
                onChange={(v) => setData((d) => ({ ...d, weightUnit: v as "kg" | "lbs" }))}
              />
            </div>
          </div>
        </div>

        {/* Height */}
        <div>
          <FieldLabel>Height</FieldLabel>
          <div className="flex gap-2">
            <div className="flex-1">
              <TextInput
                value={data.height}
                onChange={(v) => setData((d) => ({ ...d, height: v }))}
                placeholder={data.heightUnit === "cm" ? "e.g. 180" : "e.g. 5'11\""}
                suffix={data.heightUnit}
              />
            </div>
            <div className="w-24">
              <UnitToggle
                options={["cm", "ft"]}
                value={data.heightUnit}
                onChange={(v) => setData((d) => ({ ...d, heightUnit: v as "cm" | "ft" }))}
              />
            </div>
          </div>
        </div>

        {/* Body fat + waist */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel optional>Body fat %</FieldLabel>
            <TextInput
              value={data.bodyFat}
              onChange={(v) => setData((d) => ({ ...d, bodyFat: v }))}
              placeholder="e.g. 18"
              type="number"
              suffix="%"
            />
          </div>
          <div>
            <FieldLabel optional>Waist circumference</FieldLabel>
            <TextInput
              value={data.waist}
              onChange={(v) => setData((d) => ({ ...d, waist: v }))}
              placeholder="e.g. 84"
              type="number"
              suffix={data.weightUnit === "kg" ? "cm" : "in"}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-white/[0.015] px-4 py-3.5">
        <p className="text-xs text-white/28 leading-relaxed">
          Body fat % is the most impactful variable for dialing in your deficit and muscle targets. An estimate is fine — it doesn't need to be precise.
        </p>
      </div>
    </div>
  );
}

function PhotosPanel() {
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-2">Step 2 of 5</p>
        <h2 className="text-2xl font-semibold tracking-tight">Progress photos</h2>
        <p className="text-sm text-white/38 mt-1.5 leading-relaxed">
          Your baseline. These stay private and are only used to track visual progress over time.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(["Front", "Side", "Back"] as const).map((label, i) => (
          <div key={label} className="space-y-2">
            <button
              onClick={() =>
                setSlots((prev) => {
                  const next = [...prev];
                  next[i] = next[i] ? null : "placeholder";
                  return next;
                })
              }
              className={cn(
                "w-full aspect-[3/4] rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all",
                slots[i]
                  ? "border-[#B48B40]/30 bg-[#B48B40]/5"
                  : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
              )}
            >
              {slots[i] ? (
                <>
                  <Check className="w-5 h-5 text-[#B48B40]" strokeWidth={1.5} />
                  <span className="text-[10px] text-[#B48B40]/70">Added</span>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5 text-white/18" strokeWidth={1.5} />
                  <span className="text-[10px] text-white/25">Upload</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-white/28 text-center">{label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.015] px-4 py-3.5">
          <p className="text-xs text-white/28 leading-relaxed">
            Photos are stored encrypted and never visible to anyone except you and your assigned coach. You can delete them at any time from your profile.
          </p>
        </div>

        <div className="flex items-start gap-2.5">
          <span className="text-[#B48B40]/40 text-xs mt-0.5">◈</span>
          <p className="text-xs text-white/28 leading-relaxed">
            Recommended: neutral lighting, same time of day, consistent angles. Doesn't need to be perfect — just a starting point.
          </p>
        </div>
      </div>
    </div>
  );
}

function SleepPanel({
  data,
  setData,
}: {
  data: CalibrationData;
  setData: React.Dispatch<React.SetStateAction<CalibrationData>>;
}) {
  const SLEEP_OPTIONS = ["5 or less", "6", "7", "8", "9+"];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-2">Step 3 of 5</p>
        <h2 className="text-2xl font-semibold tracking-tight">Sleep & stress</h2>
        <p className="text-sm text-white/38 mt-1.5 leading-relaxed">
          Recovery quality is the most underrated variable in any plan. This helps the AI calibrate training load and nutrition targets accordingly.
        </p>
      </div>

      <div className="space-y-6">
        {/* Sleep hours */}
        <div>
          <FieldLabel>Average sleep per night</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {SLEEP_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setData((d) => ({ ...d, sleepHours: opt }))}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
                  data.sleepHours === opt
                    ? "border-[#B48B40]/40 bg-[#B48B40]/10 text-[#B48B40]"
                    : "border-white/8 bg-white/[0.02] text-white/42 hover:text-white/65 hover:border-white/15"
                )}
              >
                {opt}h
              </button>
            ))}
          </div>
        </div>

        {/* Sleep quality */}
        <div>
          <FieldLabel>Sleep quality</FieldLabel>
          <RatingRow
            value={data.sleepQuality}
            onChange={(v) => setData((d) => ({ ...d, sleepQuality: v }))}
            labels={SLEEP_QUALITY_LABELS}
          />
        </div>

        {/* Stress level */}
        <div>
          <FieldLabel>Current stress level</FieldLabel>
          <p className="text-xs text-white/28 mb-3 leading-relaxed">
            Life stress — work, relationships, schedule pressure — directly impacts recovery and adaptation.
          </p>
          <RatingRow
            value={data.stressLevel}
            onChange={(v) => setData((d) => ({ ...d, stressLevel: v as StressLevel }))}
            labels={STRESS_LABELS}
            color="stress"
          />
        </div>

        {/* Recovery note */}
        <div>
          <FieldLabel optional>Anything else about recovery?</FieldLabel>
          <Textarea
            value={data.recoveryNote}
            onChange={(v) => setData((d) => ({ ...d, recoveryNote: v }))}
            placeholder="e.g. I work night shifts, travel frequently, or have a newborn at home..."
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}

function FoodPanel({
  data,
  setData,
}: {
  data: CalibrationData;
  setData: React.Dispatch<React.SetStateAction<CalibrationData>>;
}) {
  const MEALS_OPTIONS = ["1–2", "3", "4", "5+", "Flexible"];
  const HYDRATION_OPTIONS = ["Under 1L", "1–2L", "2–3L", "3L+"];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-2">Step 4 of 5</p>
        <h2 className="text-2xl font-semibold tracking-tight">Food habits</h2>
        <p className="text-sm text-white/38 mt-1.5 leading-relaxed">
          Your nutrition plan should work with how you already eat — not against it.
        </p>
      </div>

      <div className="space-y-6">
        {/* Dietary style */}
        <div>
          <FieldLabel>Dietary approach</FieldLabel>
          <ChipGrid
            options={DIET_STYLES}
            selected={data.dietStyle}
            onToggle={(v) =>
              setData((d) => ({ ...d, dietStyle: toggle(d.dietStyle, v) }))
            }
          />
        </div>

        {/* Meals per day */}
        <div>
          <FieldLabel>Meals per day</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {MEALS_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setData((d) => ({ ...d, mealsPerDay: opt }))}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
                  data.mealsPerDay === opt
                    ? "border-[#B48B40]/40 bg-[#B48B40]/10 text-[#B48B40]"
                    : "border-white/8 bg-white/[0.02] text-white/42 hover:text-white/65 hover:border-white/15"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Restrictions */}
        <div>
          <FieldLabel optional>Allergies or restrictions</FieldLabel>
          <ChipGrid
            options={RESTRICTIONS}
            selected={data.restrictions}
            onToggle={(v) =>
              setData((d) => ({ ...d, restrictions: toggle(d.restrictions, v) }))
            }
          />
        </div>

        {/* Hydration */}
        <div>
          <FieldLabel>Daily water intake</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {HYDRATION_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setData((d) => ({ ...d, hydration: opt }))}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
                  data.hydration === opt
                    ? "border-[#93C5FD]/35 bg-[#93C5FD]/8 text-[#93C5FD]"
                    : "border-white/8 bg-white/[0.02] text-white/42 hover:text-white/65 hover:border-white/15"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LimitationsPanel({
  data,
  setData,
}: {
  data: CalibrationData;
  setData: React.Dispatch<React.SetStateAction<CalibrationData>>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-2">Step 5 of 5</p>
        <h2 className="text-2xl font-semibold tracking-tight">Training limits</h2>
        <p className="text-sm text-white/38 mt-1.5 leading-relaxed">
          This ensures your program works within what's actually available to you — not an ideal scenario.
        </p>
      </div>

      <div className="space-y-6">
        {/* Injuries */}
        <div>
          <FieldLabel optional>Injuries or physical limitations</FieldLabel>
          <Textarea
            value={data.injuries}
            onChange={(v) => setData((d) => ({ ...d, injuries: v }))}
            placeholder="e.g. Lower back tightness, left knee discomfort on deep squats, recovering shoulder impingement..."
            rows={3}
          />
        </div>

        {/* Equipment */}
        <div>
          <FieldLabel>Available equipment</FieldLabel>
          <ChipGrid
            options={EQUIPMENT_OPTIONS}
            selected={data.equipment}
            onToggle={(v) =>
              setData((d) => ({ ...d, equipment: toggle(d.equipment, v) }))
            }
          />
        </div>

        {/* Limited days */}
        <div>
          <FieldLabel optional>Days you can't train</FieldLabel>
          <p className="text-xs text-white/28 mb-3">
            Fixed commitments, rest preferences, or schedule blocks.
          </p>
          <div className="flex gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const limited = data.limitedDays.includes(day);
              return (
                <button
                  key={day}
                  onClick={() =>
                    setData((d) => ({
                      ...d,
                      limitedDays: toggle(d.limitedDays, day),
                    }))
                  }
                  className={cn(
                    "flex-1 rounded-xl border py-2.5 text-xs font-medium transition-all",
                    limited
                      ? "border-[#F87171]/30 bg-[#F87171]/8 text-[#F87171]/80"
                      : "border-white/8 bg-white/[0.02] text-white/38 hover:text-white/60 hover:border-white/14"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Experience note */}
        <div>
          <FieldLabel optional>Anything else your coach should know?</FieldLabel>
          <Textarea
            value={data.experienceNote}
            onChange={(v) => setData((d) => ({ ...d, experienceNote: v }))}
            placeholder="e.g. I've been training for 3 years but took 6 months off. I respond better to lower frequency, higher intensity..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}

function CompletePanel({ onFinish }: { onFinish: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={cn(
      "space-y-8 transition-all duration-500",
      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      <div className="space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
          <Check className="w-6 h-6 text-emerald-400" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-2">Calibration complete</p>
          <h2 className="text-2xl font-semibold tracking-tight">Your plan just got sharper.</h2>
          <p className="text-sm text-white/40 mt-2 leading-relaxed max-w-sm">
            The data you've provided has been fed into your model. Your AI coach will use this to make better decisions — on training, nutrition, and recovery.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {[
          "Calorie and macro targets recalibrated",
          "Recovery thresholds updated",
          "Training program adjusted to your constraints",
          "AI coaching tone and context enriched",
        ].map((item) => (
          <div key={item} className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-full bg-emerald-400/12 border border-emerald-400/25 flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5 text-emerald-400" strokeWidth={2.5} />
            </span>
            <p className="text-sm text-white/55">{item}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/5 bg-white/[0.015] px-4 py-3.5">
        <p className="text-xs text-white/28 leading-relaxed">
          You can update any of this at any time from your profile settings. The model recalibrates automatically when key inputs change.
        </p>
      </div>

      <button
        onClick={onFinish}
        className="w-full rounded-2xl bg-[#B48B40] text-black font-semibold py-3.5 text-sm tracking-wide hover:bg-[#c99840] transition-colors flex items-center justify-center gap-2"
      >
        Back to dashboard
        <ArrowRight className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_DATA: CalibrationData = {
  weight:       "",
  weightUnit:   "kg",
  height:       "",
  heightUnit:   "cm",
  bodyFat:      "",
  waist:        "",
  sleepHours:   "",
  sleepQuality: 0,
  stressLevel:  0 as StressLevel,
  recoveryNote: "",
  dietStyle:    [],
  mealsPerDay:  "",
  restrictions: [],
  hydration:    "",
  injuries:     "",
  equipment:    [],
  limitedDays:  [],
  experienceNote: "",
};

export default function CalibrationPage() {
  const router = useRouter();
  const [step,       setStep]       = useState<Step>("intro");
  const [data,       setData]       = useState<CalibrationData>(DEFAULT_DATA);
  const [animating,  setAnimating]  = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const stepIndex = STEPS.indexOf(step);

  const isContent = step !== "intro" && step !== "complete";

  const contentSteps = STEPS.filter(
    (s): s is Exclude<Step, "intro" | "complete"> =>
      s !== "intro" && s !== "complete"
  );

  const contentIndex = isContent ? contentSteps.indexOf(step) : -1;

  const progress = isContent
    ? ((contentIndex + 1) / contentSteps.length) * 100
    : step === "complete"
      ? 100
      : 0;

  function navigate(target: Step) {
    setAnimating(true);
    setTimeout(() => {
      setStep(target);
      setAnimating(false);
      contentRef.current?.scrollTo({ top: 0 });
    }, 180);
  }

  function goNext() {
    const next = STEPS[stepIndex + 1];
    if (next) navigate(next);
  }

  function goBack() {
    const prev = STEPS[stepIndex - 1];
    if (prev) navigate(prev);
  }

  const showNav = step !== "intro" && step !== "complete";
  const showBack = stepIndex > 1;

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col text-white">

      {/* ── Progress bar ────────────────────────────────────────────── */}
      {isContent && (
        <div className="h-0.5 bg-white/5 shrink-0">
          <div
            className="h-full bg-[#B48B40] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {step === "complete" && (
        <div className="h-0.5 bg-emerald-400/40 shrink-0" />
      )}

      {/* ── Step labels ─────────────────────────────────────────────── */}
      {isContent && (
        <div className="px-4 md:px-6 pt-5 shrink-0">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <button
              onClick={goBack}
              className={cn(
                "flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors",
                !showBack && "invisible"
              )}
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
              Back
            </button>
            <div className="flex items-center gap-1.5">
              {contentSteps.map((s, i) => (
                <div
                  key={s}
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    i === contentIndex
                      ? "w-6 bg-[#B48B40]"
                      : i < contentIndex
                      ? "w-1.5 bg-[#B48B40]/40"
                      : "w-1.5 bg-white/10"
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-white/22 tabular-nums">
              {contentIndex + 1} / {contentSteps.length}
            </span>
          </div>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-8"
        style={{ scrollbarWidth: "none" }}
      >
        <div
          className={cn(
            "max-w-lg mx-auto transition-all duration-180",
            animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
          )}
        >
          {step === "intro"        && <IntroPanel onStart={goNext} />}
          {step === "measurements" && <MeasurementsPanel data={data} setData={setData} />}
          {step === "photos"       && <PhotosPanel />}
          {step === "sleep"        && <SleepPanel data={data} setData={setData} />}
          {step === "food"         && <FoodPanel data={data} setData={setData} />}
          {step === "limitations"  && <LimitationsPanel data={data} setData={setData} />}
          {step === "complete"     && <CompletePanel onFinish={() => router.push("/")} />}
        </div>
      </div>

      {/* ── Bottom nav ──────────────────────────────────────────────── */}
      {showNav && (
        <div className="shrink-0 px-4 md:px-6 pb-6 pt-3 border-t border-white/5 bg-[#0A0A0A]">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-xs text-white/22 hover:text-white/45 transition-colors"
            >
              Exit
            </button>
            <div className="flex-1" />
            <button
              onClick={goNext}
              className="text-xs text-white/28 hover:text-white/55 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={goNext}
              className="rounded-xl bg-[#B48B40] text-black font-semibold px-6 py-2.5 text-sm tracking-wide hover:bg-[#c99840] transition-colors flex items-center gap-2"
            >
              Continue
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
