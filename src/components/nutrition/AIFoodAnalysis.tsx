"use client";

import { useState, useRef, useEffect } from "react";
import {
  Upload, Mic, MicOff, Camera, Loader2, X,
  Sparkles, Check, Scan, Trash2, ChevronDown,
} from "lucide-react";
import { cn }        from "@/lib/utils";
import { saveMeal }  from "@/lib/nutrition/store";
import type {
  NutritionParseResult,
  LoggedMeal,
  LoggedFoodItem,
  MealType,
  MealTotals,
  NutritionLogSource,
} from "@/lib/nutrition/types";
import type { NutritionTargets } from "@/lib/nutrition";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalysisTab = "photo" | "voice" | "camera";

interface EditableItem {
  id:         string;
  name:       string;
  quantity:   number | null;
  unit:       string | null;
  calories:   number | null;
  protein:    number | null;
  carbs:      number | null;
  fat:        number | null;
  confidence: number;
  removed:    boolean;
}

interface Props {
  open:          boolean;
  onClose:       () => void;
  userId:        string;
  targets?:      NutritionTargets;
  onMealLogged?: (meal: LoggedMeal) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl  = reader.result as string;
      const base64   = dataUrl.split(",")[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function recalcTotals(items: EditableItem[]): MealTotals {
  return items
    .filter((i) => !i.removed)
    .reduce(
      (acc, i) => ({
        calories: acc.calories + (i.calories ?? 0),
        protein:  acc.protein  + (i.protein  ?? 0),
        carbs:    acc.carbs    + (i.carbs    ?? 0),
        fat:      acc.fat      + (i.fat      ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
}

function formatItemLabel(item: EditableItem): string {
  const qty  = item.quantity != null ? `${item.quantity}` : "";
  const unit = item.unit && item.unit !== "item" ? item.unit : "";
  return [qty, unit, item.name].filter(Boolean).join(" ");
}

const MEAL_TYPE_OPTIONS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", unknown: "Meal",
};

// ─── Parsed result review panel ───────────────────────────────────────────────

function ParsedResultPanel({
  parseResult,
  rawTranscript,
  source,
  userId,
  onSaved,
  onReset,
}: {
  parseResult:   NutritionParseResult;
  rawTranscript: string | null;
  source:        NutritionLogSource;
  userId:        string;
  onSaved:       (meal: LoggedMeal) => void;
  onReset:       () => void;
}) {
  const [mealType, setMealType]   = useState<MealType>(
    parseResult.mealType === "unknown" ? "snack" : parseResult.mealType,
  );
  const [typeOpen, setTypeOpen]   = useState(false);
  const [items,    setItems]      = useState<EditableItem[]>(
    parseResult.items.map((item, i) => ({
      id:         `ai_${i}`,
      name:       item.name,
      quantity:   item.quantity,
      unit:       item.unit,
      calories:   item.calories,
      protein:    item.protein,
      carbs:      item.carbs,
      fat:        item.fat,
      confidence: item.confidence,
      removed:    false,
    })),
  );

  const activeItems = items.filter((i) => !i.removed);
  const totals      = recalcTotals(items);

  function remove(id: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, removed: true } : i));
  }

  function restore(id: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, removed: false } : i));
  }

  function handleLog() {
    const now = new Date().toISOString();
    const loggedItems: LoggedFoodItem[] = activeItems.map((i) => ({
      id:         i.id,
      name:       i.name,
      quantity:   i.quantity,
      unit:       i.unit,
      grams:      null,
      calories:   i.calories,
      protein:    i.protein,
      carbs:      i.carbs,
      fat:        i.fat,
      confidence: i.confidence,
      source,
      deletedAt:  null,
    }));

    const meal = saveMeal(userId, {
      userId,
      source,
      mealType,
      eatenAt:         now,
      rawTranscript,
      cleanTranscript: parseResult.cleanTranscript,
      notes:           null,
      items:           loggedItems,
      totals,
      needsReview:     false,
    });

    onSaved(meal);
  }

  return (
    <div className="space-y-4">
      {/* Description */}
      {parseResult.cleanTranscript && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-1.5">Detected</p>
          <p className="text-sm text-white/60 leading-relaxed">{parseResult.cleanTranscript}</p>
        </div>
      )}

      {/* Meal type */}
      <div className="relative">
        <button
          onClick={() => setTypeOpen((v) => !v)}
          className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/65 hover:border-white/18 transition-colors"
        >
          {MEAL_TYPE_LABELS[mealType]}
          <ChevronDown className={cn("w-4 h-4 text-white/25 transition-transform", typeOpen && "rotate-180")} strokeWidth={1.5} />
        </button>
        {typeOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-white/10 bg-[#111111] shadow-xl z-10 overflow-hidden">
            {MEAL_TYPE_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => { setMealType(t); setTypeOpen(false); }}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-sm transition-colors",
                  t === mealType
                    ? "text-[#B48B40] bg-[#B48B40]/8"
                    : "text-white/50 hover:text-white/70 hover:bg-white/[0.03]",
                )}
              >
                {MEAL_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Items */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-2">
          Items ({activeItems.length})
        </p>
        <div className="space-y-1.5">
          {items.map((item) =>
            item.removed ? null : (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5"
              >
                <Check className="w-3 h-3 text-emerald-400/50 shrink-0" strokeWidth={2.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/70">{formatItemLabel(item)}</p>
                  {item.calories != null && (
                    <p className="text-[10px] text-white/25 mt-0.5 tabular-nums">
                      {item.calories} kcal
                      {item.protein != null && ` · ${item.protein}g P`}
                      {item.carbs   != null && ` · ${item.carbs}g C`}
                      {item.fat     != null && ` · ${item.fat}g F`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => remove(item.id)}
                  className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-white/20 hover:text-[#EF4444]/60 hover:bg-[#EF4444]/8 transition-all"
                >
                  <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                </button>
              </div>
            ),
          )}
          {items.filter((i) => i.removed).map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.01] px-3.5 py-2.5 opacity-35"
            >
              <span className="w-3 h-3 shrink-0" />
              <p className="flex-1 text-sm text-white/30 line-through">{formatItemLabel(item)}</p>
              <button onClick={() => restore(item.id)} className="text-[10px] text-white/25 hover:text-white/50 transition-colors">
                Restore
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Cal",     value: totals.calories, unit: "",  color: "text-white/70"      },
          { label: "Protein", value: totals.protein,  unit: "g", color: "text-[#B48B40]/80" },
          { label: "Carbs",   value: totals.carbs,    unit: "g", color: "text-[#93C5FD]/70" },
          { label: "Fat",     value: totals.fat,      unit: "g", color: "text-emerald-400/60" },
        ].map(({ label, value, unit, color }) => (
          <div key={label} className="rounded-xl border border-white/6 bg-white/[0.02] px-2.5 py-2.5 text-center">
            <p className="text-[9px] uppercase tracking-[0.1em] text-white/25 mb-1">{label}</p>
            <p className={cn("text-sm font-semibold tabular-nums", color)}>
              {Math.round(value)}<span className="text-[10px] text-white/30 font-normal">{unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Confidence note */}
      {parseResult.confidence < 0.7 && (
        <p className="text-[11px] text-white/30 px-1 leading-relaxed">
          Portion estimates are approximate — edit or remove items before logging if needed.
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onReset}
          className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-white/35 hover:text-white/55 transition-all"
        >
          Start over
        </button>
        <button
          onClick={handleLog}
          disabled={activeItems.length === 0}
          className="flex-1 py-2.5 rounded-xl bg-[#B48B40]/15 border border-[#B48B40]/25 text-sm font-semibold text-[#B48B40] hover:bg-[#B48B40]/22 hover:border-[#B48B40]/35 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          Log meal
        </button>
      </div>
    </div>
  );
}

// ─── Photo tab ────────────────────────────────────────────────────────────────

function PhotoTab({
  userId,
  onMealLogged,
}: {
  userId:        string;
  onMealLogged?: (meal: LoggedMeal) => void;
}) {
  const inputRef   = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl]   = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [result,    setResult]    = useState<NutritionParseResult | null>(null);
  const [saved,     setSaved]     = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setResult(null);
    setError(null);
    setSaved(false);
    setAnalyzing(true);

    try {
      const { base64, mimeType } = await fileToBase64(file);
      const res = await fetch("/api/ai/nutrition", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mode: "analyze", imageBase64: base64, imageMimeType: mimeType }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data: NutritionParseResult = await res.json();
      setResult(data);
    } catch (err) {
      setError("Could not analyse this photo. Try uploading a clearer image or use voice logging instead.");
    } finally {
      setAnalyzing(false);
    }
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

  function reset() {
    setPhotoUrl(null);
    setResult(null);
    setError(null);
    setSaved(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleSaved(meal: LoggedMeal) {
    setSaved(true);
    onMealLogged?.(meal);
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
              <p className="text-sm font-medium text-white/55">Upload a food photo</p>
              <p className="text-xs text-white/28 mt-1">Meal · Menu · Groceries · Drag & drop or tap</p>
            </div>
          </div>
        </label>
      ) : (
        <div className="relative rounded-2xl overflow-hidden border border-white/8 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="Food photo" className="w-full object-cover max-h-52" />
          <button
            onClick={reset}
            className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          {analyzing && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-2.5">
              <Loader2 className="w-5 h-5 text-[#B48B40] animate-spin" strokeWidth={1.5} />
              <p className="text-xs text-white/60">Analysing with AI…</p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-[#EF4444]/15 bg-[#EF4444]/[0.04] px-4 py-3">
          <p className="text-sm text-[#EF4444]/70">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && !analyzing && !saved && (
        <ParsedResultPanel
          parseResult={result}
          rawTranscript={null}
          source="photo"
          userId={userId}
          onSaved={handleSaved}
          onReset={reset}
        />
      )}

      {/* Saved */}
      {saved && (
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] px-5 py-4 flex items-center gap-3">
          <Check className="w-4 h-4 text-emerald-400/70 shrink-0" strokeWidth={2} />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-400/80">Meal logged</p>
            <p className="text-xs text-white/35 mt-0.5">Added to today&apos;s timeline</p>
          </div>
          <button onClick={reset} className="text-xs text-white/28 hover:text-white/50 transition-colors">
            Log another
          </button>
        </div>
      )}

      {/* Idle helper */}
      {!photoUrl && (
        <p className="text-[11px] text-white/20 text-center px-4 leading-relaxed">
          Photos are sent to AI for analysis and are not stored.
        </p>
      )}
    </div>
  );
}

// ─── Voice tab ────────────────────────────────────────────────────────────────

function VoiceTab({
  userId,
  onMealLogged,
}: {
  userId:        string;
  onMealLogged?: (meal: LoggedMeal) => void;
}) {
  const [recording,      setRecording]     = useState(false);
  const [recordingTime,  setRecordingTime] = useState(0);
  const [transcript,     setTranscript]    = useState<string | null>(null);
  const [parsing,        setParsing]       = useState(false);
  const [error,          setError]         = useState<string | null>(null);
  const [result,         setResult]        = useState<NutritionParseResult | null>(null);
  const [saved,          setSaved]         = useState(false);

  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef  = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recognitionRef.current?.stop();
    };
  }, []);

  function startRecording() {
    setRecording(true);
    setTranscript(null);
    setResult(null);
    setError(null);
    setSaved(false);
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime((t) => {
        if (t >= 29) { stopRecording(); return t; }
        return t + 1;
      });
    }, 1000);

    // Use browser speech API if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = (typeof window !== "undefined")
      ? (w.SpeechRecognition || w.webkitSpeechRecognition)
      : null;

    if (SR) {
      const recognition = new SR();
      recognition.continuous      = false;
      recognition.interimResults  = false;
      recognition.lang            = "en-US";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (e: any) => {
        const text = Array.from(e.results)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((r: any) => r[0].transcript)
          .join(" ")
          .trim();
        if (text) setTranscript(text);
      };
      recognition.onend = () => {
        // transcript may or may not be set; parse if we have it
      };
      recognition.start();
      recognitionRef.current = recognition;
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    recognitionRef.current?.stop();
    setRecording(false);
  }

  async function handleParse() {
    if (!transcript?.trim()) {
      setError("No transcript captured. Try again and speak clearly.");
      return;
    }
    setParsing(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/nutrition", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mode: "parse", transcript }),
      });
      if (!res.ok) throw new Error("Parse failed");
      const data: NutritionParseResult = await res.json();
      setResult(data);
    } catch {
      setError("Could not parse the meal. Check your connection and try again.");
    } finally {
      setParsing(false);
    }
  }

  // Auto-parse when we have a transcript
  useEffect(() => {
    if (transcript && !recording && !result && !parsing) {
      handleParse();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, recording]);

  function reset() {
    setTranscript(null);
    setResult(null);
    setError(null);
    setSaved(false);
    setRecordingTime(0);
  }

  function handleSaved(meal: LoggedMeal) {
    setSaved(true);
    onMealLogged?.(meal);
  }

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      {/* Recorder */}
      {!result && !saved && (
        <div className="flex flex-col items-center gap-4 py-4">
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={parsing}
            className={cn(
              "relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300",
              recording
                ? "bg-[#EF4444]/15 border-2 border-[#EF4444]/50"
                : parsing
                  ? "bg-white/5 border-2 border-white/10 opacity-50 cursor-default"
                  : "bg-[#B48B40]/10 border-2 border-[#B48B40]/30 hover:bg-[#B48B40]/15 hover:border-[#B48B40]/50"
            )}
          >
            {recording && (
              <>
                <span className="absolute inset-0 rounded-full bg-[#EF4444]/10 animate-ping" />
                <span className="absolute inset-[-8px] rounded-full border border-[#EF4444]/15 animate-pulse" />
              </>
            )}
            {parsing ? (
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
                <p className="text-xs text-white/30">Tap to stop · auto-stops at 0:30</p>
              </div>
            ) : parsing ? (
              <p className="text-xs text-white/35">Analysing with AI…</p>
            ) : transcript ? (
              <button onClick={reset} className="text-xs text-white/25 hover:text-white/50 transition-colors">
                Record again
              </button>
            ) : (
              <div className="space-y-0.5">
                <p className="text-sm text-white/50">Tap to record your meal</p>
                <p className="text-xs text-white/25">e.g. "I had 3 eggs and 100g oats for breakfast"</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Waveform */}
      {recording && (
        <div className="flex items-center justify-center gap-0.5 h-8">
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-[#EF4444]/40"
              style={{
                height: `${20 + Math.sin(i * 0.8) * 16}%`,
                animation: "pulse 0.6s ease-in-out infinite alternate",
                animationDelay: `${i * 0.04}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Transcript */}
      {transcript && !result && !parsing && (
        <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/22 mb-1.5">You said</p>
          <p className="text-sm text-white/55 leading-relaxed italic">&ldquo;{transcript}&rdquo;</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-[#EF4444]/15 bg-[#EF4444]/[0.04] px-4 py-3">
          <p className="text-sm text-[#EF4444]/70">{error}</p>
          <button onClick={reset} className="text-xs text-white/35 hover:text-white/55 mt-1.5 transition-colors">
            Try again
          </button>
        </div>
      )}

      {/* Result */}
      {result && !saved && (
        <ParsedResultPanel
          parseResult={result}
          rawTranscript={transcript}
          source="voice"
          userId={userId}
          onSaved={handleSaved}
          onReset={reset}
        />
      )}

      {/* Saved */}
      {saved && (
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] px-5 py-4 flex items-center gap-3">
          <Check className="w-4 h-4 text-emerald-400/70 shrink-0" strokeWidth={2} />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-400/80">Meal logged</p>
            <p className="text-xs text-white/35 mt-0.5">Added to today&apos;s timeline</p>
          </div>
          <button onClick={reset} className="text-xs text-white/28 hover:text-white/50 transition-colors">
            Log another
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Camera tab (coming soon) ─────────────────────────────────────────────────

function CameraTab() {
  return (
    <div className="space-y-5">
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

      <div className="rounded-2xl border border-white/8 bg-[#0A0A0A] overflow-hidden">
        <div className="relative aspect-[4/3] bg-[#080808] flex items-center justify-center">
          {[
            "top-3 left-3 border-t-2 border-l-2 rounded-tl-lg w-8 h-8",
            "top-3 right-3 border-t-2 border-r-2 rounded-tr-lg w-8 h-8",
            "bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg w-8 h-8",
            "bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg w-8 h-8",
          ].map((cls) => (
            <div key={cls} className={cn("absolute border-white/20", cls)} />
          ))}
          <div className="relative w-[70%] aspect-square rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center">
            <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[38%] h-[36%] rounded-xl bg-[#B48B40]/18 border border-[#B48B40]/30 flex items-center justify-center">
              <p className="text-[9px] font-semibold text-[#B48B40]/80 uppercase tracking-[0.08em]">Protein</p>
            </div>
            <div className="absolute bottom-[18%] left-[15%] w-[30%] h-[26%] rounded-lg bg-[#93C5FD]/14 border border-[#93C5FD]/25 flex items-center justify-center">
              <p className="text-[9px] font-semibold text-[#93C5FD]/70 uppercase tracking-[0.08em]">Carbs</p>
            </div>
            <div className="absolute bottom-[22%] right-[12%] w-[18%] h-[16%] rounded-md bg-emerald-400/12 border border-emerald-400/22 flex items-center justify-center">
              <p className="text-[9px] font-semibold text-emerald-400/65 uppercase tracking-[0.08em]">Fat</p>
            </div>
          </div>
          <div className="absolute inset-x-3 h-px bg-gradient-to-r from-transparent via-[#B48B40]/30 to-transparent top-1/3 opacity-60" />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-white/8 bg-black/60 backdrop-blur-sm px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B48B40]/60 animate-pulse" />
            <p className="text-[10px] text-white/40">Analysing portions…</p>
          </div>
        </div>
      </div>

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

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({
  active, onClick, icon: Icon, label,
}: {
  active: boolean; onClick: () => void;
  icon: React.ElementType; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all",
        active
          ? "bg-[#B48B40]/12 text-[#B48B40] border border-[#B48B40]/20"
          : "text-white/35 hover:text-white/65 border border-transparent",
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AIFoodAnalysis({ open, onClose, userId, targets, onMealLogged }: Props) {
  const [tab, setTab] = useState<AnalysisTab>("photo");

  if (!open) return null;

  const calTarget  = targets?.calories  ?? null;
  const protTarget = targets?.proteinG  ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-lg bg-[#0D0D0D] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
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

          <div className="flex gap-1.5">
            <TabButton active={tab === "photo"}  onClick={() => setTab("photo")}  icon={Upload} label="Photo"  />
            <TabButton active={tab === "voice"}  onClick={() => setTab("voice")}  icon={Mic}    label="Voice"  />
            <TabButton active={tab === "camera"} onClick={() => setTab("camera")} icon={Camera} label="Camera" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5" style={{ scrollbarWidth: "none" }}>
          {tab === "photo"  && (
            <PhotoTab key="photo" userId={userId} onMealLogged={onMealLogged} />
          )}
          {tab === "voice"  && (
            <VoiceTab key="voice" userId={userId} onMealLogged={onMealLogged} />
          )}
          {tab === "camera" && <CameraTab key="camera" />}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.05] shrink-0">
          <p className="text-[10px] text-white/18 text-center">
            {calTarget && protTarget
              ? `Targets: ${protTarget}g protein · ${calTarget.toLocaleString()} kcal`
              : "Log meals to build your nutrition history"}
          </p>
        </div>
      </div>
    </div>
  );
}
