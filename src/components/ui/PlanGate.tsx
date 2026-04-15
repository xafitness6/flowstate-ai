"use client";

// ─── Plan Gate UI Components ──────────────────────────────────────────────────
//
// Four components for different gating contexts:
//
//   <PlanGate feature={...}>          — conditional render wrapper
//     children
//   </PlanGate>
//
//   <LockedPageState feature={...} /> — full-page locked state (replaces whole page)
//
//   <LockedSection feature={...} />   — inline blurred section with overlay
//
//   <UpgradeCard feature={...} />     — compact inline card for action-level gates
//
// All components read from FEATURE_COPY for consistent copy.
// Never render a hard error — always degrade gracefully.

import { useRouter }       from "next/navigation";
import { Lock, ArrowRight, CheckCircle2, Zap, ChevronRight } from "lucide-react";
import { cn }              from "@/lib/utils";
import { useEntitlement }  from "@/hooks/useEntitlement";
import {
  FEATURES,
  FEATURE_COPY,
  getUpgradeLabel,
  getUpgradeTargetForFeature,
  type Feature,
} from "@/lib/entitlements";
import { PLAN_PRICES }     from "@/lib/plans";
import type { Plan }       from "@/types";

// ─── PlanGate ─────────────────────────────────────────────────────────────────
// Wraps children. Renders `fallback` (or a default LockedPageState) when locked.

export function PlanGate({
  feature,
  children,
  fallback,
}: {
  feature:   Feature;
  children:  React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can } = useEntitlement();
  if (can(feature)) return <>{children}</>;
  return <>{fallback ?? <LockedPageState feature={feature} />}</>;
}

// ─── LockedPageState ──────────────────────────────────────────────────────────
// Full-screen locked state — replace the page content when the plan gate fails.
// Shows feature value so users understand what they'd get.

