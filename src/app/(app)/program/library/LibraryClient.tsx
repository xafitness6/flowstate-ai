"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Library as LibraryIcon, CheckCircle2, Copy, Trash2,
  Plus, Loader2, Dumbbell, Calendar, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { Card } from "@/components/ui/Card";
import {
  listUserPrograms, setProgramActive, duplicateProgram, deleteProgram,
} from "@/lib/db/programs";
import type { Program } from "@/lib/supabase/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GOAL_LABEL: Record<string, string> = {
  muscle_gain: "Hypertrophy",
  hypertrophy: "Hypertrophy",
  fat_loss:    "Fat Loss",
  strength:    "Strength",
  endurance:   "Endurance",
  recomp:      "Body Recomp",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return "—"; }
}

function statusPill(status: Program["status"]) {
  if (status === "active") return { label: "Active", cls: "text-[#B48B40] border-[#B48B40]/40 bg-[#B48B40]/10" };
  if (status === "completed") return { label: "Completed", cls: "text-emerald-400 border-emerald-400/25 bg-emerald-400/8" };
  return { label: "Template", cls: "text-white/50 border-white/12 bg-white/[0.03]" };
}

const CACHE_KEY = (uid: string) => `flowstate-library-cache-${uid}`;

function readCache(userId: string): Program[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY(userId));
    return raw ? JSON.parse(raw) as Program[] : null;
  } catch { return null; }
}

function writeCache(userId: string, rows: Program[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CACHE_KEY(userId), JSON.stringify(rows)); } catch { /* ignore */ }
}

