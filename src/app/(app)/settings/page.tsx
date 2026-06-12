"use client";

// Settings index — the home for account, billing, legal, and the deletion flow.
// Visual language follows the V2 dashboard: editorial column, hairline-divided
// rows, ambient warmth, no nested cards.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard, FileText, ScrollText, AlertCircle, ChevronRight,
  Loader2, ShieldAlert, Trash2, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";

const INTENSITY_LABELS: Record<number, { name: string; sub: string }> = {
  1: { name: "Gentle",     sub: "Patient, encouraging" },
  2: { name: "Supportive", sub: "Friendly, honest" },
  3: { name: "Balanced",   sub: "Real coach, no fluff" },
  4: { name: "Firm",       sub: "High standards, push hard" },
  5: { name: "Militant",   sub: "Cold, blunt, drill sergeant" },
};

export default function SettingsPage() {
  const { user } = useUser();

  const [confirmOpen, setConfirmOpen]   = useState(false);
  const [confirmText, setConfirmText]   = useState("");
  const [deleting,    setDeleting]      = useState(false);
  const [deleteError, setDeleteError]   = useState<string | null>(null);

  // Coach voice prefs (nickname + intensity + strong-language).
  const [nickname,    setNickname]      = useState("");
  const [intensity,   setIntensity]     = useState(3);
  const [strongLang,  setStrongLang]    = useState(false);
  const [prefsLoaded, setPrefsLoaded]   = useState(false);
  const [prefsSaved,  setPrefsSaved]    = useState(false);
  const [prefsBusy,   setPrefsBusy]     = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/me/coach-prefs", { cache: "no-store" })
      .then(async (r) => r.ok ? r.json() : null)
      .then((json) => {
        if (!active || !json?.prefs) return;
        setNickname(json.prefs.nickname ?? "");
        setIntensity(json.prefs.coach_intensity ?? 3);
        setStrongLang(json.prefs.coach_strong_language ?? false);
        setPrefsLoaded(true);
      })
      .catch(() => { /* prefs are best-effort */ });
    return () => { active = false; };
  }, []);

  async function savePrefs(patch: Record<string, unknown>) {
    setPrefsBusy(true);
    setPrefsSaved(false);
    try {
      const res = await fetch("/api/me/coach-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setPrefsSaved(true);
        setTimeout(() => setPrefsSaved(false), 1800);
      }
    } catch { /* swallow — UI already optimistic */ }
    finally { setPrefsBusy(false); }
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/me/account", { method: "DELETE" });
      const json = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? "Couldn't delete your account.");
      }
      // Sign out + hard nav home so middleware re-checks the cleared session.
      try {
        const { signOutEverywhere } = await import("@/lib/auth/signOut");
        await signOutEverywhere({ redirect: "/" });
      } catch {
        window.location.href = "/";
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete your account.");
      setDeleting(false);
    }
  }

  return (
    <div className="relative min-h-screen text-white">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(120%_55%_at_50%_-5%,rgba(180,139,64,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0A0908_0%,#0B0908_100%)] -z-10" />
      </div>

      <div className="relative mx-auto max-w-[640px] px-6 md:px-8 pt-10 md:pt-14 pb-28 space-y-14">
        {/* ── COVER ── */}
        <header className="space-y-2">
          <p className="text-[12px] text-white/30">Account</p>
          <h1 className="text-[44px] md:text-[52px] font-display font-normal tracking-[-0.02em] leading-[0.95]">
            Settings
          </h1>
          <p className="text-[14px] text-white/45 mt-3">
            Signed in as <span className="text-white/70">{(user as { email?: string }).email ?? user.name}</span>
          </p>
        </header>

        {/* ── ACCOUNT SECTIONS — editorial nav rows. */}
        <section>
          <h2 className="text-[20px] font-medium text-white/85 tracking-tight mb-7">Manage</h2>
          <div className="divide-y divide-white/[0.06] border-t border-b border-white/[0.06]">
            <SettingsRow
              icon={CreditCard}
              label="Billing"
              hint="Plan, subscription, cancellation"
              href="/settings/billing"
            />
            <SettingsRow
              icon={FileText}
              label="Privacy policy"
              hint="What we collect, share, and how long we keep it"
              href="/privacy"
            />
            <SettingsRow
              icon={ScrollText}
              label="Terms of service"
              hint="Rules of using Flowstate"
              href="/terms"
            />
            <SettingsRow
              icon={AlertCircle}
              label="Disclaimer"
              hint="Health, AI, use-at-your-own-risk"
              href="/disclaimer"
            />
          </div>
        </section>

        {/* ── COACH VOICE — nickname + intensity + strong language. */}
        <section className="space-y-7">
          <div className="space-y-2">
            <h2 className="text-[20px] font-medium text-white/85 tracking-tight">Coach voice</h2>
            <p className="text-[13px] text-white/45 leading-relaxed">
              Set what the coach calls you and how hard they push. Saves across devices.
            </p>
          </div>

          {/* Nickname */}
          <div className="space-y-2">
            <label className="text-[12px] text-white/40">What should the coach call you?</label>
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 focus-within:border-[#B48B40]/40 transition-colors">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={() => prefsLoaded && savePrefs({ nickname: nickname.trim() || null })}
                placeholder={user.name?.split(" ")[0] ?? "Your preferred name"}
                maxLength={60}
                disabled={prefsBusy}
                className="flex-1 bg-transparent text-[14px] text-white/85 placeholder:text-white/22 outline-none"
              />
              {prefsSaved && <Check className="w-3.5 h-3.5 text-emerald-400/85" strokeWidth={2} />}
            </div>
          </div>

          {/* Intensity dial */}
          <div className="space-y-3">
            <label className="text-[12px] text-white/40">Intensity</label>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = intensity === n;
                const m = INTENSITY_LABELS[n];
                return (
                  <button
                    key={n}
                    onClick={() => { setIntensity(n); if (prefsLoaded) savePrefs({ coach_intensity: n }); }}
                    disabled={prefsBusy}
                    className={cn(
                      "rounded-xl px-2 py-3 text-center transition-all border",
                      active
                        ? "border-[#B48B40]/45 bg-[#B48B40]/[0.08] text-[#B48B40]"
                        : "border-white/[0.07] bg-white/[0.02] text-white/45 hover:text-white/75 hover:border-white/15",
                    )}
                  >
                    <p className="text-[12px] font-semibold">{m.name}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-white/35 leading-relaxed">
              {INTENSITY_LABELS[intensity]?.sub}
            </p>
          </div>

          {/* Strong language toggle */}
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-[14px] text-white/85">Allow strong language</p>
              <p className="text-[12px] text-white/40 mt-0.5 leading-relaxed">
                Lets the coach swear for emphasis when it lands naturally.
              </p>
            </div>
            <button
              onClick={() => {
                const next = !strongLang;
                setStrongLang(next);
                if (prefsLoaded) savePrefs({ coach_strong_language: next });
              }}
              disabled={prefsBusy}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors shrink-0",
                strongLang ? "bg-[#B48B40]" : "bg-white/[0.08]",
              )}
              aria-pressed={strongLang}
            >
              <span
                className={cn(
                  "absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white transition-transform",
                  strongLang ? "translate-x-5" : "",
                )}
              />
            </button>
          </label>
        </section>

        {/* ── DANGER ZONE. */}
        <section className="space-y-5">
          <h2 className="text-[20px] font-medium text-white/85 tracking-tight">Danger zone</h2>
          <p className="text-[13px] text-white/45 leading-relaxed">
            Deleting your account cancels your subscription, removes your progress photos,
            and erases your workouts, meal logs, AI conversations, and intake data.
            This cannot be undone.
          </p>

          {!confirmOpen ? (
            <button
              onClick={() => { setConfirmOpen(true); setDeleteError(null); }}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/22 bg-red-500/[0.04] px-4 py-2.5 text-[13px] font-medium text-red-300/85 hover:bg-red-500/[0.08] hover:border-red-500/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
              Delete my account
            </button>
          ) : (
            <div className="rounded-2xl border border-red-500/22 bg-red-500/[0.03] px-5 py-5 space-y-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-4 h-4 text-red-300/85 shrink-0 mt-0.5" strokeWidth={1.8} />
                <div className="space-y-2 min-w-0">
                  <p className="text-[14px] font-medium text-white/90">This will permanently delete your account.</p>
                  <p className="text-[12px] text-white/55 leading-relaxed">
                    Type <span className="font-medium text-red-300/85">delete</span> below to confirm.
                    We&apos;ll cancel your subscription, remove your data, and sign you out.
                  </p>
                </div>
              </div>

              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type 'delete' to confirm"
                disabled={deleting}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-[13px] text-white/85 placeholder:text-white/22 outline-none focus:border-red-500/40 disabled:opacity-50 transition-colors"
              />

              {deleteError && (
                <p className="text-[12px] text-red-300/85 leading-relaxed">{deleteError}</p>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={deleteAccount}
                  disabled={confirmText.trim().toLowerCase() !== "delete" || deleting}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-colors",
                    "bg-red-500/85 text-white hover:bg-red-500 disabled:bg-white/[0.04] disabled:text-white/25 disabled:cursor-not-allowed",
                  )}
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />}
                  {deleting ? "Deleting…" : "Permanently delete"}
                </button>
                <button
                  onClick={() => { setConfirmOpen(false); setConfirmText(""); setDeleteError(null); }}
                  disabled={deleting}
                  className="text-[12px] font-medium text-white/45 hover:text-white/75 disabled:opacity-30 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        <footer className="flex items-center justify-center gap-5 pt-6 text-[11px] text-white/25 border-t border-white/[0.05]">
          <Link href="/privacy"    className="hover:text-[#B48B40] transition-colors">Privacy</Link>
          <Link href="/terms"      className="hover:text-[#B48B40] transition-colors">Terms</Link>
          <Link href="/disclaimer" className="hover:text-[#B48B40] transition-colors">Disclaimer</Link>
        </footer>
      </div>
    </div>
  );
}

function SettingsRow({
  icon: Icon, label, hint, href,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  hint:  string;
  href:  string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 py-5 transition-colors"
    >
      <div className="flex items-center gap-5 min-w-0">
        <Icon className="w-[18px] h-[18px] text-white/35 group-hover:text-[#B48B40] transition-colors shrink-0" strokeWidth={1.5} />
        <div className="min-w-0">
          <p className="text-[15px] text-white/85 group-hover:text-white transition-colors">{label}</p>
          <p className="text-[12px] text-white/35 mt-0.5">{hint}</p>
        </div>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-[#B48B40] group-hover:translate-x-0.5 transition-all shrink-0" strokeWidth={2} />
    </Link>
  );
}
