"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, ArrowRight, Eye, EyeOff, ChevronDown, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { createAccount, resolveAccount } from "@/lib/accounts";
import { LS_KEY, resolvePostLoginRoute, SS_KEY } from "@/lib/routing";
import { createClient } from "@/lib/supabase/client";

// ─── Goal options ─────────────────────────────────────────────────────────────

const GOAL_OPTIONS = [
  { value: "",                   label: "What are you joining for? (optional)" },
  { value: "personal_coaching",  label: "Personal coaching"        },
  { value: "ai_training",        label: "AI training program"      },
  { value: "accountability",     label: "Accountability"           },
  { value: "muscle_building",    label: "Build muscle"             },
  { value: "weight_loss",        label: "Lose weight"              },
  { value: "strength",           label: "Get stronger"             },
  { value: "athletic_perf",      label: "Athletic performance"     },
  { value: "general_fitness",    label: "General fitness"          },
];

// ─── Auto-generate username ────────────────────────────────────────────────────

function makeUsername(firstName: string, lastName: string, email: string): string {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "") ||
               (firstName + lastName.slice(0, 3)).toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${base}${Date.now().toString(36).slice(-4)}`;
}

function seedSession(userId: string) {
  try { localStorage.setItem(LS_KEY, userId); } catch { /* ignore */ }
  try { sessionStorage.setItem(SS_KEY, userId); } catch { /* ignore */ }
}

async function acceptInviteOnServer(token: string) {
  const res = await fetch(`/api/invites/${encodeURIComponent(token)}`, {
    method: "POST",
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? "Could not accept this invite.");
  }
}

// ─── Main form ────────────────────────────────────────────────────────────────

function JoinForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const trainerParam = searchParams?.get("trainer") ?? null;
  const tokenParam   = searchParams?.get("token")   ?? null;

  const [firstName,   setFirstName]   = useState("");
  const [lastName,    setLastName]    = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [joinGoal,    setJoinGoal]    = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [visible,     setVisible]     = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 60); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim())          { setError("First name is required.");          return; }
    if (!lastName.trim())           { setError("Last name is required.");            return; }
    if (!email.trim() || !email.includes("@")) { setError("Enter a valid email."); return; }
    if (password.length < 6)        { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm)       { setError("Passwords don't match.");            return; }

    setLoading(true);

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    // ── Supabase path (when env vars are configured) ──────────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email:    email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/finish`,
          data: {
            full_name:           fullName,
            first_name:          firstName.trim(),
            last_name:           lastName.trim(),
            role:                "client",
            assigned_trainer_id: trainerParam ?? null,
            join_goal:           joinGoal || null,
            signup_source:       tokenParam ? "personalized_invite" : "open_invite",
            invite_token:         tokenParam ?? null,
          },
        },
      });

      if (signUpError) {
        // Email already registered — try signing in
        if (signUpError.message.toLowerCase().includes("already registered")) {
          const { data: siData, error: siErr } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(), password,
          });
          if (!siErr && siData.user) {
            try { await fetch("/api/auth/sync-profile", { method: "POST" }); } catch { /* non-blocking */ }
            if (tokenParam) {
              try {
                await acceptInviteOnServer(tokenParam);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not accept this invite.");
                setLoading(false);
                return;
              }
            }
            seedSession(siData.user.id);
            router.replace("/onboarding");
            return;
          }
          setError("An account with that email already exists. Check your password.");
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        if (!data.session) {
          setConfirmationSent(true);
          setLoading(false);
          return;
        }

        try { await fetch("/api/auth/sync-profile", { method: "POST" }); } catch { /* non-blocking */ }
        if (tokenParam) {
          try {
            await acceptInviteOnServer(tokenParam);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not accept this invite.");
            setLoading(false);
            return;
          }
        }
        seedSession(data.user.id);
      } else {
        setConfirmationSent(true);
        setLoading(false);
        return;
      }

      // New Supabase user → start onboarding
      router.replace("/onboarding");
      return;
    }

    // ── Legacy localStorage path (dev / no Supabase configured) ──────────────
    const username = makeUsername(firstName.trim(), lastName.trim(), email.trim());
    const result = createAccount(
      username,
      password,
      "client",
      fullName,
      email.trim().toLowerCase(),
      {
        signupSource:      tokenParam ? "personalized_invite" : "open_invite",
        isOpenInvite:      !tokenParam,
        firstName:         firstName.trim(),
        lastName:          lastName.trim(),
        joinGoal:          joinGoal || undefined,
        assignedTrainerId: trainerParam ?? undefined,
        leadSource:        "open_invite_link",
        inviteToken:       tokenParam ?? undefined,
      },
    );

    if ("error" in result) {
      const existing = resolveAccount(email.trim().toLowerCase(), password);
      if (existing) {
        seedSession(existing.id);
        router.replace(resolvePostLoginRoute(existing.id));
        return;
      }
      setError(result.error);
      setLoading(false);
      return;
    }

    seedSession(result.id);
    router.replace(resolvePostLoginRoute(result.id));
  }

  const canSubmit = firstName && lastName && email && password && confirm && !loading;

  if (confirmationSent) {
    const cleanEmail = email.trim().toLowerCase();
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 py-12 text-white">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-14 h-14 rounded-full bg-[#B48B40]/15 border border-[#B48B40]/30 flex items-center justify-center mx-auto">
            <MailCheck className="w-7 h-7 text-[#B48B40]" strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-white/85">Account created.</h1>
            <p className="text-sm text-white/45 leading-relaxed">
              Check your email to confirm your account, then you&apos;ll continue onboarding.
            </p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="w-full rounded-2xl bg-[#B48B40] text-black py-3 text-sm font-semibold hover:bg-[#c99840] transition-all"
            >
              Go to login
            </button>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="w-full rounded-2xl border border-white/8 py-3 text-sm text-white/45 hover:text-white/75 transition-colors"
            >
              Back to Flowstate
            </button>
          </div>
          {cleanEmail && (
            <p className="text-[11px] text-white/25 leading-relaxed">
              Use the same email you entered here: {cleanEmail}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 py-12 text-white">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-[#B48B40]/[0.045] blur-[130px]" />
        <div className="absolute top-1/2 -translate-y-1/2 -right-32 w-[300px] h-[500px] rounded-full bg-[#B48B40]/[0.02] blur-[100px]" />
      </div>

      <div className={cn(
        "relative w-full max-w-sm space-y-8 transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      )}>
        {/* Brand mark */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#B48B40]/15 border border-[#B48B40]/30 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate AI</span>
        </div>

        {/* Hero */}
        <div className="space-y-2.5">
          <h1 className="text-[2rem] font-bold tracking-tight leading-none">
            Build your<br />system.
          </h1>
          <p className="text-sm text-white/40 leading-relaxed">
            AI-guided training built around you. Set up your profile and your program gets built automatically.
          </p>
          {trainerParam && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#B48B40]/10 border border-[#B48B40]/20">
              <div className="w-1.5 h-1.5 rounded-full bg-[#B48B40]" />
              <span className="text-[11px] text-[#B48B40]/80">Trainer invite</span>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setError(null); }}
                autoComplete="given-name"
                placeholder="Alex"
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/18 outline-none focus:border-white/22 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setError(null); }}
                autoComplete="family-name"
                placeholder="Carter"
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/18 outline-none focus:border-white/22 transition-all"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              autoComplete="email"
              autoCapitalize="none"
              placeholder="you@example.com"
              className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/18 outline-none focus:border-white/22 transition-all"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder:text-white/18 outline-none focus:border-white/22 transition-all"
              />
              <button type="button" onClick={() => setShowPass((v) => !v)}
                tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/22 hover:text-white/50 transition-colors">
                {showPass ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          {/* Confirm */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">Confirm password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder:text-white/18 outline-none focus:border-white/22 transition-all"
              />
              <button type="button" onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/22 hover:text-white/50 transition-colors">
                {showConfirm ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          {/* Goal — optional */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
              Goal <span className="normal-case text-white/20">(optional)</span>
            </label>
            <div className="relative">
              <select
                value={joinGoal}
                onChange={(e) => setJoinGoal(e.target.value)}
                className="w-full appearance-none bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/22 transition-all cursor-pointer"
                style={{ color: joinGoal ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.28)" }}
              >
                {GOAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} style={{ background: "#111" }}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" strokeWidth={1.5} />
            </div>
          </div>

          {error && <p className="text-xs text-red-400/70 pt-0.5">{error}</p>}

          {/* CTA */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "w-full rounded-2xl py-4 text-sm font-bold tracking-wide flex items-center justify-center gap-2 transition-all duration-200 mt-1",
              canSubmit
                ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                : "bg-white/5 text-white/25 cursor-default"
            )}
          >
            {loading ? "Setting up your account…" : <>Build My Program <ArrowRight className="w-4 h-4" strokeWidth={2} /></>}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-[11px] text-white/18 leading-relaxed">
          Already have an account?{" "}
          <a href="/login" className="text-white/38 hover:text-white/60 underline underline-offset-2 transition-colors">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Page export (wrapped in Suspense for useSearchParams) ────────────────────

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0A]" />}>
      <JoinForm />
    </Suspense>
  );
}
