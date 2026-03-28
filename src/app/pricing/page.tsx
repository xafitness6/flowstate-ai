"use client";

import { useState } from "react";
import { Check, Minus, ArrowRight, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanKey = "core" | "pro" | "elite" | "coaching";
type BillingCycle = "monthly" | "annual";

// ─── Plan data ────────────────────────────────────────────────────────────────

const PLANS: {
  key: PlanKey;
  name: string;
  identity: string;
  tagline: string;
  monthly: number | null;
  annual: number | null;
  billingNote: string;
  cta: string;
  highlight: boolean;
  features: string[];
}[] = [
  {
    key: "core",
    name: "Core",
    identity: "The self-directed athlete",
    tagline: "Everything you need to train and eat with precision. No coach, no friction.",
    monthly: 29,
    annual: 23,
    billingNote: "per month",
    cta: "Start with Core",
    highlight: false,
    features: [
      "AI-generated training program",
      "AI nutrition planning",
      "Daily plan adjustments",
      "Progress tracking",
      "Body status signals",
      "Workout builder",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    identity: "The serious performer",
    tagline: "Full AI coaching layer with deeper calibration and faster adaptation.",
    monthly: 59,
    annual: 47,
    billingNote: "per month",
    cta: "Start with Pro",
    highlight: true,
    features: [
      "Everything in Core",
      "AI coach chat (unlimited)",
      "Progress photos",
      "Advanced body composition analysis",
      "Calibration flow",
      "Weekly AI performance review",
      "Priority support",
    ],
  },
  {
    key: "elite",
    name: "Elite",
    identity: "Performance as infrastructure",
    tagline: "For those who build their life around what their body can do.",
    monthly: 99,
    annual: 79,
    billingNote: "per month",
    cta: "Start with Elite",
    highlight: false,
    features: [
      "Everything in Pro",
      "Custom meal plans (AI-generated)",
      "Full biometric integration",
      "Trainer assignment",
      "Trainer dashboard access",
      "Dedicated plan review cadence",
      "Early access to new features",
    ],
  },
  {
    key: "coaching",
    name: "1:1 Coaching",
    identity: "A partner, not a product",
    tagline: "Direct access to a human coach. Built for those who want accountability, not automation.",
    monthly: null,
    annual: null,
    billingNote: "$2,000 / 3 months",
    cta: "Apply for coaching",
    highlight: false,
    features: [
      "Everything in Elite",
      "Dedicated human coach",
      "Weekly video check-ins",
      "Direct messaging",
      "Fully custom programming",
      "Nutrition planning with your coach",
      "30-day post-program support",
    ],
  },
];

// ─── Comparison table ─────────────────────────────────────────────────────────

type FeatureRow = {
  label: string;
  group?: string;
  core: boolean | string;
  pro: boolean | string;
  elite: boolean | string;
  coaching: boolean | string;
};

const FEATURE_GROUPS: { group: string; rows: FeatureRow[] }[] = [
  {
    group: "Training",
    rows: [
      { label: "AI-generated training program",   core: true,        pro: true,          elite: true,          coaching: true },
      { label: "Workout builder",                 core: true,        pro: true,          elite: true,          coaching: true },
      { label: "Daily plan adjustments",          core: "Weekly",    pro: "Daily",        elite: "Real-time",   coaching: "Real-time" },
      { label: "Trainer assignment",              core: false,       pro: false,          elite: true,          coaching: true },
      { label: "Fully custom programming",        core: false,       pro: false,          elite: false,         coaching: true },
    ],
  },
  {
    group: "Nutrition",
    rows: [
      { label: "AI nutrition planning",           core: true,        pro: true,           elite: true,          coaching: true },
      { label: "Custom meal plans",               core: false,       pro: false,          elite: true,          coaching: true },
      { label: "Nutrition planning with coach",   core: false,       pro: false,          elite: false,         coaching: true },
    ],
  },
  {
    group: "Coaching & AI",
    rows: [
      { label: "AI coach chat",                   core: "Limited",   pro: "Unlimited",    elite: "Unlimited",   coaching: "Unlimited" },
      { label: "Weekly AI performance review",    core: false,       pro: true,           elite: true,          coaching: true },
      { label: "Calibration flow",                core: false,       pro: true,           elite: true,          coaching: true },
      { label: "Dedicated human coach",           core: false,       pro: false,          elite: false,         coaching: true },
      { label: "Weekly video check-ins",          core: false,       pro: false,          elite: false,         coaching: true },
      { label: "Direct messaging with coach",     core: false,       pro: false,          elite: false,         coaching: true },
    ],
  },
  {
    group: "Tracking & Analysis",
    rows: [
      { label: "Progress tracking",               core: true,        pro: true,           elite: true,          coaching: true },
      { label: "Body status signals",             core: true,        pro: true,           elite: true,          coaching: true },
      { label: "Progress photos",                 core: false,       pro: true,           elite: true,          coaching: true },
      { label: "Advanced body composition",       core: false,       pro: true,           elite: true,          coaching: true },
      { label: "Full biometric integration",      core: false,       pro: false,          elite: true,          coaching: true },
    ],
  },
  {
    group: "Account",
    rows: [
      { label: "Priority support",                core: false,       pro: true,           elite: true,          coaching: true },
      { label: "Early access to features",        core: false,       pro: false,          elite: true,          coaching: true },
      { label: "Post-program support",            core: false,       pro: false,          elite: false,         coaching: "30 days" },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === false) return <Minus className="w-3.5 h-3.5 text-white/15 mx-auto" strokeWidth={1.5} />;
  if (value === true)  return <Check className="w-3.5 h-3.5 text-[#B48B40] mx-auto" strokeWidth={2.5} />;
  return <span className="text-xs text-white/45 text-center block">{value}</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [tableOpen, setTableOpen] = useState(false);

  const savings = billing === "annual";

  return (
    <div className="text-white">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="px-5 md:px-8 pt-10 pb-8 text-center max-w-3xl mx-auto">
        <p className="text-[10px] uppercase tracking-[0.28em] text-white/25 mb-5">Pricing</p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] mb-5">
          Built for people who
          <br />
          <span className="text-[#B48B40]">take this seriously.</span>
        </h1>
        <p className="text-white/40 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
          Every plan includes AI-driven training and nutrition. The difference is how deep the coaching goes and how much of the thinking you want to hand off.
        </p>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => setBilling("monthly")}
            className={cn(
              "text-sm font-medium transition-colors",
              billing === "monthly" ? "text-white/85" : "text-white/28 hover:text-white/55"
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling(billing === "monthly" ? "annual" : "monthly")}
            className={cn(
              "relative w-10 h-5.5 rounded-full transition-all duration-200 shrink-0",
              billing === "annual" ? "bg-[#B48B40]" : "bg-white/10"
            )}
            style={{ height: "22px", width: "40px" }}
          >
            <span
              className={cn(
                "absolute top-0.5 rounded-full bg-white shadow transition-all duration-200",
                billing === "annual" ? "left-[18px]" : "left-0.5"
              )}
              style={{ width: "18px", height: "18px" }}
            />
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={cn(
              "text-sm font-medium transition-colors flex items-center gap-2",
              billing === "annual" ? "text-white/85" : "text-white/28 hover:text-white/55"
            )}
          >
            Annual
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-md">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* ── Plan cards ────────────────────────────────────────────────── */}
      <div className="px-5 md:px-8 pb-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANS.map((plan) => {
            const price = billing === "annual" ? plan.annual : plan.monthly;
            const isCoaching = plan.key === "coaching";

            return (
              <div
                key={plan.key}
                className={cn(
                  "relative rounded-2xl border flex flex-col overflow-hidden transition-all",
                  plan.highlight
                    ? "border-[#B48B40]/45 bg-[#0e0d0b]"
                    : "border-white/6 bg-[#111111]"
                )}
              >
                {/* Pro badge */}
                {plan.highlight && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-px">
                    <div className="bg-[#B48B40] text-black text-[10px] font-bold tracking-[0.12em] uppercase px-4 py-1 rounded-b-lg">
                      Most popular
                    </div>
                  </div>
                )}

                <div className={cn("px-6 pt-7 pb-6", plan.highlight && "pt-9")}>
                  {/* Plan name + identity */}
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={cn(
                        "text-xs font-bold tracking-[0.1em] uppercase",
                        plan.highlight ? "text-[#B48B40]" : "text-white/55"
                      )}>
                        {plan.name}
                      </span>
                    </div>
                    <p className={cn(
                      "text-sm font-medium leading-snug",
                      plan.highlight ? "text-white/80" : "text-white/55"
                    )}>
                      {plan.identity}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-1.5">
                    {isCoaching ? (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-semibold tracking-tight text-white/88">$2,000</span>
                        </div>
                        <p className="text-xs text-white/28 mt-0.5">billed as a single 3-month block</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[10px] text-white/30 mt-1 self-start pt-1.5">$</span>
                          <span className="text-3xl font-semibold tracking-tight text-white/88">{price}</span>
                          <span className="text-xs text-white/28">/ mo</span>
                        </div>
                        {savings && (
                          <p className="text-[10px] text-emerald-400/70 mt-0.5">
                            ${((plan.monthly! - plan.annual!) * 12).toLocaleString()} saved annually
                          </p>
                        )}
                        {!savings && <p className="text-[10px] text-white/20 mt-0.5">billed monthly</p>}
                      </div>
                    )}
                  </div>

                  {/* Tagline */}
                  <p className="text-xs text-white/32 leading-relaxed mt-4 mb-6 min-h-[3rem]">
                    {plan.tagline}
                  </p>

                  {/* CTA */}
                  <button
                    className={cn(
                      "w-full rounded-xl py-3 text-sm font-semibold tracking-wide transition-all",
                      plan.highlight
                        ? "bg-[#B48B40] text-black hover:bg-[#c99840]"
                        : isCoaching
                        ? "bg-white/[0.04] border border-white/10 text-white/65 hover:bg-white/[0.08] hover:text-white/85"
                        : "bg-white/[0.04] border border-white/10 text-white/65 hover:bg-white/[0.08] hover:text-white/85"
                    )}
                  >
                    {plan.cta}
                  </button>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/5 mx-6" />

                {/* Feature list */}
                <div className="px-6 py-5 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/20 mb-3.5">Includes</p>
                  <ul className="space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check
                          className={cn(
                            "w-3.5 h-3.5 shrink-0 mt-0.5",
                            plan.highlight ? "text-[#B48B40]" : "text-white/28"
                          )}
                          strokeWidth={2.5}
                        />
                        <span className="text-xs text-white/52 leading-relaxed">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Comparison table ──────────────────────────────────────────── */}
      <div className="px-5 md:px-8 pb-8 max-w-7xl mx-auto">
        <div className="rounded-2xl border border-white/6 bg-[#111111] overflow-hidden">

          {/* Toggle header */}
          <button
            onClick={() => setTableOpen((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.015] transition-colors"
          >
            <p className="text-sm font-medium text-white/65">Full feature comparison</p>
            <span className={cn(
              "text-[10px] font-semibold tracking-wide uppercase text-[#B48B40] transition-all"
            )}>
              {tableOpen ? "Hide" : "Show"}
            </span>
          </button>

          {tableOpen && (
            <>
              {/* Column headers */}
              <div className="border-t border-white/5 grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-6 py-3 bg-white/[0.015]">
                <div />
                {(["Core", "Pro", "Elite", "1:1"] as const).map((label, i) => (
                  <div key={label} className="text-center">
                    <p className={cn(
                      "text-xs font-semibold tracking-[0.08em]",
                      label === "Pro" ? "text-[#B48B40]" : "text-white/38"
                    )}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Feature rows */}
              {FEATURE_GROUPS.map((group) => (
                <div key={group.group}>
                  {/* Group label */}
                  <div className="border-t border-white/5 px-6 py-2.5 bg-white/[0.01]">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/20">
                      {group.group}
                    </p>
                  </div>

                  {group.rows.map((row, ri) => (
                    <div
                      key={row.label}
                      className={cn(
                        "grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-6 py-3 border-t border-white/[0.04] items-center",
                        ri % 2 === 1 && "bg-white/[0.008]"
                      )}
                    >
                      <p className="text-xs text-white/48 pr-4">{row.label}</p>
                      <FeatureValue value={row.core}     />
                      <FeatureValue value={row.pro}      />
                      <FeatureValue value={row.elite}    />
                      <FeatureValue value={row.coaching} />
                    </div>
                  ))}
                </div>
              ))}

              {/* Table footer */}
              <div className="border-t border-white/5 grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-6 py-4 bg-white/[0.015]">
                <div />
                {PLANS.map((plan) => {
                  const price = billing === "annual" ? plan.annual : plan.monthly;
                  return (
                    <div key={plan.key} className="text-center">
                      {plan.key !== "coaching" ? (
                        <p className={cn(
                          "text-sm font-semibold tabular-nums",
                          plan.highlight ? "text-[#B48B40]" : "text-white/45"
                        )}>
                          ${price}<span className="text-[10px] font-normal">/mo</span>
                        </p>
                      ) : (
                        <p className="text-xs text-white/35">$2,000</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Identity callouts ─────────────────────────────────────────── */}
      <div className="px-5 md:px-8 pb-8 max-w-3xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              label: "If you're self-sufficient",
              text: "Core covers the full stack of AI-driven training and nutrition. You set the direction. The system executes.",
            },
            {
              label: "If performance is non-negotiable",
              text: "Pro and Elite are built for people who don't accept guesswork. Deeper calibration, faster adaptation, more signal.",
            },
            {
              label: "If you want a human in the loop",
              text: "1:1 coaching is for those who want accountability beyond automation. Apply when you're ready to commit.",
            },
          ].map(({ label, text }) => (
            <div key={label} className="rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4">
              <p className="text-xs font-semibold text-white/55 mb-2">{label}</p>
              <p className="text-xs text-white/30 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Coaching CTA ──────────────────────────────────────────────── */}
      <div className="px-5 md:px-8 pb-10 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-white/6 bg-[#0e0d0b] px-6 py-7 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-10 h-10 rounded-xl border border-[#B48B40]/20 bg-[#B48B40]/6 flex items-center justify-center shrink-0">
            <MessageCircle className="w-4.5 h-4.5 text-[#B48B40]" strokeWidth={1.5} style={{ width: "18px", height: "18px" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white/80 mb-1">
              Not sure which plan is right for you?
            </p>
            <p className="text-xs text-white/35 leading-relaxed">
              If you're dealing with specific health context, training history, or life circumstances that feel too complex for a standard plan — talk to a coach first. It's one conversation, no pressure.
            </p>
          </div>
          <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-white/60 hover:text-white/85 hover:border-white/18 hover:bg-white/[0.06] transition-all shrink-0">
            Talk to a coach
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ── Footer note ───────────────────────────────────────────────── */}
      <div className="px-5 md:px-8 pb-8 text-center">
        <p className="text-xs text-white/20 leading-relaxed max-w-md mx-auto">
          All plans include a 7-day free trial. No card required to start. Cancel anytime — your data stays yours.
        </p>
      </div>

    </div>
  );
}
