"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Minus, Zap, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { usePlan } from "@/hooks/usePlan";
import { PLAN_LABELS, PLAN_HIERARCHY } from "@/lib/plans";
import type { Plan } from "@/types";

type BillingCycle = "monthly" | "annual";

const PLANS: {
  key: Plan;
  name: string;
  tagline: string;
  monthly: number | null;
  annual: number | null;
  cta: string;
  highlight: boolean;
  badge?: string;
  features: { label: string; included: boolean }[];
  note?: string;
}[] = [
  {
    key: "foundation",
    name: "Foundation",
    tagline: "Core tracking and self-directed training. No card required.",
    monthly: null,
    annual: null,
    cta: "Start free",
    highlight: false,
    features: [
      { label: "Workout tracking", included: true },
      { label: "Nutrition tracking", included: true },
      { label: "Basic heatmap", included: true },
      { label: "30-day history", included: true },
      { label: "AI coach access", included: false },
      { label: "Full history", included: false },
      { label: "Accountability tools", included: false },
      { label: "Weekly AI adjustments", included: false },
    ],
  },
  {
    key: "training",
    name: "Training",
    tagline: "Unlimited history, AI coach access, and weekly program adjustments.",
    monthly: 29,
    annual: 23,
    cta: "Upgrade to Training",
    highlight: false,
    features: [
      { label: "Everything in Foundation", included: true },
      { label: "Full history (unlimited)", included: true },
      { label: "AI coach access", included: true },
      { label: "Weekly AI adjustments", included: true },
      { label: "Full heatmap", included: true },
      { label: "Accountability tools", included: true },
      { label: "Daily AI adjustments", included: false },
      { label: "Deep analytics", included: false },
    ],
  },
  {
    key: "performance",
    name: "AI Performance",
    tagline: "Unlimited AI coaching, daily adjustments, deep analytics, and smart recovery.",
    monthly: 79,
    annual: 63,
    cta: "Upgrade to AI Performance",
    highlight: true,
    badge: "Most popular",
    features: [
      { label: "Everything in Training", included: true },
      { label: "Unlimited AI coach messages", included: true },
      { label: "Daily AI adjustments", included: true },
      { label: "Deep analytics", included: true },
      { label: "Smart recovery signals", included: true },
      { label: "Priority support", included: true },
      { label: "Monthly coach meetings", included: false },
      { label: "Priority form review", included: false },
    ],
  },
  {
    key: "coaching",
    name: "Hybrid Coaching",
    tagline: "Everything in AI Performance, plus 2 monthly meetings with your coach and discounted naturopathic doctor consultations.",
    monthly: 199,
    annual: 159,
    cta: "Apply for Hybrid Coaching",
    highlight: false,
    badge: "Full-stack",
    note: "Includes 2 monthly 1:1 coaching calls + discounted (not unlimited) naturopathic doctor consultations.",
    features: [
      { label: "Everything in AI Performance", included: true },
      { label: "2 monthly coach meetings", included: true },
      { label: "Priority form review", included: true },
      { label: "Discounted naturopathic consultations", included: true },
      { label: "Hybrid coaching layer", included: true },
      { label: "Priority support", included: true },
      { label: "Unlimited AI coach messages", included: true },
      { label: "Daily AI adjustments", included: true },
    ],
  },
];

// ─── Search params handler ────────────────────────────────────────────────────

