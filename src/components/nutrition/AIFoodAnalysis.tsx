"use client";

import { useState, useRef, useEffect } from "react";
import {
  Upload, Mic, MicOff, Camera, Loader2, X,
  Sparkles, ChevronDown, Utensils, Check, Scan,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalysisTab = "photo" | "voice" | "camera";

type MacroEstimate = {
  kcal: number | string;
  protein: number | string;
  carbs: number | string;
  fat: number | string;
  note?: string;
};

type PhotoAnalysis = {
  detected: string;
  context: "meal" | "menu" | "grocery";
  goalFit: string;
  proteinEst: string;
  portionGuide: string;
  substitution: string;
  macros: MacroEstimate;
};

type MealIdea = {
  name: string;
  tag: string;
  tagColor: string;
  items: string[];
  macros: { kcal: number; protein: number; carbs: number; fat: number };
};

type VoiceScenario = {
  transcript: string;
  response: string[];
};

// ─── Mock analysis scenarios ──────────────────────────────────────────────────

const PHOTO_SCENARIOS: PhotoAnalysis[] = [
  {
    detected: "Grilled chicken breast with basmati rice and roasted vegetables",
    context: "meal",
    goalFit: "Excellent match for Hypertrophy. High protein, moderate complex carbs, low fat.",
    proteinEst: "40–48g",
    portionGuide: "Chicken is about 1.5 palms — generous and on target. Rice is 1 cupped hand. Vegetables fill the rest freely.",
    substitution: "Request sauces on the side. Swap white rice for sweet potato if you want slower-digesting carbs.",
    macros: { kcal: 540, protein: 44, carbs: 50, fat: 11 },
  },
  {
    detected: "Restaurant menu — protein mains, pasta section, salads, and sides",
    context: "menu",
    goalFit: "Best picks: grilled fish, sirloin steak, or any chicken main. Avoid pasta — low protein density.",
    proteinEst: "38–52g depending on selection",
    portionGuide: "Order one protein main. No need to double up — a single grilled entrée hits your target.",
    substitution: "Swap fries for salad or vegetables. Ask for dressings and sauces on the side. Skip the bread basket.",
    macros: { kcal: "480–620", protein: "38–52g", carbs: "30–55g", fat: "12–20g", note: "varies by selection" },
  },
  {
    detected: "Chicken breast, eggs, Greek yogurt, oats, spinach, olive oil",
    context: "grocery",
    goalFit: "Strong haul for Hypertrophy. All high-leverage protein sources. Covers 3 meals + 2 snacks at target macros.",
    proteinEst: "~165–185g across the day with this setup",
    portionGuide: "Chicken as your anchor meal protein. Eggs for breakfast. Yogurt fills the snack window. Oats pre-training.",
    substitution: "Add sweet potatoes or rice for post-workout carbs. Grab a second protein source — salmon or tuna — if you want variety.",
    macros: { kcal: "~2,200–2,400 / day", protein: "~170g", carbs: "~240g", fat: "~65g", note: "estimated full-day" },
  },
];

const MEAL_IDEAS: Record<PhotoAnalysis["context"], MealIdea[]> = {
  meal: [
    {
      name: "Hypertrophy Power Plate",
      tag: "Goal match",
      tagColor: "text-[#B48B40] border-[#B48B40]/25 bg-[#B48B40]/6",
      items: ["200g chicken breast", "150g basmati rice", "100g roasted vegetables", "1 tsp olive oil"],
      macros: { kcal: 560, protein: 46, carbs: 52, fat: 12 },
    },
    {
      name: "Lean Cut Variation",
      tag: "Lower cal",
      tagColor: "text-[#93C5FD]/80 border-[#93C5FD]/20 bg-[#93C5FD]/5",
      items: ["200g chicken breast", "75g rice", "200g mixed greens", "Lemon + olive oil dressing"],
      macros: { kcal: 420, protein: 44, carbs: 28, fat: 9 },
    },
  ],
  menu: [
    {
      name: "Best Order Off This Menu",
      tag: "Recommended",
      tagColor: "text-[#B48B40] border-[#B48B40]/25 bg-[#B48B40]/6",
      items: ["Grilled salmon or sirloin steak (main)", "Side salad or steamed vegetables", "Water or sparkling water", "Sauce on the side"],
      macros: { kcal: 520, protein: 46, carbs: 22, fat: 18 },
    },
    {
      name: "High-Protein Budget Pick",
      tag: "Simple",
      tagColor: "text-white/45 border-white/12 bg-white/[0.03]",
      items: ["Grilled chicken salad (any)", "Extra protein add-on if available", "Side of rice or potato"],
      macros: { kcal: 460, protein: 42, carbs: 35, fat: 10 },
    },
  ],
  grocery: [
    {
      name: "Training Day Build",
      tag: "High-output",
      tagColor: "text-[#B48B40] border-[#B48B40]/25 bg-[#B48B40]/6",
      items: ["200g chicken breast", "120g cooked oats (pre-workout)", "100g Greek yogurt + berries", "2 eggs scrambled", "Spinach salad + olive oil"],
      macros: { kcal: 860, protein: 78, carbs: 88, fat: 22 },
    },
    {
      name: "Rest Day Lean Stack",
      tag: "Lower carb",
      tagColor: "text-[#93C5FD]/80 border-[#93C5FD]/20 bg-[#93C5FD]/5",
      items: ["3 eggs + spinach omelette", "150g Greek yogurt", "150g chicken breast (lunch)", "Salad + olive oil drizzle"],
      macros: { kcal: 620, protein: 68, carbs: 24, fat: 28 },
    },
  ],
};

const VOICE_SCENARIOS: VoiceScenario[] = [
  {
    transcript: "What should I eat here? I'm at a restaurant and I need to hit my protein.",
    response: [
      "Here's how I'd order at a restaurant on a training day.",
      "Lead with the protein — any grilled chicken, fish, or steak option is your anchor. Aim for 1.5–2 palms worth. Pick a side that's mostly vegetables or a small carb portion: rice, potato, or a legume base works.",
      "Skip the bread basket and cream sauces. Ask for dressing on the side. You'll hit your numbers easily with one main course.",
    ],
  },
  {
    transcript: "How much protein should I be having at this meal? I'm trying to hit my daily target.",
    response: [
      "Based on where you are in the day, here's the number.",
      "You're at 142g of a 185g target — 43g still to close. For a single meal that's about 180g cooked chicken, 200g salmon, or 5 large eggs. Any of those gets you there.",
      "For plating: fill about ¼ of your plate with protein (palm-sized portion). Add a fist of carbs if you're in a training window. Fats to a thumb-sized drizzle. That's the structure.",
    ],
  },
  {
    transcript: "Can you help me portion this meal? I've got chicken, rice, and vegetables.",
    response: [
      "Clean setup — here's how to plate it.",
      "Chicken: 1.5 palms (about 180g cooked). That's your primary lever for the meal. Rice: 1 cupped hand (around 120g cooked). Vegetables: fill the remaining plate freely — no limit. Fat: if you're adding oil or sauce, keep it to a thumb-sized amount.",
      "That puts you at roughly 480 kcal, 42g protein, 45g carbs, 10g fat. Clean and on target.",
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all",
        active
          ? "bg-[#B48B40]/12 text-[#B48B40] border border-[#B48B40]/20"
          : "text-white/35 hover:text-white/65 border border-transparent"
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
      {label}
    </button>
  );
}

function MacroGrid({ macros }: { macros: MacroEstimate }) {
  const items = [
    { label: "Calories", value: typeof macros.kcal === "number" ? `${macros.kcal}` : macros.kcal, unit: typeof macros.kcal === "number" ? "kcal" : "" },
    { label: "Protein",  value: typeof macros.protein === "number" ? `${macros.protein}` : macros.protein, unit: typeof macros.protein === "number" ? "g" : "" },
    { label: "Carbs",    value: typeof macros.carbs === "number" ? `${macros.carbs}` : macros.carbs, unit: typeof macros.carbs === "number" ? "g" : "" },
    { label: "Fat",      value: typeof macros.fat === "number" ? `${macros.fat}` : macros.fat, unit: typeof macros.fat === "number" ? "g" : "" },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(({ label, value, unit }) => (
        <div key={label} className="rounded-xl border border-white/6 bg-white/[0.02] px-2.5 py-2.5 text-center">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/25 mb-1">{label}</p>
          <p className="text-sm font-semibold text-white/80 tabular-nums leading-none">
            {value}<span className="text-[10px] text-white/35 font-normal">{unit}</span>
          </p>
        </div>
      ))}
      {macros.note && (
        <p className="col-span-4 text-[10px] text-white/20 mt-1 text-center">{macros.note}</p>
      )}
    </div>
  );
}

function PortionBadge({ zone, reference, color }: { zone: string; reference: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("text-[9px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 rounded border", color)}>
        {zone}
      </span>
      <span className="text-[11px] text-white/40">{reference}</span>
    </div>
  );
}