export function LockedPageState({
  feature,
  title:       customTitle,
  description: customDescription,
  benefits:    customBenefits,
}: {
  feature:      Feature;
  title?:       string;
  description?: string;
  benefits?:    string[];
}) {
  const router      = useRouter();
  const copy        = FEATURE_COPY[feature];
  const title       = customTitle       ?? copy?.title       ?? "Premium Feature";
  const description = customDescription ?? copy?.description ?? "Upgrade to access this feature.";
  const benefits    = customBenefits    ?? copy?.benefits    ?? [];
  const label       = getUpgradeLabel(feature);
  const targetPlan  = getUpgradeTargetForFeature(feature);
  const price       = PLAN_PRICES[targetPlan];

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-5 py-12 text-white">
      <div className="max-w-sm w-full space-y-7">

        {/* Icon */}
        <div className="flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-[#B48B40]/10 border border-[#B48B40]/20 flex items-center justify-center">
            <Lock className="w-6 h-6 text-[#B48B40]/70" strokeWidth={1.5} />
          </div>
        </div>

        {/* Copy */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#B48B40]/20 bg-[#B48B40]/6 mb-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#B48B40]/70 font-semibold">
              {label} plan
            </span>
          </div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="text-sm text-white/45 leading-relaxed">{description}</p>
        </div>

        {/* Benefits */}
        {benefits.length > 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111111] p-4 space-y-2.5">
            {benefits.map((b) => (
              <div key={b} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#B48B40]/60 shrink-0 mt-0.5" strokeWidth={1.5} />
                <p className="text-sm text-white/60 leading-snug">{b}</p>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="space-y-2.5">
          <button
            onClick={() => router.push("/pricing")}
            className="w-full rounded-2xl py-3.5 bg-[#B48B40] text-black text-sm font-semibold tracking-wide flex items-center justify-center gap-2 hover:bg-[#c99840] active:scale-[0.98] transition-all"
          >
            {price ? `Upgrade to ${label} · $${price}/mo` : `Upgrade to ${label}`}
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </button>
          <button
            onClick={() => router.back()}
            className="w-full text-center text-xs text-white/25 hover:text-white/45 transition-colors py-1"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LockedSection ────────────────────────────────────────────────────────────
// Inline locked section — wraps a preview of the content with a blur + overlay.
// Use for in-page sections that are premium (analytics, coach features, etc.)

export function LockedSection({
  feature,
  title,
  description,
  children,
  blurStrength = "sm",
}: {
  feature:        Feature;
  title?:         string;
  description?:   string;
  children?:      React.ReactNode;
  blurStrength?:  "sm" | "md" | "lg";
}) {
  const router  = useRouter();
  const copy    = FEATURE_COPY[feature];
  const label   = getUpgradeLabel(feature);
  const blurMap = { sm: "blur-sm", md: "blur-md", lg: "blur-lg" };

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Blurred preview of content behind gate */}
      {children && (
        <div
          className={cn(
            "pointer-events-none select-none",
            blurMap[blurStrength],
            "opacity-40"
          )}
          aria-hidden
        >
          {children}
        </div>
      )}

      {/* Overlay */}
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center p-5 text-center",
        "bg-[#0A0A0A]/75 backdrop-blur-[2px]",
        !children && "relative inset-auto rounded-2xl border border-white/[0.07] bg-[#111111] py-8",
      )}>
        <div className="w-9 h-9 rounded-xl bg-[#B48B40]/10 border border-[#B48B40]/18 flex items-center justify-center mb-3">
          <Lock className="w-4 h-4 text-[#B48B40]/60" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-semibold text-white/75 mb-1">
          {title ?? copy?.title ?? "Premium Feature"}
        </p>
        <p className="text-xs text-white/35 mb-4 leading-relaxed max-w-[240px]">
          {description ?? `Available on ${label} plan and above.`}
        </p>
        <button
          onClick={() => router.push("/pricing")}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B48B40] text-black text-xs font-semibold hover:bg-[#c99840] active:scale-[0.98] transition-all"
        >
          Upgrade to {label}
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ─── UpgradeCard ──────────────────────────────────────────────────────────────
// Compact inline card — use at the action level (button replacement, inline prompt).
// Shows the feature title, a short benefit, and an upgrade CTA.

export function UpgradeCard({
  feature,
  compact = false,
  className,
}: {
  feature:    Feature;
  compact?:   boolean;
  className?: string;
}) {
  const router = useRouter();
  const copy   = FEATURE_COPY[feature];
  const label  = getUpgradeLabel(feature);
  const target = getUpgradeTargetForFeature(feature);
  const price  = PLAN_PRICES[target];

  return (
    <div className={cn(
      "rounded-2xl border border-[#B48B40]/20 bg-[#B48B40]/[0.04] overflow-hidden",
      className,
    )}>
      <div className={cn("flex items-start gap-3", compact ? "px-4 py-3" : "px-5 py-4")}>
        <div className="w-7 h-7 rounded-lg bg-[#B48B40]/10 border border-[#B48B40]/18 flex items-center justify-center shrink-0 mt-0.5">
          <Zap className="w-3.5 h-3.5 text-[#B48B40]/70" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/75 leading-snug">
            {copy?.title ?? label + " plan required"}
          </p>
          {!compact && copy?.description && (
            <p className="text-xs text-white/35 mt-0.5 leading-relaxed">{copy.description}</p>
          )}
        </div>
      </div>
      <div className={cn("border-t border-[#B48B40]/12", compact ? "px-4 pb-3" : "px-5 pb-4")}>
        <button
          onClick={() => router.push("/pricing")}
          className="w-full rounded-xl py-2 bg-[#B48B40]/85 text-black text-xs font-semibold hover:bg-[#B48B40] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 mt-2.5"
        >
          {price ? `Get ${label} · $${price}/mo` : `Get ${label}`}
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ─── UpgradeButton ────────────────────────────────────────────────────────────
// Replaces an action button when the feature is locked.
// Drop-in: same size/shape as the button it replaces, but shows lock + upgrade.

export function UpgradeButton({
  feature,
  label,
  className,
}: {
  feature:    Feature;
  label?:     string;
  className?: string;
}) {
  const router     = useRouter();
  const planLabel  = getUpgradeLabel(feature);
  const targetPlan = getUpgradeTargetForFeature(feature);
  const price      = PLAN_PRICES[targetPlan];

  return (
    <button
      onClick={() => router.push("/pricing")}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#B48B40]/20 bg-[#B48B40]/[0.04] text-[#B48B40]/70 text-sm font-medium hover:bg-[#B48B40]/[0.08] hover:text-[#B48B40] transition-all",
        className,
      )}
      title={`${planLabel} plan required${price ? ` · $${price}/mo` : ""}`}
    >
      <Lock className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
      <span>{label ?? `${planLabel} feature`}</span>
    </button>
  );
}

// ─── Re-export FEATURES for co-located import ─────────────────────────────────
export { FEATURES };
