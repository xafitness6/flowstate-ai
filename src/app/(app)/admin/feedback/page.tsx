"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, Loader2, AlertCircle, Bug, Lightbulb, MessageSquare,
  Sparkles, Calendar, User as UserIcon, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { useAdminGuard } from "@/hooks/useAdminGuard";

type Report = {
  id:           string;
  user_email:   string | null;
  user_role:    string | null;
  category:     "bug" | "feature" | "feedback";
  severity:     "low" | "normal" | "high" | "critical";
  message:      string;
  page_url:     string | null;
  ai_diagnosis: string | null;
  status:       "open" | "in_progress" | "resolved" | "wontfix";
  created_at:   string;
};

const CATEGORY_ICON = { bug: Bug, feature: Lightbulb, feedback: MessageSquare } as const;
const SEVERITY_CLS = {
  low:      "text-white/55 border-white/12 bg-white/[0.03]",
  normal:   "text-white/75 border-white/15 bg-white/[0.04]",
  high:     "text-amber-300 border-amber-400/25 bg-amber-400/[0.06]",
  critical: "text-red-300 border-red-400/30 bg-red-400/[0.06]",
} as const;
const STATUS_CLS = {
  open:        "text-[#B48B40] border-[#B48B40]/30 bg-[#B48B40]/[0.06]",
  in_progress: "text-[#93C5FD] border-[#93C5FD]/25 bg-[#93C5FD]/[0.06]",
  resolved:    "text-emerald-300 border-emerald-400/25 bg-emerald-400/[0.06]",
  wontfix:     "text-white/45 border-white/12 bg-white/[0.03]",
} as const;
const NEXT_STATUS_LABELS: Record<Report["status"], { id: Report["status"]; label: string }[]> = {
  open:        [{ id: "in_progress", label: "Start" }, { id: "resolved", label: "Resolve" }, { id: "wontfix", label: "Won't fix" }],
  in_progress: [{ id: "resolved", label: "Resolve" }, { id: "wontfix", label: "Won't fix" }, { id: "open", label: "Reopen" }],
  resolved:    [{ id: "open", label: "Reopen" }],
  wontfix:     [{ id: "open", label: "Reopen" }],
};

export default function AdminFeedbackPage() {
  const adminReady = useAdminGuard();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<"all" | Report["status"]>("open");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/feedback", { cache: "no-store" });
      const data = await res.json() as { reports?: Report[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to load");
      setReports(data.reports ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (adminReady) void fetchAll(); }, [adminReady, fetchAll]);

  async function setStatus(id: string, status: Report["status"]) {
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    try {
      const res = await fetch(`/api/admin/feedback?id=${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Update failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      void fetchAll();
    }
  }

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);
  const openCount = reports.filter((r) => r.status === "open").length;

  if (!adminReady) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white">
        <div className="flex items-center gap-2 text-sm text-white/55">
          <Loader2 className="w-4 h-4 animate-spin" /> Opening inbox…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
      <div className="px-5 md:px-8 pt-6 max-w-4xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors mb-4"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
          Back to admin
        </Link>

        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/35 mb-2">Inbox</p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Feedback &amp; bugs</h1>
            <p className="text-xs text-white/45 mt-2">
              Every report submitted via the bug icon. Bug reports include an AI triage.
            </p>
          </div>
          {openCount > 0 && (
            <span className="text-xs text-[#B48B40] bg-[#B48B40]/[0.08] border border-[#B48B40]/25 rounded-full px-3 py-1.5">
              {openCount} open
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {(["all", "open", "in_progress", "resolved", "wontfix"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium border transition-all capitalize",
                filter === f
                  ? "border-[#B48B40]/40 bg-[#B48B40]/[0.08] text-[#B48B40]"
                  : "border-white/8 bg-white/[0.02] text-white/55 hover:border-white/15 hover:text-white/80",
              )}
            >
              {f.replace("_", " ")} {f !== "all" && `(${reports.filter((r) => r.status === f).length})`}
            </button>
          ))}
        </div>

        {error && (
          <Card className="mb-4 border-red-400/20">
            <div className="px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400/80 shrink-0 mt-0.5" strokeWidth={2} />
              <p className="text-xs text-red-300/85">{error}</p>
            </div>
          </Card>
        )}

        {loading && reports.length === 0 ? (
          <div className="py-12 flex items-center justify-center text-white/45">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="px-6 py-12 text-center text-white/35 text-sm">
              {filter === "all" ? "No reports yet." : `No ${filter.replace("_", " ")} reports.`}
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const Icon = CATEGORY_ICON[r.category] ?? MessageSquare;
              return (
                <Card key={r.id}>
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-white/45">
                        <Icon className="w-3 h-3 text-[#B48B40]/70" strokeWidth={2} />
                        {r.category}
                      </span>
                      {r.category === "bug" && (
                        <span className={cn(
                          "text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border",
                          SEVERITY_CLS[r.severity],
                        )}>
                          {r.severity}
                        </span>
                      )}
                      <span className={cn(
                        "text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border",
                        STATUS_CLS[r.status],
                      )}>
                        {r.status.replace("_", " ")}
                      </span>
                    </div>

                    <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap mb-3">{r.message}</p>

                    {r.ai_diagnosis && (
                      <div className="rounded-xl border border-[#B48B40]/20 bg-[#B48B40]/[0.04] px-3 py-2.5 mb-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Sparkles className="w-3 h-3 text-[#B48B40]" strokeWidth={2} />
                          <span className="text-[10px] uppercase tracking-[0.18em] text-[#B48B40]/85">AI triage</span>
                        </div>
                        <p className="text-[12px] text-white/75 leading-relaxed">{r.ai_diagnosis}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-white/40 mb-2">
                      {(r.user_email || r.user_role) && (
                        <span className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3" strokeWidth={1.7} />
                          {r.user_email ?? "anon"}{r.user_role ? ` · ${r.user_role}` : ""}
                        </span>
                      )}
                      {r.page_url && (
                        <a
                          href={r.page_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-white/80 transition-colors truncate max-w-xs"
                        >
                          <ExternalLink className="w-3 h-3" strokeWidth={1.7} />
                          <span className="truncate">{r.page_url.replace(/^https?:\/\//, "")}</span>
                        </a>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" strokeWidth={1.7} />
                        {new Date(r.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.05] mt-2">
                      {NEXT_STATUS_LABELS[r.status].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => void setStatus(r.id, opt.id)}
                          className="text-[11px] rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1 text-white/55 hover:text-white/85 hover:border-white/20 transition-colors"
                        >
                          {opt.label}
                        </button>
                      ))}
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
