"use client";

// Coach view on the client file: assign accountability tasks (check-in items)
// and watch the client tick them off. Client sees them on their Accountability
// tab + profile + notifications.

import { useState, useEffect, useCallback } from "react";
import { ClipboardList, Loader2, Plus, Trash2, Check, Circle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

type Task = {
  id: string; title: string; detail: string | null; due_date: string | null;
  done: boolean; seen_at: string | null; assigned_by_name: string | null; created_at: string;
};

export function ClientTasksManager({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await fetch(`/api/clients/${clientId}/tasks`, { cache: "no-store" }).then((r) => r.json());
      setTasks(Array.isArray(j?.tasks) ? j.tasks : []);
    } catch { /* resilient */ }
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  async function assign() {
    if (saving || !title.trim()) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), detail: detail.trim() || undefined, due_date: due || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Couldn't assign.");
      setTasks((prev) => [j.task as Task, ...prev]);
      setTitle(""); setDetail(""); setDue("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't assign.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const prev = tasks;
    setTasks((t) => t.filter((x) => x.id !== id));
    const res = await fetch(`/api/clients/${clientId}/tasks?taskId=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) setTasks(prev);
  }

  const fmtDue = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <div className="no-print rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-6">
      <p className="text-sm font-semibold text-white/85 flex items-center gap-2 mb-1">
        <ClipboardList className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Accountability tasks
        <span className="text-[11px] font-normal text-white/30">· {clientName} sees these &amp; checks them off</span>
      </p>

      {/* Assign */}
      <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/15 p-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void assign(); }}
          placeholder="Task — e.g. weigh in 3x this week, hit 8k steps daily…"
          className="w-full bg-transparent text-sm text-white/90 placeholder:text-white/25 outline-none px-1"
        />
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Optional detail / instructions"
          className="w-full bg-transparent text-[12px] text-white/70 placeholder:text-white/20 outline-none px-1 mt-1.5"
        />
        <div className="flex items-center justify-between gap-2 mt-2">
          <input
            type="date" value={due} onChange={(e) => setDue(e.target.value)}
            className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none [color-scheme:dark]"
          />
          <button
            onClick={assign}
            disabled={!title.trim() || saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3.5 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />} Assign
          </button>
        </div>
        {err && <p className="text-xs text-red-300/80 mt-2">{err}</p>}
      </div>

      {/* List */}
      {tasks.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-white/30 px-1">{openCount} open · {tasks.length} total</p>
          {tasks.map((t) => (
            <div key={t.id} className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 group">
              {t.done
                ? <Check className="w-4 h-4 text-emerald-400/80 mt-0.5 shrink-0" strokeWidth={2.5} />
                : <Circle className="w-4 h-4 text-white/25 mt-0.5 shrink-0" strokeWidth={1.8} />}
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm leading-snug", t.done ? "text-white/35 line-through" : "text-white/85")}>{t.title}</p>
                {t.detail && <p className="text-[12px] text-white/45 mt-0.5">{t.detail}</p>}
                <p className="text-[10px] text-white/30 mt-1 flex items-center gap-1.5">
                  {t.done ? "Completed" : "Open"}{t.due_date ? ` · due ${fmtDue(t.due_date)}` : ""}
                  {t.seen_at && <span className="inline-flex items-center gap-0.5 text-white/25"><Eye className="w-2.5 h-2.5" strokeWidth={1.8} /> seen</span>}
                </p>
              </div>
              <button onClick={() => remove(t.id)} className="text-white/25 hover:text-red-300/80 opacity-0 group-hover:opacity-100 transition-all shrink-0" aria-label="Delete task">
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-white/30 px-1 mt-3">No tasks assigned yet.</p>
      )}
    </div>
  );
}
