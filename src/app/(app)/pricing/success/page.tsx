"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Zap, ArrowRight, Loader2 } from "lucide-react";
import { PLAN_LABELS } from "@/lib/plans";
import type { Plan } from "@/types";

// ─── Inner component (uses useSearchParams) ───────────────────────────────────

function SuccessInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const sessionId = searchParams.get("session_id");
  const demo      = searchParams.get("demo") === "true";
  const planParam = searchParams.get("plan") as Plan | null;

  const [ready, setReady] = useState(false);
  const [plan,  setPlan]  = useState<Plan | null>(planParam);

  useEffect(() => {
    if (!sessionId && !demo) {
      // No session_id and not demo — nothing to show
      router.replace("/pricing");
      return;
    }

    if (demo && planParam) {
      setPlan(planParam);
      setReady(true);
      return;
    }

    // Real Stripe checkout: the webhook has already updated the DB asynchronously.
    // We show confirmation immediately — AppShell will re-read the profile when
    // the user navigates to /dashboard and picks up the new subscription_status.
    // Brief delay feels better UX-wise (avoids instant flash).
    const t = setTimeout(() => setReady(true), 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planName = plan ? (PLAN_LABELS[plan] ?? plan) : null;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/30">
          <Loader2 className="w-4 h-4 text-[#B48B40] animate-spin" strokeWidth={2} />
          <span className="text-sm">Activating your plan…</span>
        </div>
      </div>
    );
  }

  // ── Confirmation ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 text-white">
      <div className="max-w-sm w-full space-y-8">

        {/* Icon + header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-[#B48B40]/12 border border-[#B48B40]/25 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-[#B48B40]" strokeWidth={1.5} />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white mb-2">You&apos;re all set</h1>
            {planName ? (
              <p className="text-sm text-white/45">
                Your{" "}
                <span className="text-[#B48B40] font-medium">{planName}</span>{" "}
                plan is now active.
              </p>
            ) : (
              <p className="text-sm text-white/45">Your subscription is now active.</p>
            )}
          </div>
        </div>

        {/* What's unlocked */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111111] p-5 space-y-3">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#B48B40]/10 border border-[#B48B40]/20 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2} />
            </div>
            <p className="text-sm font-semibold text-white/80">Full access unlocked</p>
          </div>
          {[
            "Adaptive AI programming",
            "Unlimited workout & nutrition history",
            "Weekly performance reviews",
            "Accountability tools & streaks",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#B48B40]/50 shrink-0" />
              <p className="text-sm text-white/55">{item}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => router.replace("/dashboard")}
          className="w-full rounded-2xl py-4 bg-[#B48B40] text-black text-sm font-semibold tracking-wide flex items-center justify-center gap-2 hover:bg-[#c99840] active:scale-[0.98] transition-all"
        >
          Go to dashboard
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </button>

        <p className="text-center text-[11px] text-white/20 leading-relaxed px-2">
          A receipt has been sent to your email. Manage your subscription in{" "}
          <button
            onClick={() => router.push("/settings/billing")}
            className="text-white/35 hover:text-white/55 transition-colors underline underline-offset-2"
          >
            Settings → Billing
          </button>.
        </p>
      </div>
    </div>
  );
}

// ─── Page (Suspense boundary for useSearchParams) ─────────────────────────────

export default function PricingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-[#B48B40] animate-spin" strokeWidth={2} />
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
