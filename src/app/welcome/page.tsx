"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const SELECTED_ROLE_KEY = "flowstate-selected-role";

type PublicRole = Exclude<Role, "master">;

const ROLES: { key: PublicRole; label: string; sub: string; detail: string }[] = [
  {
    key:    "member",
    label:  "Member",
    sub:    "Self-directed performance",
    detail: "Track workouts, build habits, and hit your goals on your own timeline.",
  },
  {
    key:    "client",
    label:  "Client",
    sub:    "Full coaching experience",
    detail: "Work with a trainer, follow your program, and get guided every step.",
  },
  {
    key:    "trainer",
    label:  "Trainer",
    sub:    "Manage and coach others",
    detail: "Build programs, track clients, and run your coaching operation.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function WelcomePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<PublicRole | null>(null);

  function handleSelect(role: PublicRole) {
    setSelected(role);
    try {
      sessionStorage.setItem(SELECTED_ROLE_KEY, role);
    } catch { /* ignore */ }
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 py-16 text-white">

      {/* Ambient glow — purely decorative */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[#B48B40]/[0.04] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm space-y-10">

        {/* Brand mark */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
            <span className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate AI</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1]">
              The performance<br />
              <span className="text-white/50">operating system.</span>
            </h1>
            <p className="text-sm text-white/35 leading-relaxed">
              Choose how you use Flowstate to get started.
            </p>
          </div>
        </div>

        {/* Role cards */}
        <div className="space-y-2.5">
          {ROLES.map(({ key, label, sub, detail }) => (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              disabled={!!selected}
              className={cn(
                "w-full rounded-2xl border px-5 py-4 text-left transition-all duration-200 group",
                selected === key
                  ? "border-[#B48B40]/40 bg-[#B48B40]/8"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/14 hover:bg-white/[0.035]",
                selected && selected !== key ? "opacity-40" : ""
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <p className={cn(
                    "text-sm font-semibold transition-colors",
                    selected === key ? "text-white" : "text-white/75 group-hover:text-white/90"
                  )}>
                    {label}
                  </p>
                  <p className="text-xs text-white/35">{sub}</p>
                  <p className="text-[11px] text-white/22 leading-relaxed pt-1">{detail}</p>
                </div>
                <ArrowRight
                  className={cn(
                    "w-4 h-4 mt-0.5 shrink-0 transition-all duration-200",
                    selected === key
                      ? "text-[#B48B40]"
                      : "text-white/15 group-hover:text-white/40 group-hover:translate-x-0.5"
                  )}
                  strokeWidth={1.5}
                />
              </div>
            </button>
          ))}
        </div>

        {/* Admin access — very subtle, not for regular users */}
        <div className="text-center">
          <button
            onClick={() => router.push("/login")}
            className="text-[11px] text-white/15 hover:text-white/30 transition-colors"
          >
            Admin access
          </button>
        </div>

      </div>
    </div>
  );
}
