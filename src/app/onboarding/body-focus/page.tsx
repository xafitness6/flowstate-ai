"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionKey, resolvePostLoginRoute, ROLE_TO_USER_ID } from "@/lib/routing";
import { completeBodyFocus, type BodyFocusArea } from "@/lib/onboarding";

// ─── Body regions ─────────────────────────────────────────────────────────────

type Region = {
  id:    BodyFocusArea;
  label: string;
  side:  "front" | "back";
  // SVG path or circle data
  cx?: number; cy?: number; rx?: number; ry?: number;
  d?:  string;
};

const FRONT_REGIONS: Region[] = [
  { id: "chest",      label: "Chest",      side: "front", cx: 100, cy: 105, rx: 30, ry: 18 },
  { id: "shoulders",  label: "Shoulders",  side: "front", cx: 100, cy: 78,  rx: 48, ry: 10 },
  { id: "biceps",     label: "Biceps",     side: "front", cx: 100, cy: 120, rx: 48, ry: 10 },
  { id: "abs",        label: "Abs",        side: "front", cx: 100, cy: 150, rx: 22, ry: 28 },
  { id: "quads",      label: "Quads",      side: "front", cx: 100, cy: 215, rx: 35, ry: 25 },
  { id: "calves",     label: "Calves",     side: "front", cx: 100, cy: 280, rx: 25, ry: 18 },
];

const BACK_REGIONS: Region[] = [
  { id: "traps",      label: "Traps",      side: "back",  cx: 100, cy: 78,  rx: 30, ry: 12 },
  { id: "upper_back", label: "Upper back", side: "back",  cx: 100, cy: 105, rx: 32, ry: 18 },
  { id: "lats",       label: "Lats",       side: "back",  cx: 100, cy: 125, rx: 40, ry: 14 },
  { id: "triceps",    label: "Triceps",    side: "back",  cx: 100, cy: 118, rx: 48, ry: 9  },
  { id: "lower_back", label: "Lower back", side: "back",  cx: 100, cy: 155, rx: 22, ry: 14 },
  { id: "glutes",     label: "Glutes",     side: "back",  cx: 100, cy: 183, rx: 32, ry: 16 },
  { id: "hamstrings", label: "Hamstrings", side: "back",  cx: 100, cy: 218, rx: 28, ry: 22 },
];

// All region labels for the chip list
const ALL_REGIONS: { id: BodyFocusArea; label: string; group: string }[] = [
  { id: "chest",      label: "Chest",       group: "Upper" },
  { id: "shoulders",  label: "Shoulders",   group: "Upper" },
  { id: "biceps",     label: "Biceps",      group: "Upper" },
  { id: "triceps",    label: "Triceps",     group: "Upper" },
  { id: "traps",      label: "Traps",       group: "Upper" },
  { id: "upper_back", label: "Upper back",  group: "Back"  },
  { id: "lats",       label: "Lats",        group: "Back"  },
  { id: "lower_back", label: "Lower back",  group: "Back"  },
  { id: "abs",        label: "Abs",         group: "Core"  },
  { id: "forearms",   label: "Forearms",    group: "Arms"  },
  { id: "glutes",     label: "Glutes",      group: "Lower" },
  { id: "quads",      label: "Quads",       group: "Lower" },
  { id: "hamstrings", label: "Hamstrings",  group: "Lower" },
  { id: "calves",     label: "Calves",      group: "Lower" },
];

// ─── Body SVG ─────────────────────────────────────────────────────────────────

