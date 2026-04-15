"use client";

import { useState, useEffect, useRef } from "react";
import { X, Camera, Keyboard, Search, AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { barcodeService } from "@/lib/nutrition/barcodeService";
import { scaleMacros } from "@/lib/nutrition/foodSearch";
import { recordFoodUse } from "@/lib/nutrition/recentFoods";
import { saveMeal } from "@/lib/nutrition/store";
import type { FoodEntry } from "@/lib/nutrition/foodSearch";
import type { LoggedMeal, MealType } from "@/lib/nutrition/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  userId:       string;
  onMealLogged: (meal: LoggedMeal) => void;
  onClose:      () => void;
}

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch",     label: "Lunch"     },
  { value: "dinner",    label: "Dinner"    },
  { value: "snack",     label: "Snack"     },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function BarcodeScanner({ userId, onMealLogged, onClose }: Props) {
  const [mode,       setMode]       = useState<"camera" | "manual">("camera");
  const [manualCode, setManualCode] = useState("");
  const [scanning,   setScanning]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [cameraErr,  setCameraErr]  = useState(false);

  // Found food state
  const [foundFood, setFoundFood] = useState<FoodEntry | null>(null);
  const [notFound,  setNotFound]  = useState(false);
  const [qty,       setQty]       = useState("1");
  const [mealType,  setMealType]  = useState<MealType>("snack");

  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start camera stream when in camera mode
  useEffect(() => {
    if (mode !== "camera") return;
    let active = true;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => { if (active) setCameraErr(true); });

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [mode]);

  async function lookup(barcode: string) {
    if (!barcode.trim()) return;
    setScanning(true);
    setError(null);
    setNotFound(false);
    setFoundFood(null);
    try {
      const result = await barcodeService.lookup(barcode.trim());
      if (result.found && result.food) {
        setFoundFood(result.food);
        setQty("1");
      } else {
        setNotFound(true);
      }
    } catch {
      setError("Lookup failed — check your connection and try again.");
    } finally {
      setScanning(false);
    }
  }

  async function handleAdd() {
    if (!foundFood) return;
    const qtyNum = parseFloat(qty) || 1;
    const macros = scaleMacros(foundFood, qtyNum);
    const now    = new Date().toISOString();

    const meal = await saveMeal(userId, {
      userId,
      source:          "barcode",
      mealType,
      eatenAt:         now,
      rawTranscript:   null,
      cleanTranscript: foundFood.name,
      notes:           null,
      items: [{
        id:         `fi_${Date.now()}_0`,
        name:       foundFood.name,
        quantity:   qtyNum,
        unit:       foundFood.serving,
        grams:      Math.round(foundFood.servingGrams * qtyNum),
        calories:   macros.calories,
        protein:    macros.protein,
        carbs:      macros.carbs,
        fat:        macros.fat,
        confidence: 1,
        source:     "barcode",
        deletedAt:  null,
      }],
      totals:      macros,
      needsReview: false,
    });

    recordFoodUse(userId, foundFood);
    onMealLogged(meal);
    onClose();
  }

  function switchMode(next: "camera" | "manual") {
    setMode(next);
    setError(null);
    setNotFound(false);
    setFoundFood(null);
    setManualCode("");
  }

  const qtyNum  = parseFloat(qty) || 1;
  const preview = foundFood ? scaleMacros(foundFood, qtyNum) : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-[#0D0D0D] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-white/75">Barcode Scan</h2>
            <p className="text-[11px] text-white/28 mt-0.5">Scan product barcode to log food</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-white/[0.08] flex items-center justify-center text-white/30 hover:text-white/60 transition-all"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1.5 px-4 mb-3">
          {([
            { id: "camera", label: "Camera",      Icon: Camera   },
            { id: "manual", label: "Enter code",  Icon: Keyboard },
          ] as { id: "camera" | "manual"; label: string; Icon: typeof Camera }[]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => switchMode(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                mode === id
                  ? "bg-[#B48B40]/15 border border-[#B48B40]/30 text-[#B48B40]"
                  : "border border-white/[0.07] text-white/35 hover:text-white/60 hover:border-white/15",
              )}
            >
              <Icon className="w-3 h-3" strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>

        <div className="px-4 pb-5 space-y-3">
          {/* Camera view */}
          {mode === "camera" && (
            <div className="relative rounded-2xl overflow-hidden bg-black/60 aspect-[4/3]">
              {cameraErr ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
                  <div className="w-12 h-12 rounded-2xl border border-white/[0.07] bg-white/[0.03] flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white/25" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm text-white/40">Camera unavailable</p>
                  <button
                    onClick={() => switchMode("manual")}
                    className="text-xs text-[#B48B40]/70 hover:text-[#B48B40] transition-colors"
                  >
                    Enter barcode manually →
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                  {/* Scan overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-52 h-28 border-2 border-[#B48B40]/55 rounded-xl" />
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 py-2.5 text-center">
                    <p className="text-[11px] text-white/40">Align barcode within the frame</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Manual input */}
          {mode === "manual" && (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
                <Search className="w-4 h-4 text-white/25 shrink-0" strokeWidth={1.5} />
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookup(manualCode)}
                  placeholder="e.g. 0123456789012"
                  className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none"
                  autoFocus
                />
              </div>
              <button
                onClick={() => lookup(manualCode)}
                disabled={!manualCode.trim() || scanning}
                className="px-3 py-2 rounded-xl bg-[#B48B40]/12 border border-[#B48B40]/25 text-xs font-semibold text-[#B48B40]/80 hover:bg-[#B48B40]/20 disabled:opacity-40 transition-all"
              >
                {scanning ? (
                  <span className="w-3.5 h-3.5 border border-[#B48B40]/60 border-t-transparent rounded-full animate-spin block" />
                ) : "Lookup"}
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/5 px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 text-[#EF4444]/60 shrink-0" strokeWidth={1.5} />
              <p className="text-xs text-[#EF4444]/70">{error}</p>
            </div>
          )}

          {/* Not found */}
          {notFound && !foundFood && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-4 text-center space-y-1.5">
              <p className="text-sm text-white/45">Product not found</p>
              <p className="text-[11px] text-white/25">
                Barcode not in database — try searching by food name
              </p>
            </div>
          )}

          {/* Found food — serving + add */}
          {foundFood && (
            <div className="rounded-2xl border border-[#B48B40]/20 bg-[#B48B40]/[0.04] px-4 py-3 space-y-3">
              <div>
                <p className="text-sm font-semibold text-white/80">{foundFood.name}</p>
                {foundFood.brand && (
                  <p className="text-[11px] text-white/35">{foundFood.brand}</p>
                )}
              </div>

              {/* Qty */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-[0.12em] text-white/30 shrink-0 w-16">
                  Servings
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-20 bg-white/[0.04] border border-white/[0.09] rounded-lg px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-[#B48B40]/40 text-center tabular-nums"
                />
                <span className="text-xs text-white/30">× {foundFood.serving}</span>
              </div>

              {/* Macro preview */}
              {preview && (
                <div className="flex items-center gap-4 py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-center">
                    <p className="text-sm font-semibold tabular-nums text-white/80">{preview.calories}</p>
                    <p className="text-[9px] text-white/28 uppercase tracking-wide">kcal</p>
                  </div>
                  {([
                    { label: "P", value: preview.protein,  color: "text-[#B48B40]/80"  },
                    { label: "C", value: preview.carbs,    color: "text-white/55"       },
                    { label: "F", value: preview.fat,      color: "text-[#93C5FD]/70"  },
                  ] as { label: string; value: number; color: string }[]).map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <p className={cn("text-sm font-semibold tabular-nums", color)}>{value}g</p>
                      <p className="text-[9px] text-white/28 uppercase tracking-wide">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Meal type + Add */}
              <div className="flex items-center gap-2">
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="flex-1 bg-[#0D0D0D] border border-white/[0.09] rounded-xl px-3 py-2 text-sm text-white/70 outline-none"
                >
                  {MEAL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B48B40]/15 border border-[#B48B40]/30 text-sm font-semibold text-[#B48B40] hover:bg-[#B48B40]/22 transition-all"
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
