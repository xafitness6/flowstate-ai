"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard, Zap, ArrowRight, AlertCircle, CheckCircle2,
  Clock, ChevronRight, Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { PLAN_LABELS, PLAN_PRICES } from "@/lib/plans";
import { EARLY_ACCESS_ENABLED } from "@/lib/earlyAccess";
import type { Plan, SubscriptionStatus } from "@/types";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, earlyAccess }: { status: SubscriptionStatus | undefined; earlyAccess?: boolean }) {
  if (earlyAccess) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border text-[#B48B40] border-[#B48B40]/25 bg-[#B48B40]/8">
        <Gift className="w-2.5 h-2.5" strokeWidth={2} />
        Early access
      </span>
    );
  }
  if (!status || status === "active") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border text-emerald-400 border-emerald-400/25 bg-emerald-400/6">
        <CheckCircle2 className="w-2.5 h-2.5" strokeWidth={2} />
        Active
      </span>
    );
  }
  if (status === "past_due") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border text-amber-400 border-amber-400/25 bg-amber-400/6">
        <AlertCircle className="w-2.5 h-2.5" strokeWidth={2} />
        Past due
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border text-white/30 border-white/10 bg-white/[0.04]">
      <Clock className="w-2.5 h-2.5" strokeWidth={2} />
      Inactive
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const router   = useRouter();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);

  const plan: Plan              = (user as { plan?: Plan }).plan ?? "foundation";
  const status: SubscriptionStatus | undefined = (user as { subscriptionStatus?: SubscriptionStatus }).subscriptionStatus;
  const customerId: string | null = (user as { stripeCustomerId?: string | null }).stripeCustomerId ?? null;
  const periodEnd: string | null  = (user as { subscriptionPeriodEnd?: string | null }).subscriptionPeriodEnd ?? null;

  const planName  = PLAN_LABELS[plan] ?? plan;
  const planPrice = PLAN_PRICES[plan];
  const isPaid    = planPrice !== null;

  const periodEndDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  async function openPortal() {
    if (!customerId) { router.push("/pricing"); return; }
    setLoading(true);
    try {
      const origin = window.location.origin;
      const res = await fetch("/api/stripe/portal", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, returnUrl: `${origin}/settings/billing` }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Portal error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Early access layout ──────────────────────────────────────────────────────

  if (EARLY_ACCESS_ENABLED) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] px-4 py-10">
        <div className="max-w-lg mx-auto space-y-6">

          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#B48B40] mb-1 font-medium">Settings</p>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Billing</h1>
          </div>

          {/* Plan card */}
          <div className="rounded-2xl border border-[#B48B40]/22 bg-[#111111] overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b border-white/[0.05]">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[#B48B40]/10 border border-[#B48B40]/20 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2} />
                </div>
                <p className="text-sm font-semibold text-white/80">Current plan</p>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold text-white">{planName}</p>
                  <p className="text-sm text-[#B48B40]/60 mt-0.5">Complimentary early access</p>
                </div>
                <StatusBadge status={status} earlyAccess />
              </div>
            </div>

            {/* Early access notice */}
            <div className="px-5 py-4 bg-[#B48B40]/[0.03] border-b border-[#B48B40]/10 flex items-start gap-2.5">
              <Gift className="w-4 h-4 text-[#B48B40]/60 shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-xs text-white/40 leading-relaxed">
                You have full Elite access at no charge. Billing will open when the platform launches publicly — your access will be honored through the transition.
              </p>
            </div>

            {/* No billing actions while in early access */}
            <div className="px-5 py-4">
              <div
                className="w-full rounded-xl py-2.5 px-4 bg-white/[0.02] border border-white/[0.05] text-xs text-white/25 text-center cursor-default select-none"
              >
                Billing management · Coming soon
              </div>
            </div>
          </div>

          {/* View pricing ladder */}
          <button
            onClick={() => router.push("/pricing")}
            className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 flex items-center justify-between hover:bg-white/[0.04] transition-all group"
          >
            <div className="text-left">
              <p className="text-sm font-medium text-white/70">View pricing plans</p>
              <p className="text-xs text-white/30 mt-0.5">See what's included in each tier</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" strokeWidth={1.5} />
          </button>

          <p className="text-center text-[11px] text-white/18 leading-relaxed px-4">
            All historical data is always preserved. Your access will not be interrupted at launch.
          </p>
        </div>
      </div>
    );
  }

  // ── Live billing layout ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 py-10">
      <div className="max-w-lg mx-auto space-y-6">

        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#B48B40] mb-1 font-medium">Settings</p>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Billing</h1>
        </div>

        {/* Current plan card */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111111] overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-white/[0.05]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#B48B40]/10 border border-[#B48B40]/20 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2} />
              </div>
              <p className="text-sm font-semibold text-white/80">Current plan</p>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xl font-semibold text-white">{planName}</p>
                {isPaid
                  ? <p className="text-sm text-white/40 mt-0.5">${planPrice} / month</p>
                  : <p className="text-sm text-white/40 mt-0.5">Free</p>
                }
              </div>
              <StatusBadge status={status} />
            </div>

            {periodEndDate && isPaid && (
              <p className="text-xs text-white/30 mt-3">
                {status === "inactive" ? "Access until" : "Renews on"}{" "}
                <span className="text-white/45">{periodEndDate}</span>
              </p>
            )}
          </div>

          {status === "past_due" && (
            <div className="px-5 py-3 bg-amber-400/5 border-b border-amber-400/15 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-xs text-amber-400/80 leading-relaxed">
                Your last payment failed. Update your payment method to keep access.
              </p>
            </div>
          )}

          <div className="px-5 py-4 space-y-2">
            {isPaid && customerId && (
              <button
                onClick={openPortal}
                disabled={loading}
                className="w-full rounded-xl py-2.5 bg-white/[0.06] border border-white/[0.08] text-sm text-white/70 hover:bg-white/[0.1] hover:text-white/85 flex items-center justify-between px-4 transition-all disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" strokeWidth={1.5} />
                  {loading ? "Opening portal…" : "Manage billing"}
                </span>
                <ChevronRight className="w-4 h-4 text-white/30" strokeWidth={1.5} />
              </button>
            )}
            {!isPaid && (
              <button
                onClick={() => router.push("/pricing")}
                className="w-full rounded-xl py-2.5 bg-[#B48B40] text-black text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#c99840] active:scale-[0.98] transition-all"
              >
                Upgrade your plan
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {plan !== "coaching" && isPaid && (
          <button
            onClick={() => router.push("/pricing")}
            className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 flex items-center justify-between hover:bg-white/[0.04] transition-all group"
          >
            <div className="text-left">
              <p className="text-sm font-medium text-white/70">View all plans</p>
              <p className="text-xs text-white/30 mt-0.5">Upgrade or change your plan at any time</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" strokeWidth={1.5} />
          </button>
        )}

        <p className="text-center text-[11px] text-white/20 leading-relaxed px-4">
          All historical data is preserved on any plan change. Cancel anytime — no hidden fees.
        </p>
      </div>
    </div>
  );
}