export default function LibraryClient({ initialPrograms }: { initialPrograms: Program[] | null }) {
  const router = useRouter();
  const { user, isLoading } = useUser();

  // initialPrograms === null  → SSR couldn't fetch (demo user / unauthenticated). Client fetches.
  // initialPrograms === []    → SSR fetched and found none. Render empty.
  const [programs, setPrograms] = useState<Program[]>(initialPrograms ?? []);
  const [loading,  setLoading]  = useState(false);
  const [busyId,   setBusyId]   = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const canPersist = !!user?.id && UUID_RE.test(user.id);
  const hasSSRData = initialPrograms !== null;

  useEffect(() => {
    if (isLoading) return;
    if (!user?.id) return;

    // SSR delivered the data — just sync to cache for next visit and bail.
    if (hasSSRData) {
      if (canPersist && initialPrograms) writeCache(user.id, initialPrograms);
      return;
    }

    let cancelled = false;

    // No SSR (demo user) — fall back to cache + client fetch.
    if (canPersist) {
      const cached = readCache(user.id);
      if (cached && cached.length > 0) setPrograms(cached);
      else setLoading(true);
    }

    (async () => {
      if (!canPersist) {
        setPrograms([]);
        setError("Library only loads for real signed-in users. Demo accounts have no saved templates.");
        return;
      }
      try {
        const rows = await listUserPrograms(user.id);
        if (!cancelled) {
          setPrograms(rows);
          writeCache(user.id, rows);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load programs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, isLoading, canPersist, hasSSRData, initialPrograms]);

  async function handleSetActive(p: Program) {
    if (!user?.id || p.status === "active") return;
    setBusyId(p.id);
    try {
      const ok = await setProgramActive(user.id, p.id);
      if (!ok) throw new Error("Activation failed");
      setPrograms((prev) => prev.map((it) =>
        it.id === p.id ? { ...it, status: "active" as const, start_date: new Date().toISOString().split("T")[0] }
        : it.status === "active" ? { ...it, status: "archived" as const }
        : it,
      ));
      setTimeout(() => router.push("/program"), 350);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDuplicate(p: Program) {
    if (!user?.id) return;
    setBusyId(p.id);
    try {
      const copy = await duplicateProgram(user.id, p.id);
      if (!copy) throw new Error("Duplicate failed");
      setPrograms((prev) => [copy, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duplicate failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(p: Program) {
    if (!user?.id) return;
    if (p.status === "active") {
      setError("Cannot delete an active program. Activate something else first.");
      return;
    }
    if (!confirm(`Delete "${p.block_name}" permanently?`)) return;
    setBusyId(p.id);
    try {
      const ok = await deleteProgram(user.id, p.id);
      if (!ok) throw new Error("Delete failed");
      setPrograms((prev) => prev.filter((it) => it.id !== p.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
      <div className="px-5 md:px-8 pt-6 max-w-3xl mx-auto">
        <Link
          href="/program"
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-4"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
          Back to program
        </Link>

        <div className="flex items-start justify-between mb-6 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-1.5">Library</p>
            <h1 className="text-2xl font-bold tracking-tight">My Programs</h1>
            <p className="text-xs text-white/40 mt-1.5">
              Every program you&apos;ve built or generated, ready to activate or fork.
            </p>
          </div>
          <Link
            href="/program/builder"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3 py-2 text-xs font-semibold hover:bg-[#c99840] transition-all"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            New
          </Link>
        </div>

        {error && (
          <Card className="mb-4 border-amber-400/20">
            <p className="px-4 py-3 text-xs text-amber-300/80">{error}</p>
          </Card>
        )}

        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin" />
            <p className="text-sm">Loading your library…</p>
          </div>
        ) : programs.length === 0 ? (
          <Card>
            <div className="px-6 py-12 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
                <LibraryIcon className="w-6 h-6 text-white/25" strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white/75">No programs yet</p>
                <p className="text-xs text-white/40">Generate one or build it from scratch.</p>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/program/generate"
                  className="rounded-xl bg-[#B48B40] text-black px-4 py-2 text-xs font-semibold flex items-center gap-1.5 hover:bg-[#c99840]"
                >
                  <Zap className="w-3.5 h-3.5" strokeWidth={2.5} /> Generate
                </Link>
                <Link
                  href="/program/builder"
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/65 flex items-center gap-1.5 hover:border-white/20 hover:text-white/85"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Build
                </Link>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {programs.map((p) => {
              const pill = statusPill(p.status);
              const goal = GOAL_LABEL[p.goal] ?? p.goal;
              const sessions = Array.isArray(p.weekly_split) ? (p.weekly_split as unknown as unknown[]).length : 0;
              const isBusy = busyId === p.id;
              return (
                <Card key={p.id}>
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="text-base font-semibold text-white/90 truncate">{p.block_name}</h2>
                          <span className={cn(
                            "text-[10px] uppercase tracking-[0.15em] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap",
                            pill.cls,
                          )}>
                            {pill.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/45">
                          {goal} · {p.duration_weeks}w · {p.weekly_training_days}/wk · {sessions} session{sessions === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-white/35 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" strokeWidth={1.5} />
                        Created {fmtDate(p.created_at)}
                      </span>
                      {p.start_date && p.status === "active" && (
                        <span className="flex items-center gap-1">
                          <Dumbbell className="w-3 h-3" strokeWidth={1.5} />
                          Started {fmtDate(p.start_date)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {p.status === "active" ? (
                        <Link
                          href="/program"
                          className="rounded-xl bg-[#B48B40] text-black px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#c99840]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />
                          Open
                        </Link>
                      ) : (
                        <button
                          onClick={() => void handleSetActive(p)}
                          disabled={isBusy}
                          className="rounded-xl bg-[#B48B40] text-black px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#c99840] disabled:opacity-50 disabled:cursor-wait"
                        >
                          {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />}
                          Set as active
                        </button>
                      )}
                      <button
                        onClick={() => void handleDuplicate(p)}
                        disabled={isBusy}
                        className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-white/65 inline-flex items-center gap-1.5 hover:border-white/20 hover:text-white/85 disabled:opacity-40"
                      >
                        <Copy className="w-3.5 h-3.5" strokeWidth={1.7} />
                        Duplicate
                      </button>
                      {p.status !== "active" && (
                        <button
                          onClick={() => void handleDelete(p)}
                          disabled={isBusy}
                          className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-white/45 inline-flex items-center gap-1.5 hover:border-red-400/30 hover:text-red-300/80 disabled:opacity-40 ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
