"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PILLARS = [
  { label: "Training",  sub: "Progressive, adaptive programming." },
  { label: "Nutrition", sub: "Precision intake, tracked and adjusted." },
  { label: "Recovery",  sub: "Sleep, stress, and readiness signals." },
  { label: "Execution", sub: "Daily accountability and habit scoring." },
];

export default function OnboardingPage() {
  const router  = useRouter();
  const [going, setGoing] = useState(false);

  function handleStart() {
    setGoing(true);
    router.push("/onboarding/quick-start");
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-5 md:px-8 py-12 text-white">
      <div className="max-w-lg w-full space-y-10">

        {/* Brand mark */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/22">Flowstate AI</p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
            Your performance<br />operating system.
          </h1>
          <p className="text-base text-white/40 pt-1 leading-relaxed">
            One system for training, nutrition, recovery, and daily execution.
            Adapts to your data. No guesswork.
          </p>
        </div>

        {/* Pillars */}
        <div className="grid grid-cols-2 gap-2">
          {PILLARS.map(({ label, sub }) => (
            <div key={label} className="rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3.5">
              <p className="text-sm font-semibold text-white/80 mb-0.5">{label}</p>
              <p className="text-xs text-white/30 leading-snug">{sub}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <button
            onClick={handleStart}
            disabled={going}
            className={cn(
              "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all duration-200",
              going
                ? "bg-white/5 text-white/30 cursor-default"
                : "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
            )}
          >
            {going ? "Setting up…" : "Let's go"}
            {!going && <ArrowRight className="w-4 h-4" strokeWidth={2} />}
          </button>
          <p className="text-[10px] text-white/18 text-center">
            Takes about 2 minutes.
          </p>
        </div>

      </div>
    </div>
  );
}
