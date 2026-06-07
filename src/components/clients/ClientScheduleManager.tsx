"use client";

// Coach view: schedule workouts on calendar days for a client. The client sees
// them on their side and can reschedule (move) but not delete.

import { useState, useEffect, useCallback } from "react";
import { CalendarDays, Loader2, Plus, Trash2, Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type Sched = { id: string; title: string; scheduled_date: string; status: string };

function todayISO() { return new Date().toISOString().slice(0, 10); }

export function ClientScheduleManager({ clientId, clientName, suggestions = [] }: { clientId: string; clientName: string; suggestions?: string[] }) {
  const [items, setItems] = useState<Sched[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await fetch(`/api/clients/${clientId}/scheduled-workouts`, { cache: "no-store" }).then((r) => r.json());
      setItems(Array.isArray(j?.scheduled) ? j.scheduled : []);
    } catch { /* resilient */ }
  }, [clientId]);
  useEffect(() => { void load(); }, [load]);

  async function add() {
    if (saving || !title.trim()) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/scheduled-workouts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), scheduled_date: date }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Couldn't schedule.");
      setItems((p) => [...p, j.workout].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)));
      setTitle("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't schedule."); } finally { setSaving(false); }
  }

  async function remove(id: string) {
    const prev = items;
    setItems((p) => p.filter((x) => x.id !== id));
    const res = await fetch(`/api/clients/${clientId}/scheduled-workouts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) setItems(prev);
  }

  const upcoming = items.filter((i) => i.scheduled_date >= todayISO() || i.status === "scheduled");
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="no-print rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mt-6">
      <p className="text-sm font-semibold text-white/85 flex items-center gap-2 mb-1">
        <CalendarDays className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Schedule workouts
        <span className="text-[11px] font-normal text-white/30">· {clientName} can move these, not delete</span>
      </p>

      <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/15 p-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
          placeholder="Workout — e.g. Push Day, Lower Body, Conditioning…"
          className="w-full bg-transparent text-sm text-white/90 placeholder:text-white/25 outline-none px-1"
        />
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => setTitle(s)} className="text-[11px] rounded-lg border border-white/10 px-2 py-1 text-white/50 hover:text-white/85 hover:border-white/20">{s}</button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 mt-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none [color-scheme:dark]" />
          <button onClick={add} disabled={!title.trim() || saving} className="inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3.5 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />} Schedule
          </button>
        </div>
        {err && <p className="text-xs text-red-300/80 mt-2">{err}</p>}
      </div>

      {upcoming.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {upcoming.map((s) => (
            <div key={s.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 group">
              {s.status === "completed"
                ? <Check className="w-4 h-4 text-emerald-400/80 shrink-0" strokeWidth={2.5} />
                : <Circle className="w-4 h-4 text-white/25 shrink-0" strokeWidth={1.8} />}
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", s.status === "completed" ? "text-white/40 line-through" : "text-white/85")}>{s.title}</p>
                <p className="text-[10px] text-white/35">{fmt(s.scheduled_date)}{s.status === "completed" ? " · done" : ""}</p>
              </div>
              <button onClick={() => remove(s.id)} className="text-white/25 hover:text-red-300/80 opacity-0 group-hover:opacity-100 transition-all shrink-0" aria-label="Remove"><Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} /></button>
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-white/30 px-1 mt-3">Nothing scheduled yet.</p>}
    </div>
  );
}
