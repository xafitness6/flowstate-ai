"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useUser, DEMO_USERS } from "@/context/UserContext";
import {
  seedDemoData,
  resetAllData,
  simulateFirstRun,
  seedMissedDays,
} from "@/lib/seedData";

type DemoKey = keyof typeof DEMO_USERS;

const ROLE_COLORS: Record<string, string> = {
  master:  "text-emerald-400 border-emerald-400/25 bg-emerald-400/8",
  trainer: "text-[#B48B40] border-[#B48B40]/25 bg-[#B48B40]/8",
  client:  "text-[#93C5FD] border-[#93C5FD]/25 bg-[#93C5FD]/8",
  member:  "text-white/50 border-white/12 bg-white/[0.04]",
};

const ROLE_DISPLAY: Record<string, string> = {
  master:  "Admin",
  trainer: "Trainer",
  client:  "Client",
  member:  "Member",
};

function flash(setFn: (v: string) => void, msg: string) {
  setFn(msg);
  setTimeout(() => setFn(""), 1800);
}

// ── Panel content ─────────────────────────────────────────────────────────────

function PanelContent({
  user,
  status,
  handleSeed,
  handleMissedDays,
  handleFirstRun,
  handleReset,
  handleSwitch,
}: {
  user: (typeof DEMO_USERS)[DemoKey];
  status: string;
  handleSeed: () => void;
  handleMissedDays: () => void;
  handleFirstRun: () => void;
  handleReset: () => void;
  handleSwitch: (key: DemoKey) => void;
}) {
  return (
    <>
      {/* Current user */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <p className="text-[9px] uppercase tracking-[0.18em] text-white/22 mb-1.5">Active user</p>
        <p className="text-sm font-semibold text-white/85">{user.name}</p>
        <span className={cn(
          "inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border capitalize",
          ROLE_COLORS[user.role]
        )}>
          {ROLE_DISPLAY[user.role] ?? user.role}
        </span>
      </div>

      {/* Role switcher */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <p className="text-[9px] uppercase tracking-[0.18em] text-white/22 mb-2">Switch user</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(DEMO_USERS) as DemoKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handleSwitch(key)}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-[10px] font-medium capitalize transition-all",
                user.role === DEMO_USERS[key].role
                  ? ROLE_COLORS[key]
                  : "border-white/8 text-white/35 hover:border-white/18 hover:text-white/55"
              )}
            >
              {ROLE_DISPLAY[key] ?? key}
            </button>
          ))}
        </div>
      </div>

      {/* Data controls */}
      <div className="px-4 py-3 space-y-1.5">
        <p className="text-[9px] uppercase tracking-[0.18em] text-white/22 mb-2">Data</p>
        {[
          { label: "Seed 21 days",       action: handleSeed,       color: "text-emerald-400/80 border-emerald-400/20 hover:bg-emerald-400/6" },
          { label: "Seed missed days",   action: handleMissedDays, color: "text-amber-400/80 border-amber-400/20 hover:bg-amber-400/5" },
          { label: "Simulate first run", action: handleFirstRun,   color: "text-[#93C5FD]/80 border-[#93C5FD]/20 hover:bg-[#93C5FD]/5" },
          { label: "Reset all data",     action: handleReset,      color: "text-[#F87171]/70 border-[#F87171]/20 hover:bg-[#F87171]/5" },
        ].map(({ label, action, color }) => (
          <button
            key={label}
            onClick={action}
            className={cn(
              "w-full text-left text-[11px] font-medium px-3 py-2 rounded-xl border transition-all",
              color
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Status flash */}
      {status && (
        <div className="px-4 py-2.5 border-t border-white/[0.06]">
          <p className="text-[11px] text-emerald-400/80">{status}</p>
        </div>
      )}

      {/* Quick nav */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <p className="text-[9px] uppercase tracking-[0.18em] text-white/22 mb-2">Quick nav</p>
        <div className="flex flex-wrap gap-1">
          {["/", "/onboarding", "/program", "/coach", "/accountability", "/admin", "/pricing", "/calendar", "/dev"].map((href) => (
            <a
              key={href}
              href={href}
              className="text-[10px] text-white/30 hover:text-white/60 border border-white/8 rounded-md px-1.5 py-0.5 transition-colors"
            >
              {href === "/" ? "home" : href.replace("/", "")}
            </a>
          ))}
        </div>
      </div>
    </>
  );
}

// ── DevPanel ──────────────────────────────────────────────────────────────────
// forceOpen=true  → inline mode for /dev page, no floating toggle
// forceOpen=false → floating badge in bottom-left corner (legacy, not in layout)

export function DevPanel({ forceOpen = false }: { forceOpen?: boolean }) {
  const { user, switchUser } = useUser();
  const [open,   setOpen  ] = useState(forceOpen);
  const [status, setStatus] = useState("");

  function handleSeed() {
    seedDemoData();
    flash(setStatus, "Seeded 21 days ✓");
    setTimeout(() => window.location.reload(), 400);
  }

  function handleReset() {
    resetAllData();
    flash(setStatus, "All data cleared ✓");
    setTimeout(() => window.location.reload(), 400);
  }

  function handleFirstRun() {
    simulateFirstRun();
    flash(setStatus, "First-run set ✓");
    setTimeout(() => window.location.reload(), 400);
  }

  function handleMissedDays() {
    seedMissedDays();
    flash(setStatus, "Missed days seeded ✓");
    setTimeout(() => window.location.reload(), 400);
  }

  function handleSwitch(key: DemoKey) {
    switchUser(key);
    flash(setStatus, `Switched to ${key} ✓`);
    setTimeout(() => window.location.reload(), 200);
  }

  const contentProps = { user, status, handleSeed, handleMissedDays, handleFirstRun, handleReset, handleSwitch };

  // Inline mode — no floating toggle, panel always visible
  if (forceOpen) {
    return (
      <div className="w-full rounded-2xl border border-white/10 bg-[#0F0F0F] overflow-hidden">
        <PanelContent {...contentProps} />
      </div>
    );
  }

  // Floating mode — toggle badge in corner
  return (
    <div className="fixed bottom-[72px] md:bottom-4 left-3 z-[300]">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold uppercase tracking-[0.12em] transition-all shadow-lg shadow-black/40",
          open
            ? "border-[#B48B40]/30 bg-[#B48B40]/10 text-[#B48B40]"
            : "border-white/10 bg-[#111111] text-white/35 hover:text-white/55"
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#B48B40] shrink-0" />
        Dev
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-56 rounded-2xl border border-white/10 bg-[#0F0F0F] shadow-2xl shadow-black/60 overflow-hidden">
          <PanelContent {...contentProps} />
        </div>
      )}
    </div>
  );
}
