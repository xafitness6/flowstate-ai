"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, Calendar, Copy, Check, RefreshCw, Loader2, AlertCircle,
  Dumbbell, Moon, CheckSquare, Bell, ChevronDown,
  Apple, Globe, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";

type Prefs = {
  feed_token:           string;
  include_workouts:     boolean;
  include_rest_days:    boolean;
  include_habits:       boolean;
  include_meal_windows: boolean;
  workout_time:         string;
  habits_time:          string;
  reminder_minutes:     number | null;
  color_workout:        string;
  color_habit:          string;
  horizon_weeks:        number;
};

const REMINDER_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: null,  label: "No reminder" },
  { value: 5,     label: "5 minutes before" },
  { value: 15,    label: "15 minutes before" },
  { value: 30,    label: "30 minutes before" },
  { value: 60,    label: "1 hour before" },
  { value: 120,   label: "2 hours before" },
];

const HORIZON_OPTIONS = [
  { value: 2,  label: "2 weeks" },
  { value: 4,  label: "4 weeks" },
  { value: 8,  label: "8 weeks" },
  { value: 12, label: "12 weeks" },
];

export default function CalendarConnectPage() {
  const [prefs,   setPrefs]   = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [copied,  setCopied]  = useState(false);

  const fetchPrefs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/preferences", { cache: "no-store" });
      const data = await res.json() as { prefs?: Prefs; error?: string };
      if (!res.ok || data.error || !data.prefs) throw new Error(data.error ?? "Failed to load");
      setPrefs(data.prefs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPrefs(); }, [fetchPrefs]);

  async function patchPrefs(patch: Partial<Prefs>) {
    if (!prefs) return;
    // Optimistic
    setPrefs({ ...prefs, ...patch });
    setSaving(true);
    try {
      const res = await fetch("/api/calendar/preferences", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      });
      const data = await res.json() as { prefs?: Prefs; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Save failed");
      if (data.prefs) setPrefs(data.prefs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      void fetchPrefs(); // resync on error
    } finally {
      setSaving(false);
    }
  }

  async function rotateToken() {
    if (!confirm("Generate a new feed URL? The old one will stop working immediately — anyone subscribed to it will need to re-subscribe.")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/calendar/preferences", { method: "POST" });
      const data = await res.json() as { prefs?: Prefs; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Rotate failed");
      if (data.prefs) setPrefs(data.prefs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rotate failed");
    } finally {
      setSaving(false);
    }
  }

  const feedUrl = prefs && typeof window !== "undefined"
    ? `${window.location.origin}/api/calendar/feed/${prefs.feed_token}`
    : "";
  // Calendar apps want webcal:// for subscribe; some apps tolerate https
  const webcalUrl = feedUrl.replace(/^https?:\/\//, "webcal://");

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  if (loading || !prefs) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white">
        <div className="flex items-center gap-2 text-sm text-white/55">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading calendar settings…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
      <div className="px-5 md:px-8 pt-6 max-w-3xl mx-auto">
        <Link
          href="/calendar"
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors mb-4"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
          Back to calendar
        </Link>

        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/35 mb-2">Sync</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Connect your calendar</h1>
          <p className="text-xs text-white/45 mt-2 max-w-lg leading-relaxed">
            Subscribe once and your training, rest days, and habits show up automatically in Google, Apple, Outlook — any calendar app. Updates auto-refresh.
          </p>
        </div>

        {error && (
          <Card className="mb-4 border-red-400/20">
            <div className="px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400/80 shrink-0 mt-0.5" strokeWidth={2} />
              <p className="text-xs text-red-300/85">{error}</p>
            </div>
          </Card>
        )}

        {/* ── Feed URL card ── */}
        <Card className="mb-6 border-[#B48B40]/20 bg-gradient-to-br from-[#B48B40]/[0.04] to-transparent">
          <div className="px-5 py-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#B48B40]" strokeWidth={2} />
                <p className="text-sm font-semibold text-white/95">Your calendar feed</p>
              </div>
              <button
                onClick={() => void rotateToken()}
                disabled={saving}
                className="text-[11px] text-white/40 hover:text-white/80 transition-colors flex items-center gap-1 disabled:opacity-40"
                title="Generate a new URL — invalidates the old one"
              >
                <RefreshCw className={cn("w-3 h-3", saving && "animate-spin")} strokeWidth={1.7} />
                Rotate
              </button>
            </div>
            <p className="text-[11px] text-white/45 mb-3 leading-relaxed">
              Copy this URL. Don&apos;t share it publicly — anyone with it can see your calendar.
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
              <code className="text-[11px] text-white/85 flex-1 truncate font-mono">{feedUrl}</code>
              <button
                onClick={() => void copyLink(feedUrl)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all flex items-center gap-1",
                  copied
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/25"
                    : "bg-[#B48B40] text-black hover:bg-[#c99840]",
                )}
              >
                {copied ? <><Check className="w-3 h-3" strokeWidth={2.5} /> Copied</> : <><Copy className="w-3 h-3" strokeWidth={2} /> Copy URL</>}
              </button>
            </div>
          </div>
        </Card>

        {/* ── Google Calendar OAuth (real-time push) ── */}
        <GoogleCalendarCard />

        {/* ── Setup instructions ── */}
        <Card className="mb-6">
          <div className="px-5 py-5">
            <SectionHeader>Set up in your calendar app (subscribe)</SectionHeader>
            <div className="space-y-3 mt-3">
              <SetupRow
                icon={Globe}
                title="Google Calendar"
                steps={[
                  "Open calendar.google.com on desktop",
                  "Left sidebar → \"Other calendars\" → click + → \"From URL\"",
                  "Paste the feed URL above → Add calendar",
                ]}
                cta={{ label: "Open Google Calendar", href: `https://calendar.google.com/calendar/u/0/r/settings/addbyurl` }}
              />
              <SetupRow
                icon={Apple}
                title="Apple Calendar (iCloud)"
                steps={[
                  "Mac: File → New Calendar Subscription → paste the URL",
                  "iPhone: open the webcal:// link from your Notes app → tap Subscribe",
                  "Set auto-refresh to ~15 min for best sync",
                ]}
                cta={{ label: "Open webcal link", href: webcalUrl }}
              />
              <SetupRow
                icon={Mail}
                title="Outlook"
                steps={[
                  "Outlook.com → Calendar → Add calendar → Subscribe from web",
                  "Paste the feed URL → Import",
                ]}
                cta={{ label: "Outlook subscribe page", href: "https://outlook.live.com/calendar/0/addcalendar" }}
              />
            </div>
          </div>
        </Card>

        {/* ── What to sync ── */}
        <Card className="mb-4">
          <div className="px-5 py-5 space-y-3">
            <SectionHeader>What to sync</SectionHeader>
            <Toggle
              icon={Dumbbell}
              label="Workouts"
              sub="Training days from your active program"
              checked={prefs.include_workouts}
              onChange={(v) => void patchPrefs({ include_workouts: v })}
            />
            <Toggle
              icon={Moon}
              label="Rest days"
              sub="Recovery / mobility days as calendar notes"
              checked={prefs.include_rest_days}
              onChange={(v) => void patchPrefs({ include_rest_days: v })}
            />
            <Toggle
              icon={CheckSquare}
              label="Daily check-ins"
              sub="Habit check-in reminder for accountability"
              checked={prefs.include_habits}
              onChange={(v) => void patchPrefs({ include_habits: v })}
            />
          </div>
        </Card>

        {/* ── When to schedule ── */}
        <Card className="mb-4">
          <div className="px-5 py-5 space-y-4">
            <SectionHeader>When to schedule</SectionHeader>
            <div className="grid grid-cols-2 gap-3">
              <TimeField
                label="Workout time"
                value={prefs.workout_time}
                onChange={(v) => void patchPrefs({ workout_time: v })}
              />
              <TimeField
                label="Daily check-in time"
                value={prefs.habits_time}
                onChange={(v) => void patchPrefs({ habits_time: v })}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">
                <Bell className="w-3 h-3 inline mr-1" strokeWidth={1.7} />
                Reminder
              </label>
              <div className="relative">
                <select
                  value={prefs.reminder_minutes === null ? "" : String(prefs.reminder_minutes)}
                  onChange={(e) => {
                    const v = e.target.value;
                    void patchPrefs({ reminder_minutes: v === "" ? null : parseInt(v) });
                  }}
                  className="w-full appearance-none bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/85 outline-none focus:border-[#B48B40]/40 transition-colors pr-9"
                >
                  {REMINDER_OPTIONS.map((opt) => (
                    <option key={String(opt.value)} value={opt.value === null ? "" : String(opt.value)} className="bg-[#1A1A1A]">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" strokeWidth={2} />
              </div>
            </div>
          </div>
        </Card>

        {/* ── Window ── */}
        <Card className="mb-4">
          <div className="px-5 py-5 space-y-3">
            <SectionHeader>How far ahead</SectionHeader>
            <div className="grid grid-cols-4 gap-2">
              {HORIZON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => void patchPrefs({ horizon_weeks: opt.value })}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-xs font-medium transition-all",
                    prefs.horizon_weeks === opt.value
                      ? "border-[#B48B40]/40 bg-[#B48B40]/[0.08] text-[#B48B40]"
                      : "border-white/8 bg-white/[0.02] text-white/55 hover:border-white/15 hover:text-white/80",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-white/35">
              Bigger windows = bigger feed. 4 weeks fits most coaching phases.
            </p>
          </div>
        </Card>

        {/* ── Colors ── */}
        <Card className="mb-4">
          <div className="px-5 py-5 space-y-4">
            <SectionHeader>Colors</SectionHeader>
            <div className="grid grid-cols-2 gap-3">
              <ColorPicker
                label="Workouts"
                value={prefs.color_workout}
                onChange={(v) => void patchPrefs({ color_workout: v })}
              />
              <ColorPicker
                label="Habits"
                value={prefs.color_habit}
                onChange={(v) => void patchPrefs({ color_habit: v })}
              />
            </div>
            <p className="text-[11px] text-white/35">
              Google Calendar honors color. Apple and Outlook ignore it for subscribed feeds.
            </p>
          </div>
        </Card>

        {saving && (
          <p className="text-[11px] text-white/40 text-center mt-4 flex items-center justify-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving…
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SetupRow({
  icon: Icon, title, steps, cta,
}: {
  icon: typeof Calendar;
  title: string;
  steps: string[];
  cta:  { label: string; href: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-white/65" strokeWidth={1.8} />
          </div>
          <span className="text-sm font-medium text-white/85">{title}</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-white/30 transition-transform", open && "rotate-180")} strokeWidth={2} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">
          <ol className="space-y-1.5 mt-2 text-[12px] text-white/70 list-decimal list-inside">
            {steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <a
            href={cta.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 text-[11px] text-[#B48B40] hover:text-[#c99840] transition-colors"
          >
            {cta.label} →
          </a>
        </div>
      )}
    </div>
  );
}

function Toggle({
  icon: Icon, label, sub, checked, onChange,
}: {
  icon: typeof Dumbbell;
  label: string;
  sub:   string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 py-2 -mx-1 px-1 rounded-xl hover:bg-white/[0.02] transition-colors text-left"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
          checked ? "bg-[#B48B40]/15 border border-[#B48B40]/30" : "bg-white/[0.04] border border-white/[0.08]",
        )}>
          <Icon className={cn("w-3.5 h-3.5", checked ? "text-[#B48B40]" : "text-white/40")} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/85">{label}</p>
          <p className="text-[11px] text-white/40">{sub}</p>
        </div>
      </div>
      <div className={cn(
        "shrink-0 w-9 h-5 rounded-full border transition-colors flex items-center",
        checked ? "bg-[#B48B40]/20 border-[#B48B40]/40 justify-end" : "bg-white/[0.04] border-white/12 justify-start",
      )}>
        <div className={cn(
          "w-3.5 h-3.5 rounded-full transition-colors mx-0.5",
          checked ? "bg-[#B48B40]" : "bg-white/40",
        )} />
      </div>
    </button>
  );
}

function TimeField({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">{label}</label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/85 outline-none focus:border-[#B48B40]/40 transition-colors tabular-nums"
      />
    </div>
  );
}

function ColorPicker({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">{label}</label>
      <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded-lg border border-white/10 cursor-pointer bg-transparent"
        />
        <code className="text-[11px] text-white/70 font-mono">{value.toUpperCase()}</code>
      </div>
    </div>
  );
}

// ─── Google OAuth card ───────────────────────────────────────────────────────

type GoogleStatus = {
  connected:       boolean;
  last_synced_at:  string | null;
  last_sync_error: string | null;
};

function GoogleCalendarCard() {
  const [status,  setStatus]  = useState<GoogleStatus | null>(null);
  const [busy,    setBusy]    = useState<"sync" | "disconnect" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/google/status", { cache: "no-store" });
      const data = await res.json() as GoogleStatus;
      setStatus(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    // Surface ?google_connected / ?google_error from OAuth callback
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const ok  = url.searchParams.get("google_connected");
      const err = url.searchParams.get("google_error");
      if (ok)  setMessage({ kind: "ok",  text: "Google Calendar connected." });
      if (err) setMessage({ kind: "err", text: `Connection failed: ${err.replace(/_/g, " ")}` });
      if (ok || err) {
        url.searchParams.delete("google_connected");
        url.searchParams.delete("google_error");
        window.history.replaceState(null, "", url.toString());
      }
    }
    void fetchStatus();
  }, [fetchStatus]);

  async function syncNow() {
    setBusy("sync");
    setMessage(null);
    try {
      const res = await fetch("/api/google/sync", { method: "POST" });
      const data = await res.json() as { pushed?: number; updated?: number; deleted?: number; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Sync failed");
      setMessage({
        kind: "ok",
        text: `Synced — ${data.pushed ?? 0} new, ${data.updated ?? 0} updated${(data.deleted ?? 0) > 0 ? `, ${data.deleted} removed` : ""}.`,
      });
      void fetchStatus();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Sync failed" });
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Google Calendar? Existing events stay; future updates won't sync until you reconnect.")) return;
    setBusy("disconnect");
    try {
      const res = await fetch("/api/google/status", { method: "DELETE" });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Disconnect failed");
      setStatus({ connected: false, last_synced_at: null, last_sync_error: null });
      setMessage({ kind: "ok", text: "Disconnected." });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Disconnect failed" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="mb-6 border-[#4285F4]/20 bg-gradient-to-br from-[#4285F4]/[0.03] to-transparent">
      <div className="px-5 py-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
              <Globe className="w-4 h-4 text-[#4285F4]" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/95">Google Calendar — real-time push</p>
              <p className="text-[11px] text-white/45 mt-0.5">
                Workouts push instantly into a dedicated <span className="text-white/70">Flowstate</span> calendar in your Google account &mdash; toggle it on/off without affecting your other calendars.
              </p>
            </div>
          </div>
          {status?.connected && (
            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] text-emerald-300 border border-emerald-400/25 bg-emerald-400/[0.06] rounded-full px-2 py-0.5">
              <Check className="w-3 h-3" strokeWidth={2.5} />
              Connected
            </span>
          )}
        </div>

        {message && (
          <div className={cn(
            "mb-3 rounded-xl border px-3 py-2 flex items-start gap-2 text-[11px] leading-relaxed",
            message.kind === "ok"
              ? "border-emerald-400/20 bg-emerald-400/[0.04] text-emerald-300/85"
              : "border-red-400/20 bg-red-400/[0.04] text-red-300/85",
          )}>
            {message.kind === "ok" ? <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2.5} /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2} />}
            {message.text}
          </div>
        )}

        {status?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-[11px] text-white/45">
              {status.last_synced_at && (
                <span>Last synced: {new Date(status.last_synced_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              )}
              {!status.last_synced_at && <span>Not synced yet — press Sync now.</span>}
            </div>
            {status.last_sync_error && (
              <p className="text-[11px] text-red-300/80">Last error: {status.last_sync_error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => void syncNow()}
                disabled={busy !== null}
                className="rounded-xl bg-[#B48B40] text-black px-4 py-2 text-xs font-semibold hover:bg-[#c99840] transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {busy === "sync" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" strokeWidth={2} />}
                {busy === "sync" ? "Syncing…" : "Sync now"}
              </button>
              <button
                onClick={() => void disconnect()}
                disabled={busy !== null}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs text-white/55 hover:text-red-300/85 hover:border-red-400/30 transition-all disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <a
            href="/api/google/oauth/start"
            className="inline-flex items-center gap-2 rounded-xl bg-white text-[#1A1A1A] px-4 py-2 text-xs font-semibold hover:bg-white/90 transition-all"
          >
            <Globe className="w-3.5 h-3.5" strokeWidth={2} />
            Connect Google Calendar
          </a>
        )}
      </div>
    </Card>
  );
}