function BodyDiagram({
  side,
  regions,
  selected,
  primaryFocus,
  onToggle,
}: {
  side:         "front" | "back";
  regions:      Region[];
  selected:     Set<BodyFocusArea>;
  primaryFocus: BodyFocusArea | null;
  onToggle:     (id: BodyFocusArea) => void;
}) {
  return (
    <svg viewBox="0 0 200 320" className="w-full h-full" style={{ maxHeight: 280 }}>
      {/* Body silhouette */}
      {side === "front" ? (
        <g opacity="0.15" fill="#ffffff">
          {/* Head */}
          <ellipse cx="100" cy="30" rx="18" ry="22" />
          {/* Neck */}
          <rect x="92" y="48" width="16" height="14" rx="4" />
          {/* Torso */}
          <path d="M60 62 C50 68 46 90 46 130 L154 130 C154 90 150 68 140 62 Z" />
          {/* Arms */}
          <path d="M46 68 C38 75 34 100 36 130 L50 130 L56 90 Z" />
          <path d="M154 68 C162 75 166 100 164 130 L150 130 L144 90 Z" />
          {/* Forearms */}
          <path d="M36 130 C34 155 36 175 40 190 L52 190 L50 130 Z" />
          <path d="M164 130 C166 155 164 175 160 190 L148 190 L150 130 Z" />
          {/* Legs */}
          <path d="M70 130 C65 180 64 230 66 280 L94 280 L95 180 L100 155 L105 180 L106 280 L134 280 C136 230 135 180 130 130 Z" />
        </g>
      ) : (
        <g opacity="0.15" fill="#ffffff">
          <ellipse cx="100" cy="30" rx="18" ry="22" />
          <rect x="92" y="48" width="16" height="14" rx="4" />
          <path d="M62 62 C52 68 48 90 48 130 L152 130 C152 90 148 68 138 62 Z" />
          <path d="M48 68 C40 75 36 100 38 130 L52 130 L58 90 Z" />
          <path d="M152 68 C160 75 164 100 162 130 L148 130 L142 90 Z" />
          <path d="M38 130 C36 155 38 175 42 190 L54 190 L52 130 Z" />
          <path d="M162 130 C164 155 162 175 158 190 L146 190 L148 130 Z" />
          <path d="M70 130 C65 180 64 230 66 280 L94 280 L95 180 L100 155 L105 180 L106 280 L134 280 C136 230 135 180 130 130 Z" />
        </g>
      )}

      {/* Clickable regions */}
      {regions.map((r) => {
        const isSelected = selected.has(r.id);
        const isPrimary  = primaryFocus === r.id;
        return (
          <ellipse
            key={r.id}
            cx={r.cx}
            cy={r.cy}
            rx={r.rx}
            ry={r.ry}
            fill={isPrimary ? "#B48B40" : isSelected ? "#B48B4055" : "#ffffff10"}
            stroke={isPrimary ? "#B48B40" : isSelected ? "#B48B4080" : "#ffffff20"}
            strokeWidth={isSelected ? 1.5 : 1}
            className="cursor-pointer transition-all duration-150"
            onClick={() => onToggle(r.id)}
            style={{ filter: isSelected ? "drop-shadow(0 0 4px rgba(180,139,64,0.4))" : "none" }}
          />
        );
      })}

      {/* Labels */}
      {regions.map((r) => {
        const isSelected = selected.has(r.id);
        if (!isSelected) return null;
        return (
          <text
            key={`label-${r.id}`}
            x={r.cx}
            y={(r.cy ?? 0) + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            className="pointer-events-none"
            fontSize="7"
            fontWeight="600"
            fill={primaryFocus === r.id ? "#000" : "#fff"}
            opacity="0.9"
          >
            {r.label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BodyFocusPage() {
  const router   = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  const [selected,     setSelected]     = useState<Set<BodyFocusArea>>(new Set());
  const [primaryFocus, setPrimaryFocus] = useState<BodyFocusArea | null>(null);
  const [diagramSide,  setDiagramSide]  = useState<"front" | "back">("front");
  const [msgVisible,   setMsgVisible]   = useState(false);

  useEffect(() => {
    const key = getSessionKey();
    if (!key || key === "master") { router.replace("/login"); return; }
    setUserId(ROLE_TO_USER_ID[key] ?? key);
    setTimeout(() => setMsgVisible(true), 100);
  }, [router]);

  function toggleRegion(id: BodyFocusArea) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (primaryFocus === id) setPrimaryFocus(null);
      } else {
        next.add(id);
        // First selection becomes primary
        if (next.size === 1) setPrimaryFocus(id);
      }
      return next;
    });
  }

  function setPrimary(id: BodyFocusArea) {
    if (!selected.has(id)) {
      setSelected((prev) => new Set([...prev, id]));
    }
    setPrimaryFocus(id);
  }

  function handleContinue() {
    if (!userId || selected.size === 0) return;
    completeBodyFocus(userId, Array.from(selected), primaryFocus);
    router.push("/onboarding/coach-planning");
  }

  const diagramRegions = diagramSide === "front" ? FRONT_REGIONS : BACK_REGIONS;
  const canContinue    = selected.size > 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center px-5 py-10 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[#B48B40]/[0.04] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md space-y-8">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
          <span className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate AI</span>
        </div>

        {/* Heading */}
        <div className={cn("transition-all duration-500", msgVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")}>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Where do you want to focus?</h1>
          <p className="text-sm text-white/40">Select your priority areas. This shapes your program splits and exercise selection.</p>
        </div>

        <div className="grid grid-cols-[1fr_1.2fr] gap-6 items-start">
          {/* Left: diagram */}
          <div className="space-y-3">
            {/* Front/back toggle */}
            <div className="flex gap-1.5">
              {(["front", "back"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setDiagramSide(s)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-[11px] font-medium capitalize transition-all",
                    diagramSide === s
                      ? "bg-white/8 text-white/80"
                      : "text-white/28 hover:text-white/50"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <BodyDiagram
              side={diagramSide}
              regions={diagramRegions}
              selected={selected}
              primaryFocus={primaryFocus}
              onToggle={toggleRegion}
            />
            <p className="text-[10px] text-white/22 text-center">Tap to select regions</p>
          </div>

          {/* Right: chip list */}
          <div className="space-y-4">
            {["Upper", "Back", "Core", "Arms", "Lower"].map((group) => {
              const inGroup = ALL_REGIONS.filter((r) => r.group === group);
              return (
                <div key={group} className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">{group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {inGroup.map((r) => {
                      const isSelected = selected.has(r.id);
                      const isPrimary  = primaryFocus === r.id;
                      return (
                        <button
                          key={r.id}
                          onClick={() => isPrimary ? toggleRegion(r.id) : isSelected ? setPrimary(r.id) : toggleRegion(r.id)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all",
                            isPrimary
                              ? "bg-[#B48B40]/20 border-[#B48B40]/50 text-[#B48B40]"
                              : isSelected
                              ? "bg-white/8 border-white/15 text-white/75"
                              : "bg-transparent border-white/8 text-white/30 hover:border-white/20 hover:text-white/55"
                          )}
                        >
                          {isPrimary && <Check className="inline w-2.5 h-2.5 mr-1 -mt-px" strokeWidth={2.5} />}
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {primaryFocus && (
              <p className="text-[10px] text-white/30 leading-relaxed">
                <span className="text-[#B48B40]/70">
                  {ALL_REGIONS.find((r) => r.id === primaryFocus)?.label}
                </span>{" "}
                is your primary focus. Tap any selected area to make it primary.
              </p>
            )}
          </div>
        </div>

        {/* Selected summary */}
        {selected.size > 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-3.5">
            <p className="text-xs text-white/40 leading-relaxed">
              <span className="text-white/60 font-medium">{selected.size} area{selected.size !== 1 ? "s" : ""} selected</span>
              {primaryFocus && <> · Primary: <span className="text-[#B48B40]/80">{ALL_REGIONS.find((r) => r.id === primaryFocus)?.label}</span></>}
            </p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className={cn(
            "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all duration-200",
            canContinue
              ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
              : "bg-white/5 text-white/25 cursor-default"
          )}
        >
          Continue <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
