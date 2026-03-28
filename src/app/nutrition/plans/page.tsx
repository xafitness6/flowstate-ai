"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Sparkles,
  Save,
  ChevronDown,
  ChevronUp,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { hasAccess } from "@/lib/roles";
import { SuggestionApproval } from "@/components/ai/SuggestionApproval";
import type { AISuggestion, ApprovalOutcome } from "@/components/ai/SuggestionApproval";

// ─── Types ────────────────────────────────────────────────────────────────────

type GoalType = "hypertrophy" | "fat_loss" | "maintenance" | "performance";

type MealItem = { id: string; name: string; amount: string; calories: number; protein: number };

type MealDraft = {
  id:       string;
  name:     string;
  time:     string;
  note:     string;
  items:    MealItem[];
  expanded: boolean;
};

type PlanDraft = {
  name:        string;
  goal:        GoalType;
  proteinG:    number;
  carbsG:      number;
  fatG:        number;
  meals:       MealDraft[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const GOAL_OPTIONS: { id: GoalType; label: string; desc: string }[] = [
  { id: "hypertrophy",  label: "Hypertrophy",  desc: "Muscle growth — caloric surplus, high protein"    },
  { id: "fat_loss",     label: "Fat Loss",     desc: "Deficit-based, preserve muscle, high satiety"     },
  { id: "maintenance",  label: "Maintenance",  desc: "Stable body composition, balanced macros"         },
  { id: "performance",  label: "Performance",  desc: "Fuel training output, carb-timed nutrition"       },
];

const AI_SUGGESTION_EXAMPLE: AISuggestion = {
  id:       "s_protein_bump",
  category: "nutrition",
  title:    "Increase daily protein target",
  what:     "Raise protein target from 185g to 205g per day.",
  why:      "Client is in a muscle-building phase (Week 4 of 8) with consistent training compliance above 88%. Current protein intake is borderline for the expected adaptation stimulus at this training volume. A 20g increase aligns with body weight and phase targets.",
  impact:   "Better muscle protein synthesis support during the current hypertrophy phase. Expect marginal strength retention benefit and improved recovery speed.",
  current:  "185g / day",
  proposed: "205g / day",
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function newMeal(name = "New Meal", time = ""): MealDraft {
  return {
    id:       uid(),
    name,
    time,
    note:     "",
    items:    [],
    expanded: true,
  };
}

function newItem(): MealItem {
  return { id: uid(), name: "", amount: "", calories: 0, protein: 0 };
}

const DEFAULT_PLAN: PlanDraft = {
  name:     "Hypertrophy Phase 1",
  goal:     "hypertrophy",
  proteinG: 185,
  carbsG:   280,
  fatG:     70,
  meals: [
    {
      id: "m1", name: "Breakfast", time: "7:30 am", note: "Eat within 30 min of waking.", expanded: false,
      items: [
        { id: "i1", name: "Eggs scrambled",    amount: "3 large",  calories: 210, protein: 18 },
        { id: "i2", name: "Oats",               amount: "100g",     calories: 350, protein: 12 },
        { id: "i3", name: "Banana",             amount: "1 medium", calories: 100, protein: 1  },
      ],
    },
    {
      id: "m2", name: "Pre-workout", time: "11:30 am", note: "", expanded: false,
      items: [
        { id: "i4", name: "Greek yogurt",  amount: "200g",  calories: 120, protein: 17 },
        { id: "i5", name: "Whey protein",  amount: "30g",   calories: 120, protein: 25 },
      ],
    },
    {
      id: "m3", name: "Lunch", time: "2:00 pm", note: "Largest carb window. Don't skip.", expanded: false,
      items: [
        { id: "i6", name: "Chicken breast",   amount: "200g",  calories: 220, protein: 46 },
        { id: "i7", name: "White rice",        amount: "150g",  calories: 195, protein: 4  },
        { id: "i8", name: "Mixed greens",      amount: "1 cup", calories: 20,  protein: 2  },
      ],
    },
    {
      id: "m4", name: "Post-workout", time: "5:30 pm", note: "", expanded: false,
      items: [
        { id: "i9",  name: "Whey protein",  amount: "40g",      calories: 160, protein: 33 },
        { id: "i10", name: "Rice cake",     amount: "2 pieces", calories: 70,  protein: 1  },
      ],
    },
    {
      id: "m5", name: "Dinner", time: "7:30 pm", note: "Keep lighter if training was early.", expanded: false,
      items: [
        { id: "i11", name: "Salmon fillet",    amount: "180g",  calories: 360, protein: 38 },
        { id: "i12", name: "Sweet potato",     amount: "150g",  calories: 130, protein: 2  },
        { id: "i13", name: "Steamed broccoli", amount: "150g",  calories: 50,  protein: 4  },
      ],
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function caloriesFromMacros(p: number, c: number, f: number) {
  return p * 4 + c * 4 + f * 9;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MacroInput({
  label,
  value,
  onChange,
  color,
  unit = "g",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  unit?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/6 bg-[#111111] px-5 py-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">{label}</span>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-16 bg-transparent text-right text-sm font-semibold text-white/85 tabular-nums outline-none border-b border-white/10 pb-0.5 focus:border-white/30 transition-colors"
          />
          <span className="text-xs text-white/30">{unit}</span>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <input
          type="range"
          min={0}
          max={label === "Fats" ? 200 : label === "Carbs" ? 500 : 400}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="flex-1 accent-white h-1"
          style={{ accentColor: color.replace("bg-", "") }}
        />
        <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
      </div>
      <p className="text-[10px] text-white/20">{(value * (label === "Fats" ? 9 : 4)).toLocaleString()} kcal</p>
    </div>
  );
}

function MealEditor({
  meal,
  onChange,
  onRemove,
}: {
  meal: MealDraft;
  onChange: (updated: MealDraft) => void;
  onRemove: () => void;
}) {
  const totalCals    = meal.items.reduce((s, i) => s + i.calories, 0);
  const totalProtein = meal.items.reduce((s, i) => s + i.protein, 0);

  function updateItem(id: string, field: keyof MealItem, value: string | number) {
    onChange({
      ...meal,
      items: meal.items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  }

  function removeItem(id: string) {
    onChange({ ...meal, items: meal.items.filter((i) => i.id !== id) });
  }

  function addItem() {
    onChange({ ...meal, items: [...meal.items, newItem()] });
  }

  return (
    <div className="rounded-2xl border border-white/7 bg-[#111111] overflow-hidden">
      {/* Meal header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          onClick={() => onChange({ ...meal, expanded: !meal.expanded })}
          className="flex-1 flex items-center gap-3 text-left"
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white/85">{meal.name || "Unnamed meal"}</p>
              {meal.time && <p className="text-xs text-white/30">{meal.time}</p>}
            </div>
            {!meal.expanded && (
              <p className="text-xs text-white/28 mt-0.5 tabular-nums">
                {totalCals} kcal · {totalProtein}g protein · {meal.items.length} items
              </p>
            )}
          </div>
          {meal.expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-white/20 ml-auto" strokeWidth={1.5} />
            : <ChevronDown className="w-3.5 h-3.5 text-white/20 ml-auto" strokeWidth={1.5} />
          }
        </button>
        <button onClick={onRemove} className="text-white/20 hover:text-[#F87171]/60 transition-colors shrink-0">
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {meal.expanded && (
        <div className="border-t border-white/6 px-5 py-4 space-y-4">
          {/* Name + time fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-white/22 block mb-1.5">Meal name</label>
              <input
                value={meal.name}
                onChange={(e) => onChange({ ...meal, name: e.target.value })}
                className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/20 outline-none border-b border-white/8 pb-1.5 focus:border-white/22 transition-colors"
                placeholder="e.g. Breakfast"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-white/22 block mb-1.5">Time</label>
              <input
                value={meal.time}
                onChange={(e) => onChange({ ...meal, time: e.target.value })}
                className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/20 outline-none border-b border-white/8 pb-1.5 focus:border-white/22 transition-colors"
                placeholder="e.g. 7:30 am"
              />
            </div>
          </div>

          {/* Items */}
          {meal.items.length > 0 && (
            <div>
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 mb-2 px-1">
                {["Item", "Amount", "kcal", "Prot g", ""].map((h) => (
                  <p key={h} className="text-[10px] uppercase tracking-[0.12em] text-white/18">{h}</p>
                ))}
              </div>
              <div className="space-y-1.5">
                {meal.items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center">
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                      placeholder="Food item"
                      className="bg-white/[0.03] border border-white/6 rounded-lg px-2.5 py-1.5 text-xs text-white/70 placeholder:text-white/20 outline-none focus:border-white/18 transition-colors"
                    />
                    <input
                      value={item.amount}
                      onChange={(e) => updateItem(item.id, "amount", e.target.value)}
                      placeholder="100g"
                      className="bg-white/[0.03] border border-white/6 rounded-lg px-2.5 py-1.5 text-xs text-white/70 placeholder:text-white/20 outline-none focus:border-white/18 transition-colors"
                    />
                    <input
                      type="number"
                      value={item.calories || ""}
                      onChange={(e) => updateItem(item.id, "calories", parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="bg-white/[0.03] border border-white/6 rounded-lg px-2.5 py-1.5 text-xs text-white/70 placeholder:text-white/20 outline-none focus:border-white/18 transition-colors tabular-nums"
                    />
                    <input
                      type="number"
                      value={item.protein || ""}
                      onChange={(e) => updateItem(item.id, "protein", parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="bg-white/[0.03] border border-white/6 rounded-lg px-2.5 py-1.5 text-xs text-white/70 placeholder:text-white/20 outline-none focus:border-white/18 transition-colors tabular-nums"
                    />
                    <button onClick={() => removeItem(item.id)} className="text-white/18 hover:text-[#F87171]/55 transition-colors">
                      <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add item button */}
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/55 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            Add item
          </button>

          {/* Meal totals */}
          {meal.items.length > 0 && (
            <div className="pt-3 border-t border-white/5 flex items-center gap-4 text-xs text-white/40">
              <span className="tabular-nums"><span className="text-white/65 font-medium">{totalCals}</span> kcal total</span>
              <span className="tabular-nums"><span className="text-[#B48B40] font-medium">{totalProtein}g</span> protein</span>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.14em] text-white/22 block mb-1.5">Note (optional)</label>
            <textarea
              value={meal.note}
              onChange={(e) => onChange({ ...meal, note: e.target.value })}
              rows={1}
              placeholder="Timing guidance, preparation tips..."
              className="w-full bg-transparent text-xs text-white/60 placeholder:text-white/18 resize-none outline-none border-b border-white/6 pb-1 focus:border-white/18 transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NutritionPlansPage() {
  const router   = useRouter();
  const { user } = useUser();

  const canEdit = hasAccess(user.role, "trainer");

  const [plan,     setPlan    ] = useState<PlanDraft>(DEFAULT_PLAN);
  const [saved,    setSaved   ] = useState(false);
  const [aiOpen,   setAiOpen  ] = useState(false);

  const totalCals = caloriesFromMacros(plan.proteinG, plan.carbsG, plan.fatG);
  const mealCals  = plan.meals.reduce(
    (s, m) => s + m.items.reduce((ms, i) => ms + i.calories, 0), 0
  );

  function updateMacro(field: "proteinG" | "carbsG" | "fatG", value: number) {
    setPlan((p) => ({ ...p, [field]: value }));
  }

  function updateMeal(id: string, updated: MealDraft) {
    setPlan((p) => ({ ...p, meals: p.meals.map((m) => m.id === id ? updated : m) }));
  }

  function removeMeal(id: string) {
    setPlan((p) => ({ ...p, meals: p.meals.filter((m) => m.id !== id) }));
  }

  function addMeal() {
    setPlan((p) => ({ ...p, meals: [...p.meals, newMeal()] }));
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleAIOutcome(outcome: ApprovalOutcome) {
    if (outcome.action === "approve" || outcome.action === "edit") {
      const newVal = outcome.action === "edit" ? parseInt(outcome.editedValue) || plan.proteinG : 205;
      setPlan((p) => ({ ...p, proteinG: newVal }));
    }
  }

  // ── Access gate ──
  if (!canEdit) {
    return (
      <div className="px-5 md:px-8 py-6 text-white">
        <button
          onClick={() => router.push("/nutrition")}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Nutrition
        </button>
        <div className="rounded-2xl border border-white/6 bg-[#111111] px-6 py-12 text-center space-y-3">
          <Lock className="w-6 h-6 text-white/20 mx-auto" strokeWidth={1.5} />
          <p className="text-sm font-medium text-white/50">Plan customization is available to trainers and admins.</p>
          <p className="text-xs text-white/25">Contact your trainer to request changes to your nutrition plan.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 md:px-8 py-6 text-white space-y-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <button
          onClick={() => router.push("/nutrition")}
          className="flex items-center gap-2 text-sm text-white/35 hover:text-white/65 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Nutrition
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/22 mb-1.5">Nutrition · Edit Plan</p>
            <div className="flex items-center gap-3">
              <input
                value={plan.name}
                onChange={(e) => setPlan((p) => ({ ...p, name: e.target.value }))}
                className="text-2xl font-semibold tracking-tight bg-transparent text-white/90 outline-none border-b border-transparent focus:border-white/15 transition-colors pb-0.5"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <button
              onClick={() => setAiOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#B48B40]/22 bg-[#B48B40]/6 px-3.5 py-2 text-xs font-medium text-[#B48B40]/80 hover:bg-[#B48B40]/10 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
              AI suggest
            </button>
            <button
              onClick={handleSave}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                saved
                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                  : "bg-white/6 border border-white/10 text-white/70 hover:bg-white/10"
              )}
            >
              <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
              {saved ? "Saved" : "Save plan"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Goal type ─────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3">Goal type</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {GOAL_OPTIONS.map((g) => (
            <button
              key={g.id}
              onClick={() => setPlan((p) => ({ ...p, goal: g.id }))}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition-all",
                plan.goal === g.id
                  ? "border-[#B48B40]/35 bg-[#B48B40]/8"
                  : "border-white/6 bg-[#111111] hover:bg-white/[0.03]"
              )}
            >
              <p className={cn("text-sm font-semibold", plan.goal === g.id ? "text-[#B48B40]" : "text-white/75")}>
                {g.label}
              </p>
              <p className="text-[10px] text-white/28 mt-0.5 leading-relaxed">{g.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Macro targets ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">Daily macro targets</p>
          <div className="flex items-center gap-3 text-xs text-white/35">
            <span className="tabular-nums">
              <span className="text-white/65 font-semibold">{totalCals.toLocaleString()}</span> kcal target
            </span>
            {mealCals > 0 && (
              <span className="tabular-nums text-white/25">
                {mealCals.toLocaleString()} planned in meals
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MacroInput
            label="Protein"
            value={plan.proteinG}
            onChange={(v) => updateMacro("proteinG", v)}
            color="bg-[#B48B40]"
          />
          <MacroInput
            label="Carbs"
            value={plan.carbsG}
            onChange={(v) => updateMacro("carbsG", v)}
            color="bg-white/40"
          />
          <MacroInput
            label="Fats"
            value={plan.fatG}
            onChange={(v) => updateMacro("fatG", v)}
            color="bg-[#93C5FD]/60"
          />
        </div>
      </div>

      {/* ── Meals ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">Meals</p>
          <p className="text-xs text-white/28">{plan.meals.length} meals planned</p>
        </div>
        <div className="space-y-2.5">
          {plan.meals.map((meal) => (
            <MealEditor
              key={meal.id}
              meal={meal}
              onChange={(updated) => updateMeal(meal.id, updated)}
              onRemove={() => removeMeal(meal.id)}
            />
          ))}
        </div>
        <button
          onClick={addMeal}
          className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-white/10 bg-transparent hover:border-white/18 hover:bg-white/[0.02] transition-all w-full py-4 justify-center text-sm text-white/30 hover:text-white/55"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          Add meal
        </button>
      </div>

      {/* ── AI suggestion modal ───────────────────────────────────── */}
      {aiOpen && (
        <SuggestionApproval
          suggestion={AI_SUGGESTION_EXAMPLE}
          onClose={() => setAiOpen(false)}
          onOutcome={handleAIOutcome}
        />
      )}
    </div>
  );
}
