"use client";

import { useMemo, useState } from "react";
import { Lightbulb, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Curated tips from Xavier's "How to Conquer Your Carbs" ebook.
 * Lives in the nutrition page right column. Grouped — user can flip between
 * categories like a small playbook.
 */

type Tip = { title: string; body: string };
type Category = { key: string; label: string; icon: string; tips: Tip[] };

const CATEGORIES: Category[] = [
  {
    key:   "starting",
    label: "Starting out",
    icon:  "🎯",
    tips: [
      {
        title: "Start where you are",
        body:  "Don't slash calories on day one — start with what you've been eating, just swap in healthier, nutrient-dense versions of the same foods. You'll quickly notice the same calories feel like more food.",
      },
      {
        title: "Recalculate every 5 lbs",
        body:  "Your TDEE shifts as your bodyweight moves. Re-run your numbers whenever the scale swings 5 lb in either direction.",
      },
      {
        title: "Adjust by 100–200 kcal at a time",
        body:  "If you're stalling, tighten or loosen calories by 100–200 a week. Drastic cuts wreck your metabolism and rarely stick.",
      },
    ],
  },
  {
    key:   "training",
    label: "Around training",
    icon:  "💪",
    tips: [
      {
        title: "Carbs after, fats away from",
        body:  "Eat fats 1–2 hrs before or after your workout, never with the post-workout carbs. Mixing high fat with high carb post-training slows nutrient absorption.",
      },
      {
        title: "Pre-workout: small + simple",
        body:  "30–45 min before training: a small protein + carb hit, almost zero fat. Protein bar, Greek yogurt + granola, toast + PB + banana.",
      },
      {
        title: "Post-workout: protein first, meal in an hour",
        body:  "A protein shake within 30 min of finishing — simple shakes absorb fast and go straight to recovery. Full meal with carbs and fats lands an hour later.",
      },
    ],
  },
  {
    key:   "habits",
    label: "Daily habits",
    icon:  "🌅",
    tips: [
      {
        title: "Hit 0.5 oz of water per lb",
        body:  "Aim for 5 urinations a day. 1–2 cups when you wake, 30 min before each meal, 30 min after each meal, and after every workout.",
      },
      {
        title: "7–8 hours of sleep, every night",
        body:  "Recovery is half the result. Bad sleep blunts insulin sensitivity and torches lean mass during a cut.",
      },
      {
        title: "Plan meals before you order",
        body:  "Pull up the menu before you walk into a restaurant. Dressings on the side, ask how it's prepared, half the plate goes home for tomorrow.",
      },
    ],
  },
  {
    key:   "cravings",
    label: "Cravings",
    icon:  "🧠",
    tips: [
      {
        title: "Don't keep what you'll regret",
        body:  "If you KNOW the late-night craving wins when ice cream is in the freezer, replace it with frozen berries + Greek yogurt. Take the choice off the table.",
      },
      {
        title: "Pause and re-assess",
        body:  "When the craving hits, sit for two minutes. \"Do I really need this? How will I feel after? Does this get me closer to my goal?\" Most cravings die in that pause.",
      },
      {
        title: "You're probably thirsty",
        body:  "If you've hit your macros and you're still hungry — drink water first, wait 10 min. Real hunger persists; thirst masquerading as hunger fades.",
      },
    ],
  },
];

export function PhilosophyTips() {
  const [activeKey, setActiveKey] = useState(CATEGORIES[0].key);
  const [tipIdx,    setTipIdx]    = useState(0);

  const active = useMemo(
    () => CATEGORIES.find((c) => c.key === activeKey) ?? CATEGORIES[0],
    [activeKey],
  );
  const tip = active.tips[tipIdx % active.tips.length];

  function nextTip() { setTipIdx((i) => (i + 1) % active.tips.length); }
  function changeCategory(key: string) {
    setActiveKey(key);
    setTipIdx(0);
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">From Xavier&apos;s playbook</p>
        <Lightbulb className="w-3.5 h-3.5 text-[#B48B40]/40" strokeWidth={1.5} />
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const isActive = c.key === activeKey;
          return (
            <button
              key={c.key}
              onClick={() => changeCategory(c.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                isActive
                  ? "border-[#B48B40]/35 bg-[#B48B40]/10 text-[#B48B40]"
                  : "border-white/[0.08] text-white/45 hover:text-white/70 hover:border-white/15",
              )}
            >
              <span className="mr-1">{c.icon}</span>{c.label}
            </button>
          );
        })}
      </div>

      {/* Current tip */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <p className="text-xs font-semibold text-white/85 mb-1">{tip.title}</p>
        <p className="text-[11px] text-white/55 leading-relaxed">{tip.body}</p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-white/30 tabular-nums">{tipIdx + 1} / {active.tips.length}</p>
        <button
          onClick={nextTip}
          className="flex items-center gap-1 text-[11px] font-semibold text-white/45 hover:text-[#B48B40] transition-colors"
        >
          Next tip
          <ChevronRight className="w-3 h-3" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
