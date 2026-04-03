"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, Fingerprint, ArrowRight, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isPlatformAuthenticatorAvailable,
  hasSavedCredential,
  getBiometricLabel,
  registerBiometric,
  authenticateWithBiometric,
  clearBiometric,
} from "@/lib/biometric";

// ─── Constants ────────────────────────────────────────────────────────────────

type Step = "biometric-prompt" | "credentials" | "enable-biometric";

const LS_KEY        = "flowstate-active-role";
const SS_KEY        = "flowstate-session-role";
const ONBOARDED_KEY = "flowstate-onboarded";

// Role is inferred from credentials — never picked by the user.
// ADMIN credentials are not shown in the UI.
const CREDENTIALS: Record<string, { username: string; password: string; role: string }> = {
  master:  { username: "ADMIN",  password: "ADMIN",      role: "master"  },
  trainer: { username: "alex",   password: "flowstate",  role: "trainer" },
  client:  { username: "kai",    password: "flowstate",  role: "client"  },
  member:  { username: "luca",   password: "flowstate",  role: "member"  },
};

// Quick-access role cards shown to regular users on the login screen.
// Admin entry is hidden — only accessible via the credentials form.
const QUICK_ACCESS = [
  { key: "member",  label: "Member",  sub: "Training & accountability"     },
  { key: "client",  label: "Client",  sub: "Full coaching & nutrition"      },
  { key: "trainer", label: "Trainer", sub: "Client management & programs"   },
] as const;

function resolveRole(username: string, password: string): string | null {
  for (const entry of Object.values(CREDENTIALS)) {
    if (
      username.trim().toLowerCase() === entry.username.toLowerCase() &&
      password === entry.password
    ) {
      return entry.role;
    }
  }
  return null;
}

// Maps demo role keys to their user IDs (mirrors DEMO_USERS in UserContext)
const ROLE_TO_USER_ID: Record<string, string> = {
  master: "usr_001", trainer: "u4", client: "u1", member: "u6",
};

