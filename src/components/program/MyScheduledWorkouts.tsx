"use client";

// The client's scheduled workouts (set by their coach). They can move a workout
// to another day, but can't delete it. Today's is highlighted.

import { useState, useEffect, useCallback } from "react";
import { CalendarDays, Check, Circle, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

type Sched = { id: string; title: string; scheduled_date: string; status: string };
const todayISO = () => new Date().toISOString().slice(0, 10);

export function MyScheduledWorkouts() {
  const [items, setItems] = useState<Sched[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/me/scheduled-workouts", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setItems(Array.isArray(j?.scheduled) ? j.scheduled : []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function reschedule(id: string, scheduled_date: string) {
    setItems((p) => p.map((x) => (x.id === id ? { ...x, scheduled_date } : x)).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)));
    setEditing(null);
    const res = await fetch("/api/me/scheduled-workouts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, scheduled_date }) });
    if (!res.ok) load();
  }

  const upcoming = items.filter((i) => i.status !== "completed" && i.scheduled_date >= todayISO());
  if (!loaded || upcoming.length === 0) return null;

  const fmt = (d: string) => {
    const today = todayISO();
    if (d === today) return "Today";
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (d === tomorrow) return "Tomorrow";
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <div className="rounded-2xl border border-[#B48B40]/20 bg-[#B48B40]/[0.04] p-4">
      <p className="text-sm font-semibold text-white/85 flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Scheduled by your coach
      </p>
      <div className="space-y-1.5">
        {upcoming.map((s) => {
          const isToday = s.scheduled_date === todayISO();
          return (
            <div key={s.id} className={cn("rounded-xl border px-3 py-2.5", isToday ? "border-[#B48B40]/35 bg-[#B48B40]/[0.07]" : "border-white/[0.06] bg-black/15")}>
              <div className="flex items-center gap-2.5">
                <Circle className={cn("w-4 h-4 shrink-0", isToday ? "text-[#B48B40]" : "text-white/25")} strokeWidth={1.8} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white/85">{s.title}</p>
                  <p className={cn("text-[11px]", isToday ? "text-[#B48B40]" : "text-white/40")}>{fmt(s.scheduled_date)}</p>
                </div>
                <button onClick={() => setEditing(editing === s.id ? null : s.id)} className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-white/80 border border-white/10 rounded-lg px-2 py-1 shrink-0">
                  <CalendarClock className="w-3 h-3" strokeWidth={1.8} /> Move
                </button>
              </div>
              {editing === s.id && (
                <div className="flex items-center gap-2 mt-2 pl-6">
                  <input type="date" defaultValue={s.scheduled_date} min={todayISO()} onChange={(e) => { if (e.target.value) reschedule(s.id, e.target.value); }}
                    className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none [color-scheme:dark]" />
                  <span className="text-[10px] text-white/30">Pick a new day</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
