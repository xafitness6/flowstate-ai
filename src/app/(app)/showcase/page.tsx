"use client";

import { useAdminGuard } from "@/hooks/useAdminGuard";
import { AdjustmentCard } from "@/components/ai/AdjustmentCard";
import { AdjustmentGroup } from "@/components/ai/AdjustmentGroup";

// ─── Example data ─────────────────────────────────────────────────────────────

const CARD_CALORIES = {
  title:   "Calories",
  before:  "2,200 kcal",
  after:   "2,050 kcal",
  direction: "down" as const,
  reason:  "Lighter intake on a rest-adjacent day.",
  outcome: "Keeps weekly average on target without impacting muscle protein synthesis.",
  detail: [
    "Calorie surplus is 180kcal ahead of weekly average heading into today.",
    "Today is a lower-intensity day — energy demand is reduced.",
    "Trimming 150kcal maintains the average without a hard deficit.",
  ],
};

const CARD_STEPS = {
  title:   "Steps",
  before:  "8,000",
  after:   "9,500",
  direction: "up" as const,
  reason:  "Offset the reduced training volume today.",
  outcome: "Maintains total daily energy expenditure without adding training stress.",
  detail: [
    "Training volume is 12% lower than Monday's session.",
    "NEAT (non-exercise activity) can compensate without recovery cost.",
    "1,500 additional steps adds approximately 60–80kcal of expenditure.",
  ],
};

const CARD_TRAINING = {
  title:   "Training load",
  before:  "Unchanged",
  after:   "Unchanged",
  direction: "neutral" as const,
  reason:  "Recovery is holding. No change needed.",
  outcome: "Original program runs as planned. No modifications to sets, reps, or load.",
  detail: [
    "Sleep averaged 7.2h over 3 nights — within optimal range.",
    "Yesterday's session RPE logged at 6/10. Recovery window is clean.",
    "Weekly volume is on track. Changing load now would disrupt progressive overload.",
  ],
};

const CARD_REST = {
  title:   "Rest day",
  before:  "Training",
  after:   "Rest",
  direction: "rest" as const,
  reason:  "Accumulated fatigue flagged after 4 consecutive sessions.",
  outcome: "Reduces injury risk and primes your nervous system for the next training block.",
  detail: [
    "You've trained 4 days straight with an average RPE of 7.8.",
    "HRV pattern and reported soreness suggest systemic fatigue, not just local.",
    "One unplanned rest day now prevents a forced 3-day break later.",
  ],
};

const GROUP_ROWS = [
  {
    id: "cal",
    label: "Calories",
    before: "2,200 kcal",
    after: "2,050 kcal",
    direction: "down" as const,
    reason: "Lighter intake on a rest-adjacent day.",
  },
  {
    id: "steps",
    label: "Steps",
    before: "8,000",
    after: "9,500",
    direction: "up" as const,
    reason: "Offset reduced training volume.",
  },
  {
    id: "load",
    label: "Training load",
    before: "Unchanged",
    after: "Unchanged",
    direction: "neutral" as const,
    reason: "Recovery is holding.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShowcasePage() {
  const ready = useAdminGuard();
  if (!ready) return null;

  return (
    <div className="px-5 md:px-8 py-6 text-white">
      <div className="max-w-2xl mx-auto space-y-10">

        {/* Header */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/30 mb-3">
            Component showcase
          </p>
          <h1 className="text-4xl font-semibold tracking-tight mb-2">AI Adjustment Cards</h1>
          <p className="text-white/40">Reusable components for displaying AI-generated plan changes.</p>
        </div>

        {/* ── AdjustmentGroup ─────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-white/30">
              AdjustmentGroup
            </p>
            <p className="text-xs text-white/25">
              Multiple adjustments in one card. Use on the dashboard.
            </p>
            <code className="text-[11px] text-[#B48B40]/70 font-mono">
              {`import { AdjustmentGroup } from "@/components/ai"`}
            </code>
          </div>

          <AdjustmentGroup
            headline="3 changes to your plan today."
            subline="Based on recovery, load, and weekly targets."
            rows={GROUP_ROWS}
            outcome="Maintains your weekly caloric average, keeps output high, and reduces accumulated fatigue going into your next heavy session."
            detail={[
              "Sleep averaged 7.1h across the last 3 nights — within range but not peak.",
              "Yesterday's session RPE was logged at 8/10. Slightly elevated.",
              "Calorie surplus is ahead of schedule for the week. Trimming today maintains the average.",
            ]}
          />
        </section>

        {/* ── AdjustmentCard — default variant ────────────────────── */}
        <section className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-white/30">
              AdjustmentCard — default
            </p>
            <p className="text-xs text-white/25">
              Standalone card per adjustment. Use in program detail, notifications, or coach feed.
            </p>
            <code className="text-[11px] text-[#B48B40]/70 font-mono">
              {`import { AdjustmentCard } from "@/components/ai"`}
            </code>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdjustmentCard {...CARD_CALORIES} />
            <AdjustmentCard {...CARD_STEPS} />
            <AdjustmentCard {...CARD_TRAINING} />
            <AdjustmentCard {...CARD_REST} />
          </div>
        </section>

        {/* ── AdjustmentCard — compact variant ────────────────────── */}
        <section className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-white/30">
              AdjustmentCard — compact
            </p>
            <p className="text-xs text-white/25">
              No outcome block. Use in tight spaces — coach chat, notification trays, side panels.
            </p>
            <code className="text-[11px] text-[#B48B40]/70 font-mono">
              {`<AdjustmentCard variant="compact" />`}
            </code>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdjustmentCard {...CARD_CALORIES} variant="compact" />
            <AdjustmentCard {...CARD_REST}     variant="compact" />
          </div>
        </section>

        {/* ── Props reference ─────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/30">Props reference</p>

          <div className="rounded-2xl border border-white/7 bg-[#111111] overflow-hidden">
            <div className="divide-y divide-white/[0.05]">
              {[
                { prop: "title",            type: "string",                          req: true,  desc: "Metric name" },
                { prop: "before",           type: "string",                          req: true,  desc: "Value before change" },
                { prop: "after",            type: "string",                          req: true,  desc: "Value after change" },
                { prop: "direction",        type: '"up" | "down" | "neutral" | "rest"', req: true, desc: "Arrow direction and color scheme" },
                { prop: "reason",           type: "string",                          req: true,  desc: "One-line explanation shown inline" },
                { prop: "outcome",          type: "string",                          req: true,  desc: "Expected outcome block" },
                { prop: "detail",           type: "string[]",                        req: false, desc: "Dropdown explanation lines" },
                { prop: "onCommit",         type: "() => void",                      req: false, desc: "Called when COMMIT is clicked" },
                { prop: "onRevert",         type: "() => void",                      req: false, desc: "Called when Revert is clicked" },
                { prop: "defaultCommitted", type: "boolean",                         req: false, desc: "Start in committed state" },
                { prop: "variant",          type: '"default" | "compact"',           req: false, desc: "compact hides outcome + detail" },
              ].map(({ prop, type, req, desc }) => (
                <div key={prop} className="grid grid-cols-[140px_1fr] gap-4 px-5 py-3">
                  <div>
                    <code className="text-xs text-[#B48B40]/80 font-mono">{prop}</code>
                    {req && <span className="text-[9px] text-[#F87171]/60 ml-1.5">required</span>}
                  </div>
                  <div>
                    <code className="text-[10px] text-white/30 font-mono block mb-0.5">{type}</code>
                    <p className="text-xs text-white/40">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