function postLoginRoute(roleKey: string): string {
  // Master always goes directly to admin — no onboarding required
  if (roleKey === "master") return "/admin";

  const userId = ROLE_TO_USER_ID[roleKey] ?? roleKey;

  try {
    // Check new 2-phase onboarding state first
    const raw = localStorage.getItem(`flowstate-onboarding-${userId}`);
    if (raw) {
      const state = JSON.parse(raw) as { hasCompletedQuickStart?: boolean };
      if (!state.hasCompletedQuickStart) return "/onboarding";
      return "/dashboard";
    }
    // Legacy key fallback
    if (localStorage.getItem(ONBOARDED_KEY) !== "true") return "/onboarding";
  } catch { /* ignore */ }

  return "/dashboard";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();

  const [checking,     setChecking]     = useState(true);
  const [step,         setStep]         = useState<Step>("credentials");
  const [loginMode,    setLoginMode]    = useState<"roles" | "credentials">("roles");
  const [resolvedRole, setResolvedRole] = useState<string | null>(null);
  const [username,     setUsername]     = useState("");
  const [password,     setPassword]     = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [rememberMe,   setRememberMe]   = useState(true);
  const [authError,    setAuthError]    = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [bioLabel,     setBioLabel]     = useState("Quick Login");
  const [bioError,     setBioError]     = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Do NOT auto-redirect based on stored session.
    // If LS_KEY has a stale "master" (or any other role) from a previous session,
    // that must not silently send all users to /admin. The login page always renders.
    // Session persistence for "already logged in" users is handled at layout level.
    setChecking(false);
    setBioLabel(getBiometricLabel());

    if (hasSavedCredential()) {
      isPlatformAuthenticatorAvailable().then((ok) => {
        if (ok) setStep("biometric-prompt");
      });
    } else {
      isPlatformAuthenticatorAvailable().then(setBioAvailable);
    }

    setTimeout(() => usernameRef.current?.focus(), 50);
  }, []);

  if (checking) return null;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function saveSession(roleKey: string) {
    try {
      if (rememberMe) {
        localStorage.setItem(LS_KEY, roleKey);
      } else {
        sessionStorage.setItem(SS_KEY, roleKey);
      }
    } catch { /* ignore */ }
  }

  function afterLogin(roleKey: string) {
    saveSession(roleKey);
    if (bioAvailable && !hasSavedCredential()) {
      setLoading(false);
      setStep("enable-biometric");
    } else {
      router.replace(postLoginRoute(roleKey));
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  function handleQuickLogin(roleKey: string) {
    setResolvedRole(roleKey);
    setLoading(true);
    afterLogin(roleKey);
  }

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(false);

    const role = resolveRole(username, password);
    if (!role) {
      setAuthError(true);
      return;
    }

    setResolvedRole(role);
    setLoading(true);
    afterLogin(role);
  }

  async function handleBiometricLogin() {
    setLoading(true);
    setBioError(false);
    const savedRole = await authenticateWithBiometric();
    if (savedRole) {
      try { localStorage.setItem(LS_KEY, savedRole); } catch { /* ignore */ }
      router.replace(postLoginRoute(savedRole));
    } else {
      setLoading(false);
      setBioError(true);
    }
  }

  async function handleEnableBiometric() {
    if (!resolvedRole) return;
    setLoading(true);
    await registerBiometric(resolvedRole);
    setLoading(false);
    router.replace(postLoginRoute(resolvedRole));
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 md:px-8 py-16 text-white">
      <div className="max-w-sm w-full space-y-8">

        {/* Brand */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate AI</p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {step === "enable-biometric" ? "Quick Login" : "Sign in"}
          </h1>
          <p className="text-sm text-white/40">
            {step === "credentials"      && "Enter your credentials to continue."}
            {step === "biometric-prompt" && `Use ${bioLabel} to sign in.`}
            {step === "enable-biometric" && "Sign in faster on your next visit."}
          </p>
        </div>

        {/* ── Role selection (default view) ──────────────────────────────────── */}
        {step === "credentials" && loginMode === "roles" && (
          <div className="space-y-3">
            {QUICK_ACCESS.map(({ key, label, sub }) => (
              <button
                key={key}
                onClick={() => handleQuickLogin(key)}
                disabled={loading}
                className="w-full rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-4 text-left hover:border-white/15 hover:bg-white/[0.04] transition-all group disabled:opacity-40"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white/80">{label}</p>
                    <p className="text-xs text-white/30 mt-0.5">{sub}</p>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 text-white/18 group-hover:text-white/45 transition-colors shrink-0"
                    strokeWidth={1.5}
                  />
                </div>
              </button>
            ))}

            <button
              onClick={() => setLoginMode("credentials")}
              className="w-full text-center text-xs text-white/22 hover:text-white/40 transition-colors py-2"
            >
              Admin access
            </button>
          </div>
        )}

        {/* ── Credentials form (admin access) ────────────────────────────────── */}
        {step === "credentials" && loginMode === "credentials" && (
          <form onSubmit={handleSignIn} className="space-y-4">

            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                Username
              </label>
              <input
                ref={usernameRef}
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setAuthError(false); }}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className={cn(
                  "w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/18 outline-none transition-all",
                  authError
                    ? "border-red-400/30 focus:border-red-400/50"
                    : "border-white/8 focus:border-white/20"
                )}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setAuthError(false); }}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={cn(
                    "w-full bg-white/[0.04] border rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder:text-white/18 outline-none transition-all",
                    authError
                      ? "border-red-400/30 focus:border-red-400/50"
                      : "border-white/8 focus:border-white/20"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/22 hover:text-white/50 transition-colors"
                  tabIndex={-1}
                >
                  {showPass
                    ? <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                    : <Eye    className="w-4 h-4" strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {/* Error + forgot password */}
            <div className="flex items-center justify-between min-h-[18px]">
              {authError
                ? <p className="text-xs text-red-400/70">Incorrect username or password.</p>
                : <span />}
              <Link
                href="/forgot-password"
                className="text-xs text-white/22 hover:text-white/45 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div
                className={cn(
                  "w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-all",
                  rememberMe
                    ? "border-[#B48B40]/60 bg-[#B48B40]/20"
                    : "border-white/15 bg-transparent group-hover:border-white/25"
                )}
                onClick={() => setRememberMe((v) => !v)}
              >
                {rememberMe && (
                  <svg className="w-2.5 h-2.5 text-[#B48B40]" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-white/40 select-none">Remember me</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={!username || !password || loading}
              className={cn(
                "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide transition-all duration-200 mt-2",
                username && password && !loading
                  ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                  : "bg-white/5 text-white/25 cursor-default"
              )}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <button
              type="button"
              onClick={() => { setLoginMode("roles"); setAuthError(false); }}
              className="w-full text-center text-xs text-white/22 hover:text-white/40 transition-colors py-1"
            >
              ← Back
            </button>
          </form>
        )}

        {/* ── Biometric prompt ───────────────────────────────────────────────── */}
        {step === "biometric-prompt" && (
          <div className="space-y-4">
            <button
              onClick={handleBiometricLogin}
              disabled={loading}
              className={cn(
                "w-full rounded-2xl border py-5 flex flex-col items-center gap-3 transition-all duration-150",
                loading
                  ? "border-white/6 bg-white/[0.02] cursor-default"
                  : "border-[#B48B40]/40 bg-[#B48B40]/5 hover:bg-[#B48B40]/10 active:scale-[0.98]"
              )}
            >
              <Fingerprint
                className={cn("w-9 h-9 transition-colors", loading ? "text-white/20" : "text-[#B48B40]")}
                strokeWidth={1.5}
              />
              <div className="text-center">
                <p className="text-sm font-semibold text-white/80">
                  {loading ? "Waiting for biometric…" : `Sign in with ${bioLabel}`}
                </p>
                {bioError && (
                  <p className="text-xs text-red-400/70 mt-1">Authentication failed. Try again.</p>
                )}
              </div>
            </button>

            <button
              onClick={() => { clearBiometric(); setStep("credentials"); setBioError(false); }}
              className="w-full text-center text-xs text-white/22 hover:text-white/40 transition-colors py-1"
            >
              Sign in with username and password
            </button>
          </div>
        )}

        {/* ── Enable biometric ───────────────────────────────────────────────── */}
        {step === "enable-biometric" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/6 bg-white/[0.02] px-5 py-6 flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-full border border-[#B48B40]/30 bg-[#B48B40]/8 flex items-center justify-center">
                <Fingerprint className="w-6 h-6 text-[#B48B40]" strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white/80">Enable {bioLabel}</p>
                <p className="text-xs text-white/35 leading-relaxed">
                  Sign in instantly on your next visit using your device biometrics.
                  No passwords. No friction.
                </p>
              </div>
            </div>

            <button
              onClick={handleEnableBiometric}
              disabled={loading}
              className={cn(
                "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all duration-200",
                loading
                  ? "bg-white/5 text-white/25 cursor-default"
                  : "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
              )}
            >
              {loading ? "Setting up…" : <>{`Enable ${bioLabel}`} <ArrowRight className="w-4 h-4" strokeWidth={2} /></>}
            </button>

            <button
              onClick={() => router.replace(postLoginRoute(resolvedRole ?? "member"))}
              className="w-full text-center text-xs text-white/22 hover:text-white/40 transition-colors py-1"
            >
              Not now
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