function PricingSearchParamsHandler({ onPlan }: { onPlan: (p: Plan) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const plan = searchParams.get("plan") as Plan | null;
    if (plan && ["foundation", "training", "performance", "coaching"].includes(plan)) {
      onPlan(plan);
    }
  }, [searchParams, onPlan]);
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { user, updatePlan } = useUser();
  const { plan: currentPlan } = usePlan();
  const [billing, setBilling]       = useState<BillingCycle>("monthly");
  const [loading, setLoading]       = useState<Plan | null>(null);
  const [demoUpgraded, setDemoUpgraded] = useState<Plan | null>(null);

  function handleParamPlan(plan: Plan) {
    updatePlan(plan);
    setDemoUpgraded(plan);
  }

  async function handleCta(plan: Plan) {
    if (plan === "foundation") {
      // Downgrade to free — no Stripe needed
      updatePlan(plan);
      return;
    }
    if (PLAN_HIERARCHY[plan] === PLAN_HIERARCHY[currentPlan]) return;

    setLoading(plan);
    try {
      const origin = window.location.origin;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          userId: user.id,
          successUrl: `${origin}/pricing`,
          cancelUrl:  `${origin}/pricing`,
        }),
      });
      const data = await res.json() as { url?: string; demo?: boolean; error?: string };
      if (data.url) {
        if (data.demo) {
          updatePlan(plan);
          setDemoUpgraded(plan);
        } else {
          window.location.href = data.url;
        }
      }
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 py-12">
      <Suspense fallback={null}>
        <PricingSearchParamsHandler onPlan={handleParamPlan} />
      </Suspense>

      {/* Header */}
      <div className="max-w-5xl mx-auto text-center mb-10">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#B48B40] mb-3 font-medium">Pricing</p>
        <h1 className="text-3xl font-semibold text-white mb-3 tracking-tight">
          Choose your plan
        </h1>
        <p className="text-sm text-white/45 max-w-md mx-auto leading-relaxed">
          Start free. Upgrade when you're ready. All historical data is preserved on any plan change.
        </p>
      </div>

      {/* Demo upgrade banner */}
      {demoUpgraded && (
        <div className="max-w-5xl mx-auto mb-6">
          <div className="rounded-2xl border border-[#B48B40]/30 bg-[#B48B40]/8 px-5 py-3 flex items-center gap-3">
            <Zap className="w-4 h-4 text-[#B48B40] shrink-0" strokeWidth={1.5} />
            <p className="text-sm text-white/75">
              Demo mode — plan updated to{" "}
              <span className="text-[#B48B40] font-medium">{PLAN_LABELS[demoUpgraded]}</span>.
              Connect Stripe in <code className="text-white/50 text-xs">.env.local</code> for real billing.
            </p>
          </div>
        </div>
      )}

      {/* Billing toggle */}
      <div className="max-w-5xl mx-auto flex justify-center mb-10">
        <div className="inline-flex items-center gap-1 rounded-xl border border-white/8 bg-white/[0.02] p-1">
          {(["monthly", "annual"] as BillingCycle[]).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBilling(cycle)}
              className={cn(
                "rounded-lg px-4 py-2 text-xs font-medium transition-all capitalize",
                billing === cycle
                  ? "bg-[#B48B40] text-black"
                  : "text-white/40 hover:text-white/65"
              )}
            >
              {cycle === "annual" ? "Annual (save 20%)" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((p) => {
          const isCurrent = p.key === currentPlan;
          const price = billing === "annual" ? p.annual : p.monthly;
          const isUpgrade = PLAN_HIERARCHY[p.key] > PLAN_HIERARCHY[currentPlan];
          const isDowngrade = PLAN_HIERARCHY[p.key] < PLAN_HIERARCHY[currentPlan];

          return (
            <div
              key={p.key}
              className={cn(
                "relative rounded-2xl border bg-[#111111] flex flex-col overflow-hidden transition-all",
                p.highlight
                  ? "border-[#B48B40]/40 shadow-[0_0_30px_rgba(180,139,64,0.08)]"
                  : "border-white/[0.07]",
                isCurrent && "ring-1 ring-[#B48B40]/30"
              )}
            >
              {/* Badge */}
              {p.badge && (
                <div className={cn(
                  "absolute top-3 right-3 text-[9px] uppercase tracking-[0.18em] font-semibold px-2 py-0.5 rounded-full border",
                  p.highlight
                    ? "text-[#B48B40] border-[#B48B40]/30 bg-[#B48B40]/8"
                    : "text-white/40 border-white/10 bg-white/[0.04]"
                )}>
                  {p.badge}
                </div>
              )}

              {isCurrent && (
                <div className="absolute top-3 left-3 text-[9px] uppercase tracking-[0.18em] font-semibold px-2 py-0.5 rounded-full border text-emerald-400 border-emerald-400/25 bg-emerald-400/6">
                  Current
                </div>
              )}

              <div className="p-5 flex-1 flex flex-col">
                {/* Name + price */}
                <div className="mb-4 mt-4">
                  <p className={cn(
                    "text-xs font-semibold uppercase tracking-[0.15em] mb-1",
                    p.highlight ? "text-[#B48B40]" : "text-white/50"
                  )}>
                    {p.name}
                  </p>
                  <div className="flex items-end gap-1">
                    {price === null ? (
                      <span className="text-2xl font-bold text-white">Free</span>
                    ) : (
                      <>
                        <span className="text-2xl font-bold text-white">${price}</span>
                        <span className="text-xs text-white/35 mb-1">/ mo</span>
                      </>
                    )}
                  </div>
                  {billing === "annual" && price !== null && (
                    <p className="text-[10px] text-white/30 mt-0.5">billed annually</p>
                  )}
                </div>

                <p className="text-[11px] text-white/45 leading-relaxed mb-5 min-h-[48px]">
                  {p.tagline}
                </p>

                {/* Features */}
                <ul className="space-y-2 flex-1 mb-5">
                  {p.features.map((f) => (
                    <li key={f.label} className="flex items-start gap-2">
                      {f.included ? (
                        <Check className="w-3.5 h-3.5 text-[#B48B40] shrink-0 mt-0.5" strokeWidth={2} />
                      ) : (
                        <Minus className="w-3.5 h-3.5 text-white/15 shrink-0 mt-0.5" strokeWidth={1.5} />
                      )}
                      <span className={cn(
                        "text-[11px] leading-tight",
                        f.included ? "text-white/65" : "text-white/22"
                      )}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>

                {p.note && (
                  <p className="text-[10px] text-white/30 leading-relaxed mb-4 border-t border-white/[0.05] pt-3">
                    {p.note}
                  </p>
                )}

                {/* CTA */}
                <button
                  onClick={() => handleCta(p.key)}
                  disabled={isCurrent || loading === p.key}
                  className={cn(
                    "w-full rounded-xl py-2.5 text-xs font-semibold transition-all",
                    isCurrent
                      ? "bg-white/[0.04] text-white/25 cursor-default border border-white/[0.06]"
                      : p.highlight
                        ? "bg-[#B48B40] text-black hover:bg-[#c99840]"
                        : isUpgrade
                          ? "bg-white/[0.07] text-white/75 hover:bg-white/[0.11] border border-white/[0.08]"
                          : isDowngrade
                            ? "bg-white/[0.04] text-white/40 hover:bg-white/[0.07] border border-white/[0.06]"
                            : "bg-white/[0.07] text-white/75 hover:bg-white/[0.11] border border-white/[0.08]"
                  )}
                >
                  {loading === p.key
                    ? "Redirecting..."
                    : isCurrent
                      ? "Current plan"
                      : p.cta}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="max-w-5xl mx-auto mt-10 text-center">
        <p className="text-[11px] text-white/25 leading-relaxed">
          All plans retain your full history — data is never deleted on downgrade.
          Cancel anytime. Questions?{" "}
          <a href="mailto:hello@flowstate.ai" className="text-[#B48B40]/70 hover:text-[#B48B40] transition-colors">
            Contact us
          </a>
        </p>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-1.5 text-[10px] text-white/25">
            <Star className="w-3 h-3" strokeWidth={1.5} />
            <span>No lock-in</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/25">
            <Users className="w-3 h-3" strokeWidth={1.5} />
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/25">
            <Check className="w-3 h-3" strokeWidth={1.5} />
            <span>Data always preserved</span>
          </div>
        </div>
      </div>
    </div>
  );
}
