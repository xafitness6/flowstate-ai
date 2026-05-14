"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bug, X, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = "bug" | "feature" | "feedback";
type Severity = "low" | "normal" | "high" | "critical";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function BugReportButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("bug");
  const [severity, setSeverity] = useState<Severity>("normal");
  const [message,  setMessage]  = useState("");
  const [state,    setState]    = useState<SubmitState>("idle");
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit() {
    if (message.trim().length < 5) {
      setError("Tell us a bit more — at least 5 characters.");
      setState("error");
      return;
    }
    setState("submitting");
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          message:   message.trim(),
          category,
          severity,
          pageUrl:   typeof window !== "undefined" ? window.location.href : null,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Submit failed");
      setState("success");
      setMessage("");
      setTimeout(() => { setOpen(false); setState("idle"); }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
      setState("error");
    }
  }

  // Hide on login + invite + onboarding flows where chrome would be noise
  if (pathname && (pathname.startsWith("/login") || pathname.startsWith("/invite/") || pathname.startsWith("/auth/") || pathname.startsWith("/join"))) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Report a bug"
        className="fixed bottom-20 md:bottom-6 right-5 z-40 w-11 h-11 rounded-full bg-[#1A1A1A] border border-white/[0.08] shadow-lg shadow-black/40 flex items-center justify-center text-white/60 hover:text-[#B48B40] hover:border-[#B48B40]/40 transition-all backdrop-blur-md"
      >
        <Bug className="w-4 h-4" strokeWidth={1.8} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => state !== "submitting" && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/35 mb-0.5">Report</p>
                <h2 className="text-base font-semibold text-white/95 flex items-center gap-2">
                  <Bug className="w-4 h-4 text-[#B48B40]" strokeWidth={2} />
                  Send feedback
                </h2>
              </div>
              <button
                onClick={() => state !== "submitting" && setOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/[0.05] flex items-center justify-center transition-colors"
                disabled={state === "submitting"}
              >
                <X className="w-4 h-4 text-white/40" strokeWidth={2} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">Type</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { id: "bug",      label: "Bug" },
                    { id: "feature",  label: "Idea" },
                    { id: "feedback", label: "Other" },
                  ] as { id: Category; label: string }[]).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setCategory(opt.id)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-xs font-medium transition-all",
                        category === opt.id
                          ? "border-[#B48B40]/40 bg-[#B48B40]/[0.08] text-[#B48B40]"
                          : "border-white/8 bg-white/[0.02] text-white/55 hover:border-white/15 hover:text-white/80",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {category === "bug" && (
                <div>
                  <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">Severity</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([
                      { id: "low",      label: "Low",      cls: "text-white/55" },
                      { id: "normal",   label: "Normal",   cls: "text-white/80" },
                      { id: "high",     label: "High",     cls: "text-amber-300" },
                      { id: "critical", label: "Critical", cls: "text-red-300" },
                    ] as { id: Severity; label: string; cls: string }[]).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSeverity(opt.id)}
                        className={cn(
                          "rounded-xl border px-2 py-2 text-[11px] font-medium transition-all",
                          severity === opt.id
                            ? "border-[#B48B40]/40 bg-[#B48B40]/[0.08]"
                            : "border-white/8 bg-white/[0.02] hover:border-white/15",
                          severity === opt.id ? opt.cls : "text-white/45",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">
                  {category === "bug"     ? "What broke? Steps to reproduce help a lot."
                  : category === "feature" ? "What would you like to see added?"
                  :                          "Anything on your mind?"}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); if (state === "error") setState("idle"); }}
                  placeholder={category === "bug" ? "Tried to save my program and it just spun forever. Clicking Save & Activate on /program/builder after editing Week 2 → nothing happened, no error." : ""}
                  rows={5}
                  maxLength={4000}
                  className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/22 outline-none focus:border-[#B48B40]/40 transition-colors resize-none leading-relaxed"
                />
                <p className="text-[10px] text-white/25 mt-1 text-right tabular-nums">{message.length} / 4000</p>
              </div>

              <p className="text-[10px] text-white/30 leading-relaxed">
                We&apos;ll capture the page URL and your account info automatically{category === "bug" ? "; bug reports also get a quick AI triage to speed up the fix." : "."}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/[0.06] bg-white/[0.015]">
              {state === "error" && error && (
                <div className="flex items-center gap-1.5 text-[11px] text-red-300/80 mr-auto">
                  <AlertCircle className="w-3.5 h-3.5" strokeWidth={2} />
                  {error}
                </div>
              )}
              {state === "success" && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-300/85 mr-auto">
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
                  Sent — thanks.
                </div>
              )}
              <button
                onClick={() => state !== "submitting" && setOpen(false)}
                disabled={state === "submitting"}
                className="rounded-xl px-3 py-2 text-sm text-white/55 hover:text-white/85 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={state === "submitting" || state === "success" || message.trim().length < 5}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition-all flex items-center gap-2",
                  state === "submitting"
                    ? "bg-white/5 text-white/45 cursor-wait"
                    : state === "success"
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/25"
                      : "bg-[#B48B40] text-black hover:bg-[#c99840] disabled:bg-white/5 disabled:text-white/25",
                )}
              >
                {state === "submitting" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {state === "submitting" ? "Sending…" : state === "success" ? "Sent" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
