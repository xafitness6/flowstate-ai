"use client";

// The client's coach-assigned checklist (accountability tasks). Self-fetching;
// renders nothing if there are none. Used on the Accountability tab + Profile.

import { useState, useEffect, useCallback } from "react";
import { Check, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

type Task = {
  id: string; title: string; detail: string | null; due_date: string | null;
  done: boolean; assigned_by_name: string | null; created_at: string;
};

export function CoachTaskList({ title = "From your coach" }: { title?: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    fetch("/api/me/tasks", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setTasks(Array.isArray(j?.tasks) ? j.tasks : []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggle(t: Task) {
    const done = !t.done;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done } : x)));
    fetch("/api/me/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, done }) })
      .then((r) => { if (!r.ok) load(); })
      .catch(() => load());
  }

  if (!loaded || tasks.length === 0) return null;

  const open = tasks.filter((t) => !t.done);
  const fmtDue = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="rounded-2xl border border-[#B48B40]/20 bg-[#B48B40]/[0.04] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-white/85 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> {title}
        </p>
        <span className="text-[11px] text-white/45 tabular-nums">{open.length} to do</span>
      </div>
      <div className="space-y-1.5">
        {tasks.map((t) => (
          <div key={t.id} className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5">
            <button
              onClick={() => toggle(t)}
              aria-label={t.done ? "Mark not done" : "Mark done"}
              className={cn(
                "mt-0.5 shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                t.done ? "bg-[#B48B40] border-[#B48B40] text-black" : "border-white/25 hover:border-[#B48B40]/60",
              )}
            >
              {t.done && <Check className="w-3 h-3" strokeWidth={3} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm leading-snug", t.done ? "text-white/35 line-through" : "text-white/85")}>{t.title}</p>
              {t.detail && <p className="text-[12px] text-white/45 mt-0.5 leading-relaxed">{t.detail}</p>}
              <p className="text-[10px] text-white/30 mt-1">
                {t.assigned_by_name ? `From ${t.assigned_by_name}` : "From your coach"}
                {t.due_date ? ` · due ${fmtDue(t.due_date)}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
