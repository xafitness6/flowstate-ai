"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Check, LayoutDashboard, ArrowUpRight, Edit3, Pencil, X, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { PLAN_HIERARCHY, PLAN_LABELS } from "@/lib/plans";
import type { Plan } from "@/types";
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
  master:  "Admin",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  member:  "Self-directed access to training and nutrition.",
  client:  "Coached by a trainer. Plan managed externally.",
  trainer: "Manages clients, assigns programs, reviews progress.",
  master:  "Full system access. Administration and all data.",
};

const BIO_PLACEHOLDER: Record<string, string> = {
  member:  "Share your training background, goals, and what drives you...",
  client:  "Share your goals, background, and what you're working toward...",
  trainer: "Share your coaching philosophy, specialties, and approach...",
  master:  "Describe your platform vision and focus areas...",
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

const COACH_PREVIEW: Record<string, string> = {
  "off_pro":   "Here's today stripped down. Keep the two main lifts — Lat Pulldown and Seated Row. Those are your highest-value movements. Drop Face Pull and Bicep Curl entirely. Total time: 25–30 minutes.",
  "off_lite":  "Two lifts: Lat Pulldown and Seated Row. Drop the rest. 25–30 minutes.",
  "mild_pro":  "Here's what actually matters today. Two lifts — Lat Pulldown and Seated Row. Drop the Face Pull and Bicep Curl; they're accessories. You're not losing a damn thing by cutting them. Get the two lifts done.",
  "mild_lite": "Two lifts: Lat Pulldown and Seated Row. Everything else is filler — drop it. Get it done.",
};

const STATUS_CONFIG = {
  active: { label: "Online",  ring: "ring-[#4ADE80]/60", dot: "bg-[#4ADE80]" },
  rest:   { label: "Resting", ring: "ring-[#FBBF24]/50", dot: "bg-[#FBBF24]" },
  off:    { label: "Offline", ring: "ring-[#525252]/40", dot: "bg-[#525252]"  },
};

const PUSH_CHANGE_LIMIT = 2;

const MAX_PLAN_FOR_ROLE: Record<string, Plan> = {
  member:  "performance",
  client:  "coaching",
  trainer: "coaching",
  master:  "coaching",
};

const PLAN_COLOR: Record<Plan, string> = {
  foundation:  "text-white/45",
  training:    "text-[#B48B40]",
  performance: "text-emerald-400",
  coaching:    "text-purple-400",
};

const PLAN_BADGE: Record<Plan, string> = {
  foundation:  "text-white/40 border-white/10 bg-white/[0.03]",
  training:    "text-[#B48B40] border-[#B48B40]/22 bg-[#B48B40]/6",
  performance: "text-emerald-400 border-emerald-400/20 bg-emerald-400/5",
  coaching:    "text-purple-400 border-purple-400/20 bg-purple-400/5",
};

// ─── Activity stats ───────────────────────────────────────────────────────────

const USER_STATS: Record<string, {
  sessions: number; streak: number; longestStreak: number;
  compliance: number; lastActive: string; joinedLabel: string;
}> = {
  master:  { sessions: 47, streak: 8,  longestStreak: 21, compliance: 91, lastActive: "Today",     joinedLabel: "Jan 2024" },
  trainer: { sessions: 38, streak: 5,  longestStreak: 16, compliance: 87, lastActive: "Today",     joinedLabel: "Mar 2024" },
  client:  { sessions: 24, streak: 6,  longestStreak: 14, compliance: 82, lastActive: "Today",     joinedLabel: "Sep 2024" },
  member:  { sessions: 12, streak: 2,  longestStreak: 7,  compliance: 61, lastActive: "Yesterday", joinedLabel: "Nov 2024" },
};

// Default last-action labels shown before any real action is recorded
const DEFAULT_LAST_ACTION: Record<string, string> = {
  master:  "Platform review",
  trainer: "Client check-in reviewed",
  client:  "Workout logged",
  member:  "Breathwork session",
};

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
  label, description, children, last,
}: {
  label: string; description?: string; children: React.ReactNode; last?: boolean;
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
  options, value, onChange,
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

// ─── Stat block ───────────────────────────────────────────────────────────────

function StatBlock({
  label, value, unit, bar, barColor,
}: {
  label: string; value: string | number; unit?: string;
  bar?: number; barColor?: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-white/25 uppercase tracking-[0.15em]">{label}</p>
      <p className="text-2xl font-light text-white/80 tabular-nums mt-1.5">
        {value}
        {unit && <span className="text-sm text-white/35 ml-1">{unit}</span>}
      </p>
      {bar !== undefined && (
        <div className="h-0.5 rounded-full bg-white/8 mt-2">
          <div
            className={cn("h-full rounded-full", barColor ?? "bg-[#B48B40]")}
            style={{ width: `${bar}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Push level slider ────────────────────────────────────────────────────────

function PushLevelSlider({
  value, onChange, changesUsed, coachOverride,
}: {
  value: number; onChange: (v: number) => void;
  changesUsed: number; coachOverride?: number;
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-white/75">Training difficulty</p>
          <p className="text-xs text-white/30 mt-0.5">How hard the AI pushes your training load.</p>
        </div>
        <div className="text-right">
          <span className={cn("text-sm font-semibold tabular-nums", cfg.color)}>{displayVal}</span>
          <span className="text-xs text-white/30 ml-1">— {cfg.label}</span>
        </div>
      </div>

      <div className={cn("relative", isDisabled && "opacity-40 pointer-events-none")}>
        <div className="relative h-1.5 rounded-full bg-white/8">
          <div className="absolute left-0 top-0 h-full rounded-full bg-[#B48B40] transition-all" style={{ width: `${fillPct}%` }} />
          <input
            type="range" min={1} max={10} step={1} value={displayVal}
            onChange={(e) => { if (!isDisabled) onChange(Number(e.target.value)); }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            style={{ margin: 0 }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#B48B40] border-2 border-[#0A0A0A] shadow transition-all pointer-events-none"
            style={{ left: `calc(${fillPct}% - 8px)` }}
          />
        </div>
        <div className="relative mt-3 h-4">
          {PUSH_BAND_LABELS.map(({ label, pos }) => (
            <span key={label} className={cn("absolute text-[10px] text-white/18 -translate-x-1/2", pos)}>{label}</span>
          ))}
        </div>
      </div>

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

// ─── Image compression ────────────────────────────────────────────────────────

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 2)  return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)   return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1)  return "Yesterday";
    if (diffD < 7)    return `${diffD}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "Unknown";
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user } = useUser();

  // ── Settings state ────────────────────────────────────────────────────────
  const [pushLevel,        setPushLevel]        = useState(user.pushLevel ?? 6);
  const [pushChangesUsed,  setPushChangesUsed]  = useState(0);
  const [coachingTone,     setCoachingTone]     = useLocalStorage<string>("coach-tone",        "direct");
  const [profanity,        setProfanity]        = useLocalStorage<string>("coach-profanity",   "off");
  const [coachStyle,       setCoachStyle]       = useLocalStorage<string>("coach-style",       "pro");
  const [units,            setUnits]            = useState("metric");
  const [dashboardDefault, setDashboardDefault] = useLocalStorage<string>("dashboard-default", "overview");
  const [notifWorkout,     setNotifWorkout]     = useState(true);
  const [notifNutrition,   setNotifNutrition]   = useState(true);
  const [notifAI,          setNotifAI]          = useState(true);
  const [notifWeekly,      setNotifWeekly]      = useState(false);
  const [savedFlash,       setSavedFlash]       = useState(false);

  // ── Identity ──────────────────────────────────────────────────────────────
  const [localAvatar,   setLocalAvatar]   = useLocalStorage<string>(`profile-avatar-${user.id}`, "");
  const [displayName,   setDisplayName]   = useLocalStorage<string>(`profile-name-${user.id}`, "");
  const [bio,           setBio]           = useLocalStorage<string>(`profile-bio-${user.id}`, "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError,   setAvatarError]   = useState<string | null>(null);
  const [editingBio,    setEditingBio]    = useState(false);
  const [bioInput,      setBioInput]      = useState("");
  const [editingName,   setEditingName]   = useState(false);
  const [nameInput,     setNameInput]     = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Change password ───────────────────────────────────────────────────────
  const [cpCurrent,     setCpCurrent]    = useState("");
  const [cpNew,         setCpNew]        = useState("");
  const [cpConfirm,     setCpConfirm]    = useState("");
  const [cpShowPass,    setCpShowPass]   = useState(false);
  const [cpError,       setCpError]      = useState<string | null>(null);
  const [cpSuccess,     setCpSuccess]    = useState(false);
  const [cpLoading,     setCpLoading]    = useState(false);

  // ── Activity tracking ─────────────────────────────────────────────────────
  const [lastLoginTs,  setLastLoginTs]  = useLocalStorage<string>(`flowstate-last-login-${user.id}`, "");
  const [lastActionTs, setLastActionTs] = useLocalStorage<string>(`flowstate-last-action-${user.id}`, "");
  const [lastActionType]                = useLocalStorage<string>(`flowstate-last-action-type-${user.id}`, "");
  const [prevLogin,    setPrevLogin]    = useState<string>("");

  const statusCfg     = STATUS_CONFIG[user.status];
  const initials      = (displayName || user.name).split(" ").map((n) => n[0]).join("").toUpperCase();
  const resolvedName  = displayName || user.name;
  const displayAvatar = localAvatar || user.avatarUrl;
  const stats         = USER_STATS[user.role] ?? USER_STATS.member;

  // Record this login and read previous
  useEffect(() => {
    const now = new Date().toISOString();
    setPrevLogin(lastLoginTs || "");
    setLastLoginTs(now);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

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

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setCpError(null);
    if (cpNew.length < 6)          { setCpError("New password must be at least 6 characters."); return; }
    if (cpNew !== cpConfirm)       { setCpError("Passwords do not match."); return; }
    setCpLoading(true);
    // In production: POST /api/auth/change-password { current, new }
    setTimeout(() => {
      // Store new password in localStorage (mirrors PW_KEY from reset-password)
      const emailKey = `flowstate-pw-${user.id}`;
      try { localStorage.setItem(emailKey, cpNew); } catch { /* ignore */ }
      setCpLoading(false);
      setCpSuccess(true);
      setCpCurrent(""); setCpNew(""); setCpConfirm("");
      setTimeout(() => setCpSuccess(false), 3000);
    }, 600);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    if (!file.type.startsWith("image/")) {
      setAvatarError("Select a jpg or png image.");
      e.target.value = ""; return;
    }
    try {
      const compressed = await compressImage(file);
      setAvatarPreview(compressed);
    } catch {
      setAvatarError("Failed to process image. Try again.");
    }
    e.target.value = "";
  }

  function confirmAvatar() {
    if (avatarPreview) { setLocalAvatar(avatarPreview); setAvatarPreview(null); }
  }
  function cancelAvatar() { setAvatarPreview(null); setAvatarError(null); }

  function startEditBio() { setBioInput(bio); setEditingBio(true); }
  function saveBio()      { setBio(bioInput.trim()); setEditingBio(false); }

  function startEditName() { setNameInput(resolvedName); setEditingName(true); }
  function saveName() {
    const trimmed = nameInput.trim();
    if (trimmed) setDisplayName(trimmed);
    setEditingName(false);
  }

  // ── Derived display ────────────────────────────────────────────────────────

  const complianceColor =
    stats.compliance >= 80 ? "bg-[#B48B40]" :
    stats.compliance >= 60 ? "bg-amber-500/60" : "bg-red-500/50";

  const lastLoginDisplay = prevLogin ? formatTimestamp(prevLogin) : "First session";
  const lastActionDisplay = lastActionTs
    ? `${lastActionType || DEFAULT_LAST_ACTION[user.role]} · ${formatTimestamp(lastActionTs)}`
    : DEFAULT_LAST_ACTION[user.role];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-5 md:px-8 py-6 max-w-2xl mx-auto space-y-8 text-white">

      {/* ── Profile card ─────────────────────────────────────────────── */}
      <SettingsCard>

        {/* Top: avatar + identity */}
        <div className="px-5 pt-5 pb-4 flex items-start gap-4">

          {/* Avatar column */}
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="relative">
              <div className={cn(
                "w-[72px] h-[72px] rounded-full ring-2 ring-offset-2 ring-offset-[#111111] flex items-center justify-center bg-[#1C1C1C] border border-white/8",
                avatarPreview ? "ring-[#B48B40]/60" : statusCfg.ring
              )}>
                {(avatarPreview ?? displayAvatar)
                  ? <img src={avatarPreview ?? displayAvatar ?? ""} alt={resolvedName} className="w-full h-full rounded-full object-cover" />
                  : <span className="text-lg font-semibold text-white/60 tracking-tight">{initials}</span>
                }
              </div>
              {!avatarPreview && (
                <button
                  onClick={() => { setAvatarError(null); fileInputRef.current?.click(); }}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#1C1C1C] border border-white/12 flex items-center justify-center hover:bg-[#222] transition-colors"
                  title="Change photo"
                >
                  <Camera className="w-3 h-3 text-white/40" strokeWidth={1.5} />
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />
              {!avatarPreview && (
                <span className={cn("absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#111111]", statusCfg.dot)} />
              )}
            </div>

            {avatarPreview && (
              <div className="flex items-center gap-1">
                <button onClick={confirmAvatar} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/22 transition-all">Save</button>
                <button onClick={cancelAvatar} className="px-2 py-0.5 rounded-md text-[10px] text-white/30 hover:text-white/55 transition-colors">✕</button>
              </div>
            )}
            {avatarError && !avatarPreview && (
              <p className="text-[9px] text-red-400/70 text-center max-w-[4.5rem] leading-tight">{avatarError}</p>
            )}
          </div>

          {/* Identity column */}
          <div className="flex-1 min-w-0 pt-0.5">

            {/* Name row */}
            <div className="flex items-center gap-2 group">
              {editingName ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                    className="bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1 text-base font-semibold text-white/90 outline-none focus:border-white/20 flex-1 min-w-0"
                    autoFocus
                  />
                  <button onClick={saveName} className="text-emerald-400/80 hover:text-emerald-400 transition-colors"><Check className="w-4 h-4" strokeWidth={2} /></button>
                  <button onClick={() => setEditingName(false)} className="text-white/25 hover:text-white/50 transition-colors"><X className="w-4 h-4" strokeWidth={1.5} /></button>
                </div>
              ) : (
                <>
                  <h1 className="text-lg font-semibold tracking-tight text-white/90 truncate">{resolvedName}</h1>
                  <button
                    onClick={startEditName}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-white/25 hover:text-white/55 hover:bg-white/[0.04] transition-all"
                    title="Edit name"
                  >
                    <Pencil className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                </>
              )}
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={cn("text-[10px] font-semibold tracking-[0.1em] uppercase px-2 py-0.5 rounded-md border", ROLE_COLOR[user.role])}>
                {ROLE_LABELS[user.role]}
              </span>
              <span className={cn("text-[10px] font-semibold tracking-[0.1em] uppercase px-2 py-0.5 rounded-md border", PLAN_BADGE[user.plan as Plan])}>
                {PLAN_LABELS[user.plan as Plan]}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cn("w-1.5 h-1.5 rounded-full", statusCfg.dot)} />
                <span className="text-[10px] text-white/30">{statusCfg.label}</span>
              </span>
            </div>

            {/* Bio */}
            <div className="mt-3">
              {editingBio ? (
                <div>
                  <textarea
                    value={bioInput}
                    onChange={(e) => setBioInput(e.target.value)}
                    rows={3}
                    placeholder={BIO_PLACEHOLDER[user.role] ?? ""}
                    className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white/70 leading-relaxed resize-none outline-none focus:border-white/14 placeholder:text-white/20"
                    autoFocus
                  />
                  <div className="flex items-center gap-2 mt-2 justify-end">
                    <button onClick={() => setEditingBio(false)} className="px-3 py-1.5 rounded-lg text-xs text-white/35 hover:text-white/55 transition-colors">Cancel</button>
                    <button onClick={saveBio} className="px-3 py-1.5 rounded-lg bg-[#B48B40]/15 border border-[#B48B40]/25 text-xs text-[#B48B40]/80 hover:text-[#B48B40] transition-all">Save</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 group/bio">
                  <p className={cn("flex-1 text-sm leading-relaxed", bio ? "text-white/60" : "text-white/22 italic")}>
                    {bio || BIO_PLACEHOLDER[user.role]}
                  </p>
                  <button
                    onClick={startEditBio}
                    className="shrink-0 opacity-0 group-hover/bio:opacity-100 p-1 rounded-md text-white/22 hover:text-white/55 hover:bg-white/[0.04] transition-all mt-0.5"
                    title="Edit bio"
                  >
                    <Edit3 className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metadata strip */}
        <div className="border-t border-white/[0.05] px-5 py-3 flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/25">Joined</span>
            <span className="text-[10px] font-medium text-white/45">{stats.joinedLabel}</span>
          </div>
          {user.role === "client" && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/25">Trainer</span>
              <span className="text-[10px] font-medium text-white/45">Alex Rivera</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/25">Last active</span>
            <span className="text-[10px] font-medium text-white/45">{stats.lastActive}</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px] text-white/22">{ROLE_DESCRIPTIONS[user.role]}</span>
          </div>
        </div>
      </SettingsCard>

      {/* ── Activity ─────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Activity</SectionLabel>
        <SettingsCard>
          <div className="px-5 py-5 grid grid-cols-2 gap-x-8 gap-y-5">
            <StatBlock label="Sessions" value={stats.sessions} />
            <StatBlock label="Current streak" value={stats.streak} unit="days" />
            <StatBlock label="Longest streak"  value={stats.longestStreak} unit="days" />
            <StatBlock
              label="Compliance · 30d"
              value={stats.compliance} unit="%"
              bar={stats.compliance}
              barColor={complianceColor}
            />
          </div>

          {/* Tracking rows */}
          <div className="border-t border-white/[0.045] divide-y divide-white/[0.04]">
            <div className="px-5 py-3 flex items-center justify-between">
              <p className="text-xs text-white/30">Last login</p>
              <p className="text-xs font-medium text-white/50">{lastLoginDisplay}</p>
            </div>
            <div className="px-5 py-3 flex items-center justify-between">
              <p className="text-xs text-white/30">Last action</p>
              <p className="text-xs font-medium text-white/50">{lastActionDisplay}</p>
            </div>
          </div>
        </SettingsCard>
      </div>

      {/* ── Role ─────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Role</SectionLabel>
        <SettingsCard>
          <SettingsRow label="Access level" description={ROLE_DESCRIPTIONS[user.role]} last={user.role !== "master"}>
            <span className={cn("text-[10px] font-semibold tracking-[0.1em] uppercase px-2 py-0.5 rounded-md border", ROLE_COLOR[user.role])}>
              {ROLE_LABELS[user.role]}
            </span>
          </SettingsRow>
          {user.role === "master" && (
            <div className="px-5 py-3.5 flex items-center justify-between">
              <p className="text-xs text-white/30">Manage user roles in the operator dashboard.</p>
              <Link href="/admin" className="flex items-center gap-1.5 text-xs text-[#B48B40]/70 hover:text-[#B48B40] transition-colors">
                <LayoutDashboard className="w-3 h-3" strokeWidth={1.5} />
                Open
              </Link>
            </div>
          )}
        </SettingsCard>
      </div>

      {/* ── Coaching ─────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Coaching</SectionLabel>
        <SettingsCard>
          <SettingsRow label="Coaching tone" description="How your AI coach communicates with you.">
            <PillToggle options={COACHING_TONES} value={coachingTone} onChange={setCoachingTone} />
          </SettingsRow>
          <SettingsRow label="Profanity" description="Mild uses natural, light language. Never rude or excessive.">
            <PillToggle options={PROFANITY_OPTIONS} value={profanity ?? "off"} onChange={setProfanity} />
          </SettingsRow>
          <PushLevelSlider value={pushLevel} onChange={handlePushChange} changesUsed={pushChangesUsed} coachOverride={user.coachOverridePushLevel} />
          <SettingsRow label="Explanation style" description="Lite is shorter and direct. Pro is detailed and analytical.">
            <PillToggle options={STYLE_OPTIONS} value={coachStyle ?? "pro"} onChange={setCoachStyle} />
          </SettingsRow>

          {/* Live preview */}
          <div className="px-5 py-4 border-t border-white/[0.045]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/22">Sample output</span>
              <span className="text-[10px] text-white/15">·</span>
              <span className="text-[10px] text-white/18 italic">
                {coachingTone === "direct" ? "Direct" : coachingTone === "supportive" ? "Supportive" : "Analytical"}
                {" · "}{(profanity ?? "off") === "mild" ? "Mild" : "No profanity"}
                {" · "}{(coachStyle ?? "pro") === "lite" ? "Lite" : "Pro"}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-tr-sm bg-[#B48B40]/10 border border-[#B48B40]/15 px-3.5 py-2 max-w-[70%]">
                  <p className="text-xs text-white/55">&ldquo;Simplify today&rsquo;s session.&rdquo;</p>
                </div>
              </div>
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

      {/* ── Display ──────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Display</SectionLabel>
        <SettingsCard>
          <SettingsRow label="Default dashboard" description="Which tab loads first when you open the app." last>
            <PillToggle options={DASHBOARD_DEFAULTS} value={dashboardDefault} onChange={setDashboardDefault} />
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* ── Notifications ────────────────────────────────────────────── */}
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

      {/* ── Security ─────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Security</SectionLabel>
        <SettingsCard>
          <form onSubmit={handleChangePassword}>
            <div className="px-5 pt-5 pb-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                  Current password
                </label>
                <div className="relative">
                  <input
                    type={cpShowPass ? "text" : "password"}
                    value={cpCurrent}
                    onChange={(e) => { setCpCurrent(e.target.value); setCpError(null); }}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={cn(
                      "w-full bg-white/[0.04] border rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder:text-white/18 outline-none transition-all",
                      cpError ? "border-red-400/30 focus:border-red-400/50" : "border-white/8 focus:border-white/20"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setCpShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/22 hover:text-white/50 transition-colors"
                    tabIndex={-1}
                  >
                    {cpShowPass
                      ? <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                      : <Eye    className="w-4 h-4" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                  New password
                </label>
                <input
                  type={cpShowPass ? "text" : "password"}
                  value={cpNew}
                  onChange={(e) => { setCpNew(e.target.value); setCpError(null); }}
                  autoComplete="new-password"
                  placeholder="Min. 6 characters"
                  className={cn(
                    "w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/18 outline-none transition-all",
                    cpError ? "border-red-400/30 focus:border-red-400/50" : "border-white/8 focus:border-white/20"
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                  Confirm new password
                </label>
                <input
                  type={cpShowPass ? "text" : "password"}
                  value={cpConfirm}
                  onChange={(e) => { setCpConfirm(e.target.value); setCpError(null); }}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  className={cn(
                    "w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/18 outline-none transition-all",
                    cpError ? "border-red-400/30 focus:border-red-400/50" : "border-white/8 focus:border-white/20"
                  )}
                />
              </div>

              {cpError && <p className="text-xs text-red-400/70">{cpError}</p>}

              <div className="flex items-center justify-between pt-1">
                <Link
                  href="/forgot-password"
                  className="text-xs text-white/22 hover:text-white/45 transition-colors"
                >
                  Forgot password?
                </Link>
                <button
                  type="submit"
                  disabled={!cpCurrent || !cpNew || !cpConfirm || cpLoading}
                  className={cn(
                    "rounded-xl px-5 py-2 text-xs font-semibold tracking-wide transition-all",
                    cpSuccess
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-400/25"
                      : cpCurrent && cpNew && cpConfirm && !cpLoading
                        ? "bg-[#B48B40] text-black hover:bg-[#c99840]"
                        : "bg-white/5 text-white/25 cursor-default"
                  )}
                >
                  {cpLoading ? "Updating…" : cpSuccess ? <><Check className="inline w-3 h-3 mr-1 -mt-0.5" strokeWidth={2.5} />Updated</> : "Update password"}
                </button>
              </div>
            </div>
          </form>
        </SettingsCard>
      </div>

      {/* ── Account ──────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Account</SectionLabel>
        <SettingsCard>
          <SettingsRow label="Email">
            <span className="text-xs text-white/30 font-mono">xavier@flowstate.ai</span>
          </SettingsRow>
          <SettingsRow label="Plan" last>
            <div className="flex items-center gap-3">
              <span className={cn("text-xs font-semibold tracking-wide uppercase", PLAN_COLOR[user.plan as Plan])}>
                {PLAN_LABELS[user.plan as Plan] ?? user.plan}
              </span>
              {user.role !== "master" && PLAN_HIERARCHY[user.plan as Plan] < PLAN_HIERARCHY[MAX_PLAN_FOR_ROLE[user.role]] && (
                <Link
                  href="/pricing"
                  className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#B48B40] border border-[#B48B40]/30 bg-[#B48B40]/8 rounded-lg px-2 py-1 hover:bg-[#B48B40]/14 transition-colors"
                >
                  Upgrade <ArrowUpRight className="w-3 h-3" strokeWidth={2} />
                </Link>
              )}
              {user.plan !== "foundation" && (
                <button
                  onClick={async () => {
                    const res = await fetch("/api/stripe/portal", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        customerId: `demo_${user.id}`,
                        returnUrl: window.location.href,
                      }),
                    });
                    const data = await res.json() as { url?: string };
                    if (data.url) window.location.href = data.url;
                  }}
                  className="text-[10px] text-white/30 hover:text-white/55 transition-colors underline underline-offset-2"
                >
                  Manage subscription
                </button>
              )}
            </div>
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* ── Save ─────────────────────────────────────────────────────── */}
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
          {savedFlash ? <><Check className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" strokeWidth={2.5} />Saved</> : "Save changes"}
        </button>
      </div>

    </div>
  );
}
