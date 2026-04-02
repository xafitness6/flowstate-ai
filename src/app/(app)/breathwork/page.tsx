"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_USERS } from "@/context/UserContext";
import { BreathingTimer } from "@/components/breathwork/BreathingTimer";
import {
  loadSettings, saveSettings,
  loadSessions, saveSession,
  computeAnalytics,
} from "@/lib/breathwork/store";
import { DEFAULT_SETTINGS, SPEED_INTERVAL_MS } from "@/lib/breathwork/types";
import type { BreathworkSettings, BreathworkSession, BreathworkAnalytics, BreathSpeed } from "@/lib/breathwork/types";

type Tab = "configure" | "session" | "analytics";

function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function BarChart({
  data,
  labelKey,
  valueKey,
  color = "#B48B40",
  unit = "",
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  color?: string;
  unit?: string;
}) {
  const values = data.map((d) => Number(d[valueKey]));
  const max = Math.max(...values, 1);

  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d, i) => {
        const v = Number(d[valueKey]);
        const pct = v / max;
        const label = String(d[labelKey]);
        const shortLabel = label.includes("-W") ? label.split("-W")[1] : label.slice(5);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative w-full flex items-end justify-center h-12">
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: `${Math.max(pct * 100, 4)}%`,
                  backgroundColor: v > 0 ? color : "rgba(255,255,255,0.05)",
                  opacity: v > 0 ? 0.7 + pct * 0.3 : 1,
                }}
              />
              {v > 0 && (
                <span className="absolute -top-4 text-[8px] text-white/30 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {v}{unit}
                </span>
              )}
            </div>
            <span className="text-[8px] text-white/20">{shortLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BreathworkPage() {
  const router    = useRouter();
  const [ready,   setReady]   = useState(false);
  const [tab,     setTab]     = useState<Tab>("configure");
  const [settings, setSettings] = useState<BreathworkSettings>(DEFAULT_SETTINGS);
  const [sessions, setSessions] = useState<BreathworkSession[]>([]);
  const [analytics, setAnalytics] = useState<BreathworkAnalytics | null>(null);
  const [pendingSettings, setPendingSettings] = useState<BreathworkSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let role: string | null = null;
    try {
      role = localStorage.getItem("flowstate-active-role")
          || sessionStorage.getItem("flowstate-session-role");
    } catch { /* ignore */ }

    if (!role || !DEMO_USERS[role]) {
      router.replace("/login");
      return;
    }

    const saved = loadSettings();
    setSettings(saved);
    setPendingSettings(saved);
    const s = loadSessions();
    setSessions(s);
    setAnalytics(computeAnalytics(s));
    setReady(true);
  }, [router]);

  const handleSessionComplete = useCallback(
    (partial: Omit<BreathworkSession, "id" | "completedAt">) => {
      const session: BreathworkSession = {
        ...partial,
        id: `bw-${Date.now()}`,
        completedAt: new Date().toISOString(),
      };
      saveSession(session);
      const updated = [...sessions, session];
      setSessions(updated);
      setAnalytics(computeAnalytics(updated));
    },
    [sessions]
  );

  const handleSessionEnd = useCallback(() => {
    setTab("configure");
  }, []);

  const handleSaveSettings = useCallback(() => {
    saveSettings(pendingSettings);
    setSettings(pendingSettings);
  }, [pendingSettings]);

  if (!ready) return null;

  return (
    <div className="px-5 md:px-8 py-6 text-white max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-white/25 mb-1.5">Recovery</p>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-3">
          <Wind className="w-6 h-6 text-white/30" strokeWidth={1.5} />
          Breathwork
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 p-1 rounded-xl bg-white/[0.03] border border-white/6">
        {(["configure", "session", "analytics"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "flex-1 py-2 rounded-lg text-xs font-medium tracking-wide capitalize transition-all",
              tab === t
                ? "bg-white/[0.07] text-white/80"
                : "text-white/28 hover:text-white/50",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Configure ─────────────────────────────────────────────────────────── */}
      {tab === "configure" && (
        <div className="space-y-5">

          {/* Speed selector */}
          <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-4">
            <p className="text-xs text-white/50 mb-3">Breathing speed</p>
            <div className="flex gap-2">
              {(["fast", "medium", "slow"] as BreathSpeed[]).map((s) => {
                const ms = SPEED_INTERVAL_MS[s];
                const secs = ms / 1000;
                return (
                  <button
                    key={s}
                    onClick={() => setPendingSettings((p) => ({ ...p, speed: s }))}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1.5 py-3.5 rounded-xl border text-xs font-medium transition-all capitalize",
                      pendingSettings.speed === s
                        ? "border-[#B48B40]/30 bg-[#B48B40]/8 text-[#B48B40]"
                        : "border-white/6 text-white/28 hover:border-white/15 hover:text-white/45"
                    )}
                  >
                    {s}
                    <span className="text-[9px] opacity-60 font-normal normal-case">
                      {secs}s / phase
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-white/20 mt-3 leading-relaxed">
              {pendingSettings.speed === "fast" && "Fast pacing — energising, high-volume breathwork."}
              {pendingSettings.speed === "medium" && "Medium pacing — balanced breathwork for most sessions."}
              {pendingSettings.speed === "slow" && "Slow pacing — deep, meditative, parasympathetic focus."}
            </p>
          </div>

          {/* Rounds */}
          <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-white/50">Rounds</p>
              <p className="text-sm font-semibold text-white/80 tabular-nums w-6 text-right">
                {pendingSettings.rounds}
              </p>
            </div>
            <input
              type="range" min={1} max={10} step={1}
              value={pendingSettings.rounds}
              onChange={(e) => setPendingSettings((s) => ({ ...s, rounds: Number(e.target.value) }))}
              className="w-full accent-[#B48B40] h-1 rounded-full"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-white/18">1</span>
              <span className="text-[9px] text-white/18">10</span>
            </div>
          </div>

          {/* Breaths per round */}
          <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-white/50">Breaths per round</p>
              <p className="text-sm font-semibold text-white/80 tabular-nums w-8 text-right">
                {pendingSettings.breathsPerRound}
              </p>
            </div>
            <input
              type="range" min={10} max={60} step={5}
              value={pendingSettings.breathsPerRound}
              onChange={(e) => setPendingSettings((s) => ({ ...s, breathsPerRound: Number(e.target.value) }))}
              className="w-full accent-[#B48B40] h-1 rounded-full"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-white/18">10</span>
              <span className="text-[9px] text-white/18">60</span>
            </div>
          </div>

          {/* Recovery duration */}
          <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-white/50">Recovery duration</p>
              <p className="text-sm font-semibold text-white/80 tabular-nums w-10 text-right">
                {pendingSettings.recoveryDuration}s
              </p>
            </div>
            <input
              type="range" min={5} max={30} step={5}
              value={pendingSettings.recoveryDuration}
              onChange={(e) => setPendingSettings((s) => ({ ...s, recoveryDuration: Number(e.target.value) }))}
              className="w-full accent-[#B48B40] h-1 rounded-full"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-white/18">5s</span>
              <span className="text-[9px] text-white/18">30s</span>
            </div>
          </div>

          {/* Session summary */}
          <div className="rounded-2xl border border-white/6 bg-white/[0.02] px-5 py-4">
            <div className="flex gap-6">
              <div>
                <p className="text-[9px] uppercase tracking-[0.18em] text-white/22 mb-0.5">Rounds</p>
                <p className="text-lg font-semibold text-white/70">{pendingSettings.rounds}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.18em] text-white/22 mb-0.5">Breaths</p>
                <p className="text-lg font-semibold text-white/70">
                  {pendingSettings.rounds * pendingSettings.breathsPerRound}
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.18em] text-white/22 mb-0.5">~Duration</p>
                <p className="text-lg font-semibold text-white/70">
                  {Math.round(
                    (pendingSettings.rounds * pendingSettings.breathsPerRound * (SPEED_INTERVAL_MS[pendingSettings.speed] / 1000) +
                      pendingSettings.rounds * pendingSettings.recoveryDuration) / 60
                  )}m
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSaveSettings}
              className="flex-1 py-3 rounded-2xl border border-white/8 bg-white/[0.03] text-sm text-white/40 hover:text-white/60 hover:border-white/12 transition-all"
            >
              Save defaults
            </button>
            <button
              onClick={() => {
                setSettings(pendingSettings);
                setTab("session");
              }}
              className="flex-1 py-3 rounded-2xl border border-white/12 bg-white/[0.06] text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white/90 transition-all"
            >
              Begin session
            </button>
          </div>
        </div>
      )}

      {/* ── Session ───────────────────────────────────────────────────────────── */}
      {tab === "session" && (
        <BreathingTimer
          settings={settings}
          onComplete={handleSessionComplete}
          onEnd={handleSessionEnd}
        />
      )}

      {/* ── Analytics ─────────────────────────────────────────────────────────── */}
      {tab === "analytics" && (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="rounded-2xl border border-white/6 bg-white/[0.02] px-5 py-10 text-center">
              <p className="text-xs text-white/25">No sessions yet. Complete your first session to see analytics.</p>
            </div>
          ) : (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Sessions", value: String(analytics?.totalSessions ?? 0) },
                  { label: "This week", value: String(analytics?.sessionsThisWeek ?? 0) },
                  { label: "Total rounds", value: String(analytics?.totalRounds ?? 0) },
                  { label: "Total breaths", value: String(analytics?.totalBreaths ?? 0) },
                  { label: "Avg hold", value: analytics ? `${analytics.avgHoldTime}s` : "—" },
                  { label: "Best hold", value: analytics ? `${analytics.longestHold}s` : "—" },
                  { label: "Hold time", value: analytics ? fmtSeconds(analytics.totalHoldTime) : "—" },
                  { label: "Rounds total", value: String(analytics?.totalRounds ?? 0) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3.5">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-white/22 mb-1">{label}</p>
                    <p className="text-xl font-semibold text-white/75 tabular-nums">{value}</p>
                  </div>
                ))}
              </div>

              {/* Sessions per week chart */}
              {analytics && analytics.sessionsByWeek.length > 0 && (
                <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-4">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-white/25 mb-4">
                    Sessions · last 8 weeks
                  </p>
                  <BarChart
                    data={analytics.sessionsByWeek}
                    labelKey="week"
                    valueKey="count"
                    color="#B48B40"
                  />
                </div>
              )}

              {/* Hold time trend chart */}
              {analytics && analytics.holdTrend.length > 1 && (
                <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-4">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-white/25 mb-4">
                    Avg hold · last {analytics.holdTrend.length} sessions
                  </p>
                  <BarChart
                    data={analytics.holdTrend}
                    labelKey="date"
                    valueKey="avgHold"
                    color="#6B9E78"
                    unit="s"
                  />
                </div>
              )}

              {/* Recent sessions list */}
              <div className="rounded-2xl border border-white/8 bg-[#111111] divide-y divide-white/[0.04]">
                <p className="px-5 py-3 text-[9px] uppercase tracking-[0.18em] text-white/25">
                  Recent sessions
                </p>
                {[...sessions].reverse().slice(0, 10).map((s) => (
                  <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white/55">{s.date}</p>
                      <p className="text-[10px] text-white/25 mt-0.5">
                        {s.roundsCompleted}r · {s.totalBreaths} breaths
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-[#B48B40]/70 tabular-nums">
                        {s.holdTimes.length > 0
                          ? `${Math.round(s.holdTimes.reduce((a, b) => a + b, 0) / s.holdTimes.length)}s`
                          : "—"}
                      </p>
                      <p className="text-[9px] text-white/20 mt-0.5">avg hold</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