function MealIdeaCard({ idea }: { idea: MealIdea }) {
  return (
    <div className="rounded-xl border border-white/7 bg-white/[0.025] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white/80">{idea.name}</p>
        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md border shrink-0", idea.tagColor)}>
          {idea.tag}
        </span>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {idea.items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-white/18 shrink-0" />
            <span className="text-xs text-white/50">{item}</span>
          </div>
        ))}
        <div className="flex items-center gap-3 pt-2.5 mt-1 border-t border-white/5">
          {[
            { v: idea.macros.kcal, u: "kcal", c: "text-white/50" },
            { v: idea.macros.protein, u: "g P", c: "text-[#B48B40]/80" },
            { v: idea.macros.carbs, u: "g C", c: "text-[#93C5FD]/70" },
            { v: idea.macros.fat, u: "g F", c: "text-emerald-400/60" },
          ].map(({ v, u, c }) => (
            <div key={u} className="flex items-baseline gap-0.5">
              <span className={cn("text-xs font-semibold tabular-nums", c)}>{v}</span>
              <span className="text-[10px] text-white/20">{u}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Photo tab ────────────────────────────────────────────────────────────────

function PhotoTab() {
  const inputRef    = useRef<HTMLInputElement>(null);
  const [photoUrl,  setPhotoUrl ] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis,  setAnalysis ] = useState<PhotoAnalysis | null>(null);
  const [mealOpen,  setMealOpen ] = useState(false);
  const [mealLoading, setMealLoading] = useState(false);
  const [mealIdeas, setMealIdeas] = useState<MealIdea[] | null>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setAnalysis(null);
    setMealIdeas(null);
    setMealOpen(false);
    setAnalyzing(true);

    setTimeout(() => {
      const idx = Math.floor(Math.random() * PHOTO_SCENARIOS.length);
      setAnalysis(PHOTO_SCENARIOS[idx]);
      setAnalyzing(false);
    }, 1800);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleBuildMeal() {
    if (!analysis) return;
    setMealOpen(true);
    setMealLoading(true);
    setTimeout(() => {
      setMealIdeas(MEAL_IDEAS[analysis.context]);
      setMealLoading(false);
    }, 1100);
  }

  function reset() {
    setPhotoUrl(null);
    setAnalysis(null);
    setMealIdeas(null);
    setMealOpen(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      {!photoUrl ? (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="block cursor-pointer"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
          />
          <div className="rounded-2xl border-2 border-dashed border-white/10 hover:border-[#B48B40]/35 bg-white/[0.015] hover:bg-[#B48B40]/[0.03] transition-all px-6 py-10 flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center">
              <Upload className="w-4 h-4 text-white/35" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white/55">Upload a photo</p>
              <p className="text-xs text-white/28 mt-1">Meal · Menu · Groceries · Drag & drop or tap</p>
            </div>
          </div>
        </label>
      ) : (
        <div className="relative rounded-2xl overflow-hidden border border-white/8 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Food photo"
            className="w-full object-cover max-h-52"
          />
          <button
            onClick={reset}
            className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          {analyzing && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-2.5">
              <Loader2 className="w-5 h-5 text-[#B48B40] animate-spin" strokeWidth={1.5} />
              <p className="text-xs text-white/60">Analyzing…</p>
            </div>
          )}
        </div>
      )}

      {/* Analysis result */}
      {analysis && !analyzing && (
        <div className="space-y-3">

          {/* Detected + goal fit */}
          <div className="rounded-2xl border border-white/7 bg-[#111111] overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#B48B40]/70 shrink-0" strokeWidth={1.5} />
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#B48B40]/70">
                  {analysis.context === "meal" ? "Meal detected"
                    : analysis.context === "menu" ? "Menu detected"
                    : "Groceries detected"}
                </p>
              </div>
              <p className="text-sm text-white/65 leading-snug">{analysis.detected}</p>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Goal fit */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 mb-1.5">For your goal</p>
                <p className="text-sm text-white/65 leading-relaxed">{analysis.goalFit}</p>
              </div>

              {/* Macros */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 mb-2">Estimated macros</p>
                <MacroGrid macros={analysis.macros} />
              </div>

              {/* Portion guide */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 mb-2">Portion guidance</p>
                <p className="text-sm text-white/55 leading-relaxed mb-2.5">{analysis.portionGuide}</p>
                <div className="flex flex-wrap gap-2">
                  <PortionBadge zone="Protein"  reference="1–1.5 palms"  color="text-[#B48B40]/80 border-[#B48B40]/20 bg-[#B48B40]/6" />
                  <PortionBadge zone="Carbs"    reference="1 cupped hand" color="text-[#93C5FD]/80 border-[#93C5FD]/20 bg-[#93C5FD]/5" />
                  <PortionBadge zone="Fat"      reference="thumb-sized"   color="text-emerald-400/80 border-emerald-400/20 bg-emerald-400/5" />
                </div>
              </div>

              {/* Substitution */}
              <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/22 mb-1">Tip</p>
                <p className="text-xs text-white/50 leading-relaxed">{analysis.substitution}</p>
              </div>
            </div>
          </div>

          {/* Build a meal CTA */}
          {!mealOpen && (
            <button
              onClick={handleBuildMeal}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#B48B40]/20 bg-[#B48B40]/6 hover:bg-[#B48B40]/10 px-4 py-3 text-sm font-medium text-[#B48B40]/80 hover:text-[#B48B40] transition-all"
            >
              <Utensils className="w-3.5 h-3.5" strokeWidth={1.5} />
              Build a meal with this
            </button>
          )}

          {/* Meal ideas */}
          {mealOpen && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <Utensils className="w-3.5 h-3.5 text-[#B48B40]/60" strokeWidth={1.5} />
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">Meal ideas</p>
              </div>

              {mealLoading ? (
                <div className="rounded-xl border border-white/6 bg-white/[0.015] px-4 py-6 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 text-[#B48B40]/60 animate-spin" strokeWidth={1.5} />
                  <p className="text-xs text-white/30">Building options…</p>
                </div>
              ) : (
                mealIdeas?.map((idea, i) => <MealIdeaCard key={i} idea={idea} />)
              )}
            </div>
          )}
        </div>
      )}

      {/* Idle helper text */}
      {!photoUrl && (
        <p className="text-[11px] text-white/20 text-center px-4 leading-relaxed">
          Photos stay local and are never uploaded to a server.
        </p>
      )}
    </div>
  );
}

// ─── Voice tab ────────────────────────────────────────────────────────────────

function VoiceTab() {
  const [recording,     setRecording    ] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing,  setTranscribing ] = useState(false);
  const [transcript,    setTranscript   ] = useState<string | null>(null);
  const [response,      setResponse     ] = useState<string[] | null>(null);
  const [scenarioIdx,   setScenarioIdx  ] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startRecording() {
    setRecording(true);
    setTranscript(null);
    setResponse(null);
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime((t) => {
        if (t >= 14) { stopRecording(); return t; }
        return t + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setTranscribing(true);

    setTimeout(() => {
      const scenario = VOICE_SCENARIOS[scenarioIdx % VOICE_SCENARIOS.length];
      setTranscript(scenario.transcript);
      setTranscribing(false);

      setTimeout(() => {
        setResponse(scenario.response);
        setScenarioIdx((i) => i + 1);
      }, 500);
    }, 900);
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function reset() {
    setRecording(false);
    setTranscript(null);
    setResponse(null);
    setTranscribing(false);
    setRecordingTime(0);
  }

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      {/* Record button area */}
      <div className="flex flex-col items-center gap-4 py-4">
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={transcribing}
          className={cn(
            "relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300",
            recording
              ? "bg-[#EF4444]/15 border-2 border-[#EF4444]/50"
              : transcribing
                ? "bg-white/5 border-2 border-white/10 opacity-50 cursor-default"
                : "bg-[#B48B40]/10 border-2 border-[#B48B40]/30 hover:bg-[#B48B40]/15 hover:border-[#B48B40]/50"
          )}
        >
          {/* Pulse ring when recording */}
          {recording && (
            <>
              <span className="absolute inset-0 rounded-full bg-[#EF4444]/10 animate-ping" />
              <span className="absolute inset-[-8px] rounded-full border border-[#EF4444]/15 animate-pulse" />
            </>
          )}
          {transcribing ? (
            <Loader2 className="w-6 h-6 text-white/40 animate-spin" strokeWidth={1.5} />
          ) : recording ? (
            <MicOff className="w-6 h-6 text-[#EF4444]/80" strokeWidth={1.5} />
          ) : (
            <Mic className="w-6 h-6 text-[#B48B40]/70" strokeWidth={1.5} />
          )}
        </button>

        <div className="text-center">
          {recording ? (
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-[#EF4444]/70 tabular-nums">{formatTime(recordingTime)}</p>
              <p className="text-xs text-white/30">Tap to stop · auto-stops at 0:15</p>
            </div>
          ) : transcribing ? (
            <p className="text-xs text-white/35">Transcribing…</p>
          ) : transcript ? (
            <button onClick={reset} className="text-xs text-white/25 hover:text-white/50 transition-colors">
              Ask again
            </button>
          ) : (
            <div className="space-y-0.5">
              <p className="text-sm text-white/50">Tap to record</p>
              <p className="text-xs text-white/25">Ask anything about food, portions, or what to eat</p>
            </div>
          )}
        </div>
      </div>

      {/* Waveform bars when recording */}
      {recording && (
        <div className="flex items-center justify-center gap-0.5 h-8">
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-[#EF4444]/40"
              style={{
                height: `${20 + Math.sin(i * 0.8 + Date.now() / 200) * 16}%`,
                animationDuration: `${0.5 + (i % 4) * 0.15}s`,
                animation: "pulse 0.6s ease-in-out infinite alternate",
                animationDelay: `${i * 0.04}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Transcript */}
      {transcript && (
        <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/22 mb-1.5">You said</p>
          <p className="text-sm text-white/55 leading-relaxed italic">&ldquo;{transcript}&rdquo;</p>
        </div>
      )}

      {/* AI response */}
      {response && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <div className="w-5 h-5 rounded-full bg-[#1C1C1C] border border-[#B48B40]/25 flex items-center justify-center shrink-0">
              <span className="text-[#B48B40] text-[9px] leading-none">◈</span>
            </div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">Coach response</p>
          </div>
          {response.map((line, i) => (
            <div
              key={i}
              className="rounded-2xl rounded-tl-sm border border-white/7 bg-[#111111] px-4 py-3"
            >
              <p className="text-sm text-white/70 leading-relaxed">{line}</p>
            </div>
          ))}
        </div>
      )}

      {/* Prompt suggestions */}
      {!transcript && !recording && !transcribing && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/20 px-1 mb-2">Try asking</p>
          {[
            "What should I eat here?",
            "How much protein should I have?",
            "Help me portion this meal",
          ].map((q) => (
            <div
              key={q}
              className="rounded-xl border border-white/6 bg-white/[0.015] px-3.5 py-2.5"
            >
              <p className="text-xs text-white/35">&ldquo;{q}&rdquo;</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Camera spec tab ──────────────────────────────────────────────────────────

function CameraTab() {
  const zones = [
    {
      label: "Protein zone",
      reference: "Palm or fist",
      detail: "~30–45g protein",
      color:  "text-[#B48B40]",
      dot:    "bg-[#B48B40]",
      border: "border-[#B48B40]/20",
      bg:     "bg-[#B48B40]/6",
      fill:   "bg-[#B48B40]/25",
      size:   "w-12 h-12",
      shape:  "rounded-xl",
    },
    {
      label: "Carb zone",
      reference: "Cupped hand",
      detail: "~40–55g carbs",
      color:  "text-[#93C5FD]/80",
      dot:    "bg-[#93C5FD]",
      border: "border-[#93C5FD]/15",
      bg:     "bg-[#93C5FD]/5",
      fill:   "bg-[#93C5FD]/20",
      size:   "w-10 h-9",
      shape:  "rounded-lg",
    },
    {
      label: "Fat zone",
      reference: "Thumb",
      detail: "~10–15g fat",
      color:  "text-emerald-400/80",
      dot:    "bg-emerald-400",
      border: "border-emerald-400/15",
      bg:     "bg-emerald-400/5",
      fill:   "bg-emerald-400/20",
      size:   "w-5 h-8",
      shape:  "rounded-md",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Feature header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Scan className="w-4 h-4 text-[#B48B40]/60" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-white/80 tracking-tight">Live portion guidance</p>
          </div>
          <p className="text-xs text-white/35 leading-relaxed">
            Point your camera at a meal and get real-time portion zones overlaid on screen.
          </p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded-lg border border-white/10 bg-white/[0.03] text-white/30 shrink-0 whitespace-nowrap">
          Coming soon
        </span>
      </div>

      {/* Mock camera viewport */}
      <div className="rounded-2xl border border-white/8 bg-[#0A0A0A] overflow-hidden">
        {/* Viewport frame */}
        <div className="relative aspect-[4/3] bg-[#080808] flex items-center justify-center">
          {/* Corner brackets */}
          {[
            "top-3 left-3 border-t-2 border-l-2 rounded-tl-lg w-8 h-8",
            "top-3 right-3 border-t-2 border-r-2 rounded-tr-lg w-8 h-8",
            "bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg w-8 h-8",
            "bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg w-8 h-8",
          ].map((cls) => (
            <div key={cls} className={cn("absolute border-white/20", cls)} />
          ))}

          {/* Mock plate area */}
          <div className="relative w-[70%] aspect-square rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center">
            {/* Protein zone */}
            <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[38%] h-[36%] rounded-xl bg-[#B48B40]/18 border border-[#B48B40]/30 flex items-center justify-center">
              <p className="text-[9px] font-semibold text-[#B48B40]/80 uppercase tracking-[0.08em]">Protein</p>
            </div>
            {/* Carb zone */}
            <div className="absolute bottom-[18%] left-[15%] w-[30%] h-[26%] rounded-lg bg-[#93C5FD]/14 border border-[#93C5FD]/25 flex items-center justify-center">
              <p className="text-[9px] font-semibold text-[#93C5FD]/70 uppercase tracking-[0.08em]">Carbs</p>
            </div>
            {/* Fat zone */}
            <div className="absolute bottom-[22%] right-[12%] w-[18%] h-[16%] rounded-md bg-emerald-400/12 border border-emerald-400/22 flex items-center justify-center">
              <p className="text-[9px] font-semibold text-emerald-400/65 uppercase tracking-[0.08em]">Fat</p>
            </div>
            {/* Center plate label */}
            <p className="absolute bottom-[8%] left-1/2 -translate-x-1/2 text-[9px] text-white/15 whitespace-nowrap">
              plate view
            </p>
          </div>

          {/* Scan overlay effect */}
          <div className="absolute inset-x-3 h-px bg-gradient-to-r from-transparent via-[#B48B40]/30 to-transparent top-1/3 opacity-60" />

          {/* Status indicator */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-white/8 bg-black/60 backdrop-blur-sm px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B48B40]/60 animate-pulse" />
            <p className="text-[10px] text-white/40">Analysing portions…</p>
          </div>
        </div>

        {/* Zone legend */}
        <div className="px-4 py-4 border-t border-white/5 space-y-2.5">
          {zones.map((z) => (
            <div key={z.label} className={cn("rounded-xl border px-4 py-3 flex items-center gap-4", z.border, z.bg)}>
              {/* Visual size reference */}
              <div className="shrink-0 w-10 flex items-end justify-center">
                <div className={cn(z.fill, z.size, z.shape)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-semibold", z.color)}>{z.label}</p>
                <p className="text-[11px] text-white/40 mt-0.5">{z.reference} · {z.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature description */}
      <div className="space-y-2.5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">How it works</p>
        {[
          { step: "1", text: "Open the camera and point it at your plate or meal" },
          { step: "2", text: "Colour-coded zones appear in real time: amber for protein, blue for carbs, green for fat" },
          { step: "3", text: "Each zone scales to your specific macro targets and goal" },
          { step: "4", text: "Adjust portions on screen and see your estimated macros update live" },
        ].map(({ step, text }) => (
          <div key={step} className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full border border-white/10 bg-white/[0.03] text-[10px] text-white/30 flex items-center justify-center shrink-0 mt-0.5">
              {step}
            </span>
            <p className="text-xs text-white/40 leading-relaxed pt-0.5">{text}</p>
          </div>
        ))}
      </div>

      {/* Interest CTA */}
      <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3.5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-white/55">This feature is in development.</p>
          <p className="text-[11px] text-white/28 mt-0.5">Available in a future release.</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[#B48B40]/60 shrink-0">
          <Check className="w-3 h-3" strokeWidth={2} />
          <span>Tracked</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AIFoodAnalysis({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<AnalysisTab>("photo");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-lg bg-[#0D0D0D] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "90dvh" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#B48B40]/70" strokeWidth={1.5} />
              <h2 className="text-sm font-semibold text-white/80 tracking-tight">AI food analysis</h2>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg border border-white/8 bg-white/[0.03] flex items-center justify-center text-white/30 hover:text-white/65 transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5">
            <TabButton active={tab === "photo"}  onClick={() => setTab("photo")}  icon={Upload} label="Photo"  />
            <TabButton active={tab === "voice"}  onClick={() => setTab("voice")}  icon={Mic}    label="Voice"  />
            <TabButton active={tab === "camera"} onClick={() => setTab("camera")} icon={Camera} label="Camera" />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5" style={{ scrollbarWidth: "none" }}>
          {tab === "photo"  && <PhotoTab  key="photo"  />}
          {tab === "voice"  && <VoiceTab  key="voice"  />}
          {tab === "camera" && <CameraTab key="camera" />}
        </div>

        {/* Context footer */}
        <div className="px-5 py-3 border-t border-white/[0.05] shrink-0">
          <p className="text-[10px] text-white/18 text-center">
            Responses are based on your Hypertrophy goal · 185g protein · 2,330 kcal target
          </p>
        </div>
      </div>
    </div>
  );
}
