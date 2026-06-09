"use client";

// Daily check-in popup — for athletes on the "Daily nudge" cadence. On their
// first app-open of the day it pops a checklist of their commitments with an
// 8 PM deadline; they tick everything off. No phone push needed — it just
// appears in-app. Dismissed (or fully completed) → won't reappear that day.

import { useState, useEffect, useCallback } from "react";
import { X, Check, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";

type Task = { id: string; title: string; detail: string | null; done: boolean };
const todayKey = () => `flowstate-daily-checkin-${new Date().toISOString().slice(0, 10)}`;

export function DailyCheckInPopup() {
  const { user } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isRealUser = !!user?.id && /^[0-9a-f-]{36}$/i.test(user.id) && !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  useEffect(() => {
    if (!isRealUser) return;
    // Already handled today? Don't reopen.
    try { if (localStorage.getItem(todayKey()) === "done") return; } catch { /* ignore */ }
    let active = true;
    fetch("/api/me/tasks", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        if (j?.checkInCadence !== "daily") return;
        const all = Array.isArray(j?.tasks) ? (j.tasks as Task[]) : [];
        const openItems = all.filter((t) => !t.done);
        if (openItems.length > 0) { setTasks(all); setOpen(true); }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [isRealUser]);

  const remaining = tasks.filter((t) => !t.done).length;

  const dismiss = useCallback((markDone: boolean) => {
    setOpen(false);
    try { if (markDone) localStorage.setItem(todayKey(), "done"); } catch { /* ignore */ }
  }, []);

  async function check(id: string) {
    setBusyId(id);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: true } : t)));
    try {
      await fetch("/api/me/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, done: true }) });
    } catch { /* optimistic */ } finally { setBusyId(null); }
  }

  // Mark "seen" so the nav badge clears.
  useEffect(() => {
    if (open) fetch("/api/me/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "seen" }) }).catch(() => {});
  }, [open]);

  // Auto-close shortly after everything's ticked.
  useEffect(() => {
    if (open && tasks.length > 0 && remaining === 0) {
      const t = setTimeout(() => dismiss(true), 1400);
      return () => clearTimeout(t);
    }
  }, [open, remaining, tasks.length, dismiss]);

  if (!open) return null;
  const allDone = remaining === 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => dismiss(false)} />
      <div className="relative w-full sm:max-w-sm bg-[#111111] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white/90">Today&apos;s check-in</h2>
            <p className="text-[12px] text-white/45 mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={1.8} /> Get these done by 8 PM
            </p>
          </div>
          <button onClick={() => dismiss(false)} className="w-7 h-7 rounded-lg border border-white/8 bg-white/[0.03] flex items-center justify-center text-white/30 hover:text-white/65"><X className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
        </div>

        <div className="px-5 py-4 space-y-2 max-h-[55dvh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {allDone ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400/80" strokeWidth={1.8} />
              <p className="text-sm font-semibold text-white/85">All done for today 💪</p>
              <p className="text-[12px] text-white/40">Nice work — see you tomorrow.</p>
            </div>
          ) : tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => !t.done && check(t.id)}
              disabled={t.done || busyId === t.id}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all",
                t.done ? "border-emerald-400/20 bg-emerald-400/[0.05]" : "border-white/[0.08] bg-white/[0.02] hover:border-[#B48B40]/35",
              )}
            >
              <span className={cn("w-5 h-5 rounded-md border flex items-center justify-center shrink-0", t.done ? "border-emerald-400/50 bg-emerald-400/20" : "border-white/20")}>
                {t.done && <Check className="w-3 h-3 text-emerald-400" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-sm", t.done ? "text-white/40 line-through" : "text-white/85")}>{t.title}</span>
                {t.detail && !t.done && <span className="block text-[11px] text-white/35 mt-0.5">{t.detail}</span>}
              </span>
            </button>
          ))}
        </div>

        {!allDone && (
          <div className="px-5 pb-6 pt-2 flex items-center justify-between" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}>
            <span className="text-[12px] text-white/40">{remaining} left</span>
            <button onClick={() => dismiss(false)} className="text-[12px] text-white/45 hover:text-white/70">Later</button>
          </div>
        )}
      </div>
    </div>
  );
}
