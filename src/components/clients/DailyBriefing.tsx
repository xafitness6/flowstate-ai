"use client";

// Trainer daily briefing: yesterday's activity across all assigned clients, so
// a coach can scan the roster in a couple minutes. Sorted most-needs-attention
// first. Shown at the top of My Clients.

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sun, Dumbbell, Apple, ClipboardCheck, Scale, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type NutritionStatus = "none" | "under" | "on" | "over" | "logged";
type Row = {
  id: string; name: string; active: boolean; sessions: number; workoutNames: string[]; missedWorkout: boolean;
  nutrition: { status: NutritionStatus; calories: number; protein: number; calTarget: number | null; meals: number };
  tasksDoneYesterday: number; tasksOpen: number; tasksOverdue: number; weighedIn: boolean; attention: number;
};
type Digest = { date: string | null; totals?: { clients: number; trained: number; loggedMeals: number; active: number; tasksCompleted: number }; clients: Row[] };

const NUTR: Record<NutritionStatus, { label: string; cls: string }> = {
  on:     { label: "On target",  cls: "text-emerald-300 border-emerald-400/25 bg-emerald-400/[0.07]" },
  under:  { label: "Under",      cls: "text-amber-300 border-amber-400/25 bg-amber-400/[0.06]" },
  over:   { label: "Over",       cls: "text-orange-300 border-orange-400/25 bg-orange-400/[0.06]" },
  logged: { label: "Logged",     cls: "text-white/60 border-white/12 bg-white/[0.03]" },
  none:   { label: "No food log", cls: "text-red-300/80 border-red-400/20 bg-red-400/[0.05]" },
};

function Chip({ label, cls }: { label: string; cls: string }) {
  return <span className={cn("text-[10px] font-semibold rounded-md border px-1.5 py-0.5 whitespace-nowrap", cls)}>{label}</span>;
}

export function DailyBriefing() {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    fetch("/api/trainer/digest", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setDigest(j as Digest))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 flex items-center gap-2 text-white/40 text-sm">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading yesterday&apos;s briefing…
    </div>
  );
  if (!digest || !digest.clients || digest.clients.length === 0) return null;

  const t = digest.totals;
  const dateLabel = digest.date ? new Date(digest.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) : "Yesterday";

  return (
    <div className="rounded-2xl border border-[#B48B40]/20 bg-[#B48B40]/[0.04] overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/90 flex items-center gap-2">
            <Sun className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Daily briefing
            <span className="text-[11px] font-normal text-white/40">· {dateLabel}</span>
          </p>
          {t && (
            <p className="text-[12px] text-white/50 mt-1">
              {t.trained}/{t.clients} trained · {t.loggedMeals}/{t.clients} logged meals · {t.active}/{t.clients} opened the app · {t.tasksCompleted} tasks done
            </p>
          )}
        </div>
        <ChevronDown className={cn("w-4 h-4 text-white/35 shrink-0 transition-transform", open && "rotate-180")} strokeWidth={1.8} />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {digest.clients.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="block rounded-xl border border-white/[0.06] bg-black/15 hover:border-white/15 px-3.5 py-3 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.active ? "bg-emerald-400" : "bg-white/20")} />
                  <span className="text-sm font-semibold text-white/85 truncate">{c.name}</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-white/25 shrink-0" strokeWidth={2} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {/* Training */}
                {c.sessions > 0
                  ? <Chip label={`Trained${c.workoutNames[0] ? `: ${c.workoutNames[0]}` : ""}`} cls="text-emerald-300 border-emerald-400/25 bg-emerald-400/[0.07]" />
                  : c.missedWorkout
                    ? <Chip label="No session" cls="text-red-300/80 border-red-400/20 bg-red-400/[0.05]" />
                    : <Chip label="Rest / no session" cls="text-white/45 border-white/12 bg-white/[0.03]" />}
                {/* Nutrition */}
                <Chip label={c.nutrition.status === "none" ? "No food log" : `${NUTR[c.nutrition.status].label}${c.nutrition.calTarget ? ` · ${c.nutrition.calories}/${c.nutrition.calTarget}` : ` · ${c.nutrition.calories} kcal`}`} cls={NUTR[c.nutrition.status].cls} />
                {/* Tasks */}
                {(c.tasksDoneYesterday > 0 || c.tasksOpen > 0) && (
                  <Chip
                    label={`${c.tasksDoneYesterday} done${c.tasksOverdue > 0 ? ` · ${c.tasksOverdue} overdue` : c.tasksOpen > 0 ? ` · ${c.tasksOpen} open` : ""}`}
                    cls={c.tasksOverdue > 0 ? "text-amber-300 border-amber-400/25 bg-amber-400/[0.06]" : "text-white/60 border-white/12 bg-white/[0.03]"}
                  />
                )}
                {/* Weigh-in */}
                {c.weighedIn && <Chip label="Weighed in" cls="text-[#B48B40] border-[#B48B40]/25 bg-[#B48B40]/[0.08]" />}
                {!c.active && <Chip label="Didn't open app" cls="text-white/40 border-white/10 bg-white/[0.02]" />}
              </div>
            </Link>
          ))}
          <p className="text-[10px] text-white/25 px-1 pt-1 flex items-center gap-3">
            <span className="flex items-center gap-1"><Dumbbell className="w-3 h-3" /> training</span>
            <span className="flex items-center gap-1"><Apple className="w-3 h-3" /> nutrition</span>
            <span className="flex items-center gap-1"><ClipboardCheck className="w-3 h-3" /> tasks</span>
            <span className="flex items-center gap-1"><Scale className="w-3 h-3" /> weigh-in</span>
          </p>
        </div>
      )}
    </div>
  );
}
