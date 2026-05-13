"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Search, Loader2, Dumbbell, Plus, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchExercises, type Exercise } from "@/lib/db/exercises";

const EQUIPMENT_OPTIONS = [
  "barbell", "dumbbell", "cable", "machine", "kettlebells",
  "body only", "bands", "medicine ball", "exercise ball", "e-z curl bar", "foam roll", "other",
];

const MUSCLE_OPTIONS = [
  "chest", "shoulders", "triceps", "biceps", "forearms",
  "lats", "middle back", "lower back", "traps", "neck",
  "quadriceps", "hamstrings", "glutes", "calves", "abductors", "adductors",
  "abdominals",
];

const SAFE_FOR_OPTIONS = [
  { id: "knee",             label: "Knee" },
  { id: "lower_back",       label: "Lower back" },
  { id: "shoulder",         label: "Shoulder" },
  { id: "foot",             label: "Foot" },
  { id: "ankle",            label: "Ankle" },
  { id: "hip",              label: "Hip" },
  { id: "mobility_limited", label: "Mobility-limited" },
];

const JOINT_OPTIONS: Array<{ id: "low" | "moderate" | "high"; label: string }> = [
  { id: "low",      label: "Low" },
  { id: "moderate", label: "Moderate" },
  { id: "high",     label: "High" },
];

export function ExercisePickerDrawer({
  open, onClose, onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (ex: Exercise) => void;
}) {
  const [query,     setQuery]     = useState("");
  const [muscle,    setMuscle]    = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [safeFor,   setSafeFor]   = useState<string | null>(null);
  const [maxJoint,  setMaxJoint]  = useState<"low" | "moderate" | "high" | null>(null);
  const [results,   setResults]   = useState<Exercise[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const handle = setTimeout(async () => {
      try {
        const rows = await searchExercises({
          query:     query || undefined,
          muscle:    muscle ?? undefined,
          equipment: equipment ?? undefined,
          safeFor:   safeFor ?? undefined,
          maxJoint:  maxJoint ?? undefined,
          limit:     80,
        });
        if (cancelled) return;
        setResults(rows);
        if (rows.length === 0) setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [open, query, muscle, equipment, safeFor, maxJoint]);

  const activeFilters = useMemo(() => {
    return [muscle, equipment, safeFor, maxJoint].filter(Boolean).length;
  }, [muscle, equipment, safeFor, maxJoint]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-stretch justify-end" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-[#0E0E0E] border-l border-white/[0.06] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/35 mb-0.5">Exercise library</p>
            <h2 className="text-base font-semibold text-white/95">Pick an exercise</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.05] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white/40" strokeWidth={2} />
          </button>
        </div>

        {/* Search + filters */}
        <div className="px-5 py-4 border-b border-white/[0.06] space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" strokeWidth={2} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 800+ exercises (name, technique, muscle)"
              className="w-full bg-white/[0.03] border border-white/8 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 transition-colors"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <FilterSelect
              label="Muscle"
              value={muscle}
              onChange={setMuscle}
              options={MUSCLE_OPTIONS.map((m) => ({ id: m, label: m }))}
            />
            <FilterSelect
              label="Equipment"
              value={equipment}
              onChange={setEquipment}
              options={EQUIPMENT_OPTIONS.map((m) => ({ id: m, label: m }))}
            />
            <FilterSelect
              label="Safe for"
              value={safeFor}
              onChange={setSafeFor}
              options={SAFE_FOR_OPTIONS}
              icon={Shield}
            />
            <FilterSelect
              label="Max joint load"
              value={maxJoint}
              onChange={(v) => setMaxJoint(v as "low" | "moderate" | "high" | null)}
              options={JOINT_OPTIONS}
            />
          </div>

          {activeFilters > 0 && (
            <button
              onClick={() => { setMuscle(null); setEquipment(null); setSafeFor(null); setMaxJoint(null); }}
              className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
            >
              Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="py-8 flex items-center justify-center text-white/40">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Searching…
            </div>
          ) : error ? (
            <p className="text-xs text-red-400/75 text-center py-6">{error}</p>
          ) : results.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center text-white/35">
              <Dumbbell className="w-8 h-8 text-white/15" strokeWidth={1.5} />
              <p className="text-sm">No exercises match.</p>
              <p className="text-[11px] text-white/25 max-w-xs">
                Did you run <span className="font-mono text-white/40">npm run exercises:import</span> after applying the migration?
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {results.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => { onSelect(ex); onClose(); }}
                  className="w-full text-left rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04] transition-all group px-3 py-2.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#B48B40]/8 border border-[#B48B40]/15 flex items-center justify-center shrink-0 overflow-hidden">
                      {ex.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ex.images[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Dumbbell className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white/90 leading-snug truncate">{ex.name}</p>
                      <p className="text-[11px] text-white/40 mt-0.5 truncate">
                        {ex.primary_muscles.join(", ") || "—"}
                        {ex.equipment ? ` · ${ex.equipment}` : ""}
                        {ex.level ? ` · ${ex.level}` : ""}
                      </p>
                      {ex.injury_friendly_for.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {ex.injury_friendly_for.slice(0, 4).map((tag) => (
                            <span key={tag} className="text-[9px] uppercase tracking-[0.1em] text-emerald-300/70 border border-emerald-400/15 bg-emerald-400/5 px-1.5 py-0.5 rounded">
                              {tag}-safe
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Plus className="w-4 h-4 text-white/20 group-hover:text-[#B48B40] transition-colors shrink-0 mt-1" strokeWidth={2} />
                  </div>
                </button>
              ))}
              <p className="text-[10px] text-white/20 text-center pt-3">
                Showing {results.length} {results.length === 80 ? "(top 80 — refine filters)" : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect<T extends string>({
  label, value, onChange, options, icon: Icon,
}: {
  label:   string;
  value:   string | null;
  onChange: (v: T | null) => void;
  options: Array<{ id: T; label: string }>;
  icon?:   typeof Shield;
}) {
  return (
    <div className="relative">
      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || null) as T | null)}
        className={cn(
          "w-full appearance-none rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-white/80 outline-none focus:border-[#B48B40]/40 transition-colors capitalize",
          Icon && "pl-7",
        )}
      >
        <option value="" className="bg-[#1A1A1A] text-white/50">{label} — any</option>
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-[#1A1A1A] text-white capitalize">{o.label}</option>
        ))}
      </select>
      {Icon && (
        <Icon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" strokeWidth={2} />
      )}
    </div>
  );
}
