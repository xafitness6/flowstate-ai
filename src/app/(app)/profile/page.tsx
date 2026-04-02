"use client";

import { useState } from "react";
import { Camera, Check, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  member:  "text-white/55 border-white/12 bg-white/[0.03]",
  client:  "text-[#93C5FD] border-[#93C5FD]/20 bg-[#93C5FD]/5",
  trainer: "text-[#B48B40] border-[#B48B40]/25 bg-[#B48B40]/6",
  master:  "text-emerald-400 border-emerald-400/22 bg-emerald-400/5",
};

const ROLE_LABELS: Record<string, string> = {
  member:  "Member",
  client:  "Client",
  trainer: "Trainer",
  master:  "Admin",   // internal "master" role displays as "Admin"
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  member:  "Self-directed access to training and nutrition.",
  client:  "Coached by a trainer. Plan managed externally.",
  trainer: "Manages clients, assigns programs, reviews progress.",
  master:  "Full system access. Administration and all data.",
};

const PUSH_LABELS: Record<number, { label: string; color: string }> = {
  1:  { label: "Easy",       color: "text-white/50"  },
  2:  { label: "Easy",       color: "text-white/50"  },
  3:  { label: "Light",      color: "text-white/60"  },
  4:  { label: "Light",      color: "text-white/60"  },
  5:  { label: "Average",    color: "text-white/70"  },
  6:  { label: "Average",    color: "text-white/70"  },
  7:  { label: "Hard",       color: "text-amber-400" },
  8:  { label: "Hard",       color: "text-amber-400" },
  9:  { label: "Extra hard", color: "text-[#F87171]" },
  10: { label: "Extra hard", color: "text-[#F87171]" },
};

const PUSH_BAND_LABELS = [
  { label: "Easy",       pos: "left-[5%]"  },
  { label: "Light",      pos: "left-[27%]" },
  { label: "Average",    pos: "left-[47%]" },
  { label: "Hard",       pos: "left-[67%]" },
  { label: "Extra hard", pos: "left-[84%]" },
];

const COACHING_TONES     = [{ value: "direct", label: "Direct" }, { value: "supportive", label: "Supportive" }, { value: "analytical", label: "Analytical" }];
const PROFANITY_OPTIONS  = [{ value: "off", label: "Off" }, { value: "mild", label: "Mild" }];
const STYLE_OPTIONS      = [{ value: "lite", label: "Lite" }, { value: "pro", label: "Pro" }];
const UNIT_SYSTEMS       = [{ value: "metric", label: "Metric" }, { value: "imperial", label: "Imperial" }];
const DASHBOARD_DEFAULTS = [{ value: "overview", label: "Overview" }, { value: "program", label: "Program" }, { value: "nutrition", label: "Nutrition" }, { value: "accountability", label: "Accountability" }];

// ─── Coach preview samples ────────────────────────────────────────────────────
// Shows a live example of how the current settings combination sounds.

const COACH_PREVIEW: Record<string, string> = {
  "off_pro":   "Here's today stripped down. Keep the two main lifts — Lat Pulldown and Seated Row. Those are your highest-value movements. Drop Face Pull and Bicep Curl entirely. Total time: 25–30 minutes.",
  "off_lite":  "Two lifts: Lat Pulldown and Seated Row. Drop the rest. 25–30 minutes.",
  "mild_pro":  "Here's what actually matters today. Two lifts — Lat Pulldown and Seated Row. Drop the Face Pull and Bicep Curl; they're accessories. You're not losing a damn thing by cutting them. Get the two lifts done.",
  "mild_lite": "Two lifts: Lat Pulldown and Seated Row. Everything else is filler — drop it. Get it done.",
};
const STATUS_CONFIG      = {
  active: { label: "Online",  ring: "ring-[#4ADE80]/60", dot: "bg-[#4ADE80]" },
  rest:   { label: "Resting", ring: "ring-[#FBBF24]/50", dot: "bg-[#FBBF24]" },
  off:    { label: "Offline", ring: "ring-[#525252]/40", dot: "bg-[#525252]"  },
};

const PUSH_CHANGE_LIMIT = 2;

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-3">{children}</p>;
}

function SettingsCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-white/6 bg-[#111111] overflow-hidden", className)}>
      {children}
    </div>
  );
}

function SettingsRow({
  label,
  description,
  children,
  last,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between gap-6 px-5 py-4",
      !last && "border-b border-white/[0.045]"
    )}>
      <div className="min-w-0">
        <p className="text-sm text-white/75">{label}</p>
        {description && <p className="text-xs text-white/30 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function PillToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/8 bg-white/[0.02] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
            value === opt.value ? "bg-[#B48B40] text-black" : "text-white/38 hover:text-white/65"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn("relative rounded-full transition-all duration-200", enabled ? "bg-[#B48B40]" : "bg-white/10")}
      style={{ height: "22px", width: "40px" }}
    >
      <span
        className={cn("absolute top-0.5 rounded-full bg-white shadow transition-all duration-200", enabled ? "left-[18px]" : "left-0.5")}
        style={{ width: "18px", height: "18px" }}
      />
    </button>
  );
}

// ─── Push level slider ────────────────────────────────────────────────────────

function PushLevelSlider({
  value,
  onChange,
  changesUsed,
  coachOverride,
}: {
  value: number;
  onChange: (v: number) => void;
  changesUsed: number;
  coachOverride?: number;
}) {
  const isCoachSet  = coachOverride !== undefined;
  const isLimitHit  = changesUsed >= PUSH_CHANGE_LIMIT;
  const isDisabled  = isCoachSet || isLimitHit;
  const displayVal  = isCoachSet ? coachOverride! : value;
  const cfg         = PUSH_LABELS[displayVal] ?? PUSH_LABELS[6];
  const remaining   = PUSH_CHANGE_LIMIT - changesUsed;
  const fillPct     = ((displayVal - 1) / 9) * 100;

  const today      = new Date();
  const resetDate  = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const resetLabel = resetDate.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  return (
    <div className="px-5 py-5 border-b border-white/[0.045]">
      {/* Label row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-white/75">Training difficulty</p>
          <p className="text-xs text-white/30 mt-0.5">How hard the AI pushes your training load.</p>
        </div>
        <div className="text-right">
          <span className={cn("text-sm font-semibold tabular-nums", cfg.color)}>
            {displayVal}
          </span>
          <span className="text-xs text-white/30 ml-1">— {cfg.label}</span>
        </div>
      </div>

      {/* Slider */}
      <div className={cn("relative", isDisabled && "opacity-40 pointer-events-none")}>
        {/* Track */}
        <div className="relative h-1.5 rounded-full bg-white/8">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-[#B48B40] transition-all"
            style={{ width: `${fillPct}%` }}
          />
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={displayVal}
            onChange={(e) => {
              if (!isDisabled) onChange(Number(e.target.value));
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            style={{ margin: 0 }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#B48B40] border-2 border-[#0A0A0A] shadow transition-all pointer-events-none"
            style={{ left: `calc(${fillPct}% - 8px)` }}
          />
        </div>

        {/* Band labels */}
        <div className="relative mt-3 h-4">
          {PUSH_BAND_LABELS.map(({ label, pos }) => (
            <span
              key={label}
              className={cn("absolute text-[10px] text-white/18 -translate-x-1/2", pos)}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Status line */}
      <div className="mt-4">
        {isCoachSet ? (
          <p className="text-xs text-white/28">Set by your coach.</p>
        ) : isLimitHit ? (
          <p className="text-xs text-white/22">No changes remaining. Resets {resetLabel}.</p>
        ) : remaining === 1 ? (
          <p className="text-xs text-amber-400/60">1 change remaining this month.</p>
        ) : (
          <p className="text-xs text-white/28">{remaining} changes remaining this month.</p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user } = useUser();

  const [pushLevel,       setPushLevel]       = useState(user.pushLevel ?? 6);
  const [pushChangesUsed, setPushChangesUsed] = useState(0);
  const [coachingTone,    setCoachingTone]    = useLocalStorage<string>("coach-tone",      "direct");
  const [profanity,       setProfanity]       = useLocalStorage<string>("coach-profanity", "off");
  const [coachStyle,      setCoachStyle]      = useLocalStorage<string>("coach-style",     "pro");
  const [units,           setUnits]           = useState("metric");
  const [dashboardDefault, setDashboardDefault] = useLocalStorage<string>("dashboard-default", "overview");
  const [notifWorkout,    setNotifWorkout]    = useState(true);
  const [notifNutrition,  setNotifNutrition]  = useState(true);
  const [notifAI,         setNotifAI]         = useState(true);
  const [notifWeekly,     setNotifWeekly]     = useState(false);
  const [savedFlash,      setSavedFlash]      = useState(false);

  const statusCfg = STATUS_CONFIG[user.status];
  const initials  = user.name.split(" ").map((n) => n[0]).join("").toUpperCase();

  function handlePushChange(v: number) {
    if (pushChangesUsed >= PUSH_CHANGE_LIMIT) return;
    if (v === pushLevel) return;
    setPushLevel(v);
    setPushChangesUsed((n) => n + 1);
  }

  function handleSave() {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  return (
    <div className="px-5 md:px-8 py-6 max-w-2xl mx-auto space-y-8 text-white">

      {/* ── Profile header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <div className={cn(
            "w-20 h-20 rounded-full ring-2 ring-offset-2 ring-offset-[#0A0A0A] flex items-center justify-center bg-[#1C1C1C] border border-white/8",
            statusCfg.ring
          )}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
              : <span className="text-xl font-semibold text-white/60 tracking-tight">{initials}</span>
            }
          </div>
          <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#1C1C1C] border border-white/12 flex items-center justify-center hover:bg-[#222] transition-colors">
            <Camera className="w-3.5 h-3.5 text-white/40" strokeWidth={1.5} />
          </button>
          <span className={cn("absolute top-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-[#0A0A0A]", statusCfg.dot)} />
        </div>

        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-white/90">{user.name}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={cn(
              "text-[10px] font-semibold tracking-[0.1em] uppercase px-2 py-0.5 rounded-md border",
              ROLE_COLOR[user.role]
            )}>
              {ROLE_LABELS[user.role]}
            </span>
            <span className="text-xs text-white/28">{statusCfg.label}</span>
          </div>
          <p className="text-xs text-white/35 mt-1.5">{ROLE_DESCRIPTIONS[user.role]}</p>
        </div>
      </div>

      {/* ── Role ────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Role</SectionLabel>
        <SettingsCard>
          <SettingsRow
            label="Access level"
            description={ROLE_DESCRIPTIONS[user.role]}
            last={user.role !== "master"}
          >
            <span className={cn(
              "text-[10px] font-semibold tracking-[0.1em] uppercase px-2 py-0.5 rounded-md border",
              ROLE_COLOR[user.role]
            )}>
              {ROLE_LABELS[user.role]}
            </span>
          </SettingsRow>

          {/* Admin-only: link to operator dashboard */}
          {user.role === "master" && (
            <div className="px-5 py-3.5 flex items-center justify-between">
              <p className="text-xs text-white/30">Manage user roles in the operator dashboard.</p>
              <Link
                href="/admin"
                className="flex items-center gap-1.5 text-xs text-[#B48B40]/70 hover:text-[#B48B40] transition-colors"
              >
                <LayoutDashboard className="w-3 h-3" strokeWidth={1.5} />
                Open
              </Link>
            </div>
          )}
        </SettingsCard>
      </div>

      {/* ── Coaching ────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Coaching</SectionLabel>
        <SettingsCard>
          <SettingsRow label="Coaching tone" description="How your AI coach communicates with you.">
            <PillToggle options={COACHING_TONES} value={coachingTone} onChange={setCoachingTone} />
          </SettingsRow>

          <SettingsRow
            label="Profanity"
            description="Mild uses natural, light language. Never rude or excessive."
          >
            <PillToggle options={PROFANITY_OPTIONS} value={profanity ?? "off"} onChange={setProfanity} />
          </SettingsRow>

          <PushLevelSlider
            value={pushLevel}
            onChange={handlePushChange}
            changesUsed={pushChangesUsed}
            coachOverride={user.coachOverridePushLevel}
          />

          <SettingsRow
            label="Explanation style"
            description="Lite is shorter and direct. Pro is detailed and analytical."
          >
            <PillToggle options={STYLE_OPTIONS} value={coachStyle ?? "pro"} onChange={setCoachStyle} />
          </SettingsRow>

          {/* Live sample preview */}
          <div className="px-5 py-4 border-t border-white/[0.045]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/22">Sample output</span>
              <span className="text-[10px] text-white/15">·</span>
              <span className="text-[10px] text-white/18 italic">
                {coachingTone === "direct" ? "Direct" : coachingTone === "supportive" ? "Supportive" : "Analytical"}
                {" · "}
                {(profanity ?? "off") === "mild" ? "Mild" : "No profanity"}
                {" · "}
                {(coachStyle ?? "pro") === "lite" ? "Lite" : "Pro"}
              </span>
            </div>

            <div className="space-y-2">
              {/* User prompt */}
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-tr-sm bg-[#B48B40]/10 border border-[#B48B40]/15 px-3.5 py-2 max-w-[70%]">
                  <p className="text-xs text-white/55">&ldquo;Simplify today&rsquo;s session.&rdquo;</p>
                </div>
              </div>

              {/* AI response */}
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-[#1C1C1C] border border-[#B48B40]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[#B48B40] text-[8px] leading-none">◈</span>
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-[#111111] border border-white/6 px-3.5 py-2.5 flex-1">
                  <p className="text-xs text-white/65 leading-relaxed">
                    {COACH_PREVIEW[`${profanity ?? "off"}_${coachStyle ?? "pro"}`]}
                  </p>
                </div>
              </div>
            </div>

            {coachingTone !== "direct" && (
              <p className="text-[10px] text-white/18 mt-2.5 pl-7">
                Profanity and style apply across all tones. The sample above uses the Direct tone for the clearest contrast.
              </p>
            )}
          </div>

          <SettingsRow label="Units" description="Weight, distance, and measurement display." last>
            <PillToggle options={UNIT_SYSTEMS} value={units} onChange={setUnits} />
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* ── Display ─────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Display</SectionLabel>
        <SettingsCard>
          <SettingsRow label="Default dashboard" description="Which tab loads first when you open the app." last>
            <PillToggle options={DASHBOARD_DEFAULTS} value={dashboardDefault} onChange={setDashboardDefault} />
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* ── Notifications ───────────────────────────────────────────── */}
      <div>
        <SectionLabel>Notifications</SectionLabel>
        <SettingsCard>
          <SettingsRow label="Workout reminders" description="Alerts before scheduled sessions.">
            <Toggle enabled={notifWorkout} onChange={setNotifWorkout} />
          </SettingsRow>
          <SettingsRow label="Nutrition check-ins" description="Midday and evening meal prompts.">
            <Toggle enabled={notifNutrition} onChange={setNotifNutrition} />
          </SettingsRow>
          <SettingsRow label="AI adjustments" description="Notify when your plan is recalibrated.">
            <Toggle enabled={notifAI} onChange={setNotifAI} />
          </SettingsRow>
          <SettingsRow label="Weekly summary" description="Performance and progress recap every Monday." last>
            <Toggle enabled={notifWeekly} onChange={setNotifWeekly} />
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* ── Account ─────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Account</SectionLabel>
        <SettingsCard>
          <SettingsRow label="Email">
            <span className="text-xs text-white/30 font-mono">xavier@flowstate.ai</span>
          </SettingsRow>
          <SettingsRow label="Member since">
            <span className="text-xs text-white/30">Jan 2025</span>
          </SettingsRow>
          <SettingsRow label="Plan" last>
            <span className="text-xs font-semibold text-[#B48B40] tracking-wide uppercase">Pro</span>
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* ── Save ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 pb-8">
        <p className="text-xs text-white/22">Changes save to your profile immediately.</p>
        <button
          onClick={handleSave}
          className={cn(
            "rounded-xl px-6 py-2.5 text-sm font-semibold tracking-wide transition-all",
            savedFlash
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-400/25"
              : "bg-[#B48B40] text-black hover:bg-[#c99840]"
          )}
        >
          {savedFlash ? "Saved" : "Save changes"}
        </button>
      </div>

    </div>
  );
}
