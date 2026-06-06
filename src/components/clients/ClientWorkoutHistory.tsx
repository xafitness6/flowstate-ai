"use client";

// Recent logged sessions for the coach on the client file: date, sets, duration,
// difficulty, exercises, and any notes — pain/"felt off" feedback highlighted.

import { useState, useEffect } from "react";
import { Dumbbell, Loader2, AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Workout = {
  id: string; name: string; bodyFocus: string | null; notes: string | null; hasPain: boolean;
  completedAt: string; durationMins: number; sets: number; difficulty: number | null; exercises: string[];
};

export function ClientWorkoutHistory({ clientId }: { clientId: string }) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setLoaded(false);
    fetch(`/api/clients/${clientId}/workouts`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setWorkouts(Array.isArray(j?.workouts) ? j.workouts : []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [clientId]);

  if (!loaded) return <div className="flex items-center gap-2 text-white/40 text-xs py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading sessions…</div>;
  if (workouts.length === 0) return <p className="text-xs text-white/30 px-1 py-2">No logged sessions yet.</p>;

  const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="space-y-1.5">
      {workouts.map((w) => {
        const expanded = open === w.id;
        return (
          <div key={w.id} className={cn("rounded-xl border bg-white/[0.02]", w.hasPain ? "border-amber-400/25" : "border-white/[0.06]")}>
            <button onClick={() => setOpen(expanded ? null : w.id)} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left">
              <Dumbbell className={cn("w-4 h-4 shrink-0", w.hasPain ? "text-amber-300/80" : "text-white/35")} strokeWidth={1.8} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/85 truncate">{w.name}</p>
                <p className="text-[11px] text-white/40">{date(w.completedAt)} · {w.sets} sets · {w.durationMins} min{w.difficulty ? ` · RPE ${w.difficulty}` : ""}</p>
              </div>
              {w.hasPain && <AlertTriangle className="w-3.5 h-3.5 text-amber-300/80 shrink-0" strokeWidth={2} />}
              <ChevronDown className={cn("w-4 h-4 text-white/25 shrink-0 transition-transform", expanded && "rotate-180")} strokeWidth={1.8} />
            </button>
            {expanded && (
              <div className="px-3.5 pb-3 pt-0.5 border-t border-white/[0.05] space-y-2">
                {w.exercises.length > 0 && (
                  <p className="text-[12px] text-white/55 mt-2">{w.exercises.join(" · ")}</p>
                )}
                {w.notes && (
                  <div className={cn("rounded-lg px-3 py-2 text-[12px] leading-relaxed", w.hasPain ? "bg-amber-400/[0.06] text-amber-200/90 border border-amber-400/20" : "bg-white/[0.03] text-white/60")}>
                    {w.notes}
                  </div>
                )}
                {!w.notes && w.exercises.length === 0 && <p className="text-[11px] text-white/30 mt-2">No notes for this session.</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
