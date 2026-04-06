"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, Fingerprint, ArrowRight, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { createAccount, resolveAccount } from "@/lib/accounts";
import { loadOnboardingState } from "@/lib/onboarding";
import {
  isPlatformAuthenticatorAvailable,
  hasSavedCredential,
  getBiometricLabel,
  registerBiometric,
  authenticateWithBiometric,
  clearBiometric,
} from "@/lib/biometric";
import type { Role } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

type AuthStep = "form" | "biometric-prompt" | "enable-biometric";
type AuthMode = "signin" | "create";

const LS_KEY            = "flowstate-active-role";
const SS_KEY            = "flowstate-session-role";
const SELECTED_ROLE_KEY = "flowstate-selected-role";

const DEMO_CREDENTIALS: Record<string, { username: string; password: string }> = {
  master:  { username: "ADMIN", password: "ADMIN"     },
  trainer: { username: "alex",  password: "flowstate" },
  client:  { username: "kai",   password: "flowstate" },
  member:  { username: "luca",  password: "flowstate" },
};

const ROLE_LABELS: Record<string, { label: string; sub: string }> = {
  member:  { label: "Member",  sub: "Self-directed performance" },
  client:  { label: "Client",  sub: "Full coaching experience"  },
  trainer: { label: "Trainer", sub: "Manage and coach others"   },
};

const ROLE_TO_USER_ID: Record<string, string> = {
  master: "usr_001", trainer: "u4", client: "u1", member: "u6",
};

function resolveCredentials(username: string, password: string): { sessionKey: string } | null {
  for (const [key, entry] of Object.entries(DEMO_CREDENTIALS)) {
    if (
      username.trim().toLowerCase() === entry.username.toLowerCase() &&
      password === entry.password
    ) {
      return { sessionKey: key };
    }
  }
  const account = resolveAccount(username, password);
  if (account) return { sessionKey: account.id };
  return null;
}

function postLoginRoute(sessionKey: string): string {
  if (sessionKey === "master") return "/admin";
  const userId = ROLE_TO_USER_ID[sessionKey] ?? sessionKey;
  try {
    const s = loadOnboardingState(userId);
    if (!s.starterComplete)    return "/onboarding/quick-start";
    if (!s.onboardingComplete) return "/onboarding/calibration";
    if (!s.tutorialComplete)   return "/onboarding/tutorial";
    if (!s.profileComplete)    return "/onboarding/profile-setup";
  } catch { /* ignore */ }
  return "/dashboard";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();

  const [step,          setStep]          = useState<AuthStep>("form");
  const [mode,          setMode]          = useState<AuthMode>("signin");
  const [selectedRole,  setSelectedRole]  = useState<string | null>(null);
  const [adminMode,     setAdminMode]     = useState(false);

  // Sign in
  const [siUsername,    setSiUsername]    = useState("");
  const [siPassword,    setSiPassword]    = useState("");
  const [siShowPass,    setSiShowPass]    = useState(false);
  const [siError,       setSiError]       = useState<string | null>(null);

  // Create account
  const [caName,        setCaName]        = useState("");
  const [caUsername,    setCaUsername]    = useState("");
  const [caPassword,    setCaPassword]    = useState("");
  const [caConfirm,     setCaConfirm]     = useState("");
  const [caShowPass,    setCaShowPass]    = useState(false);
  const [caShowConfirm, setCaShowConfirm] = useState(false);
  const [caError,       setCaError]       = useState<string | null>(null);

  // Shared
  const [loading,       setLoading]       = useState(false);
  const [rememberMe,    setRememberMe]    = useState(true);
  const [resolvedKey,   setResolvedKey]   = useState<string | null>(null);
  const [bioLabel,      setBioLabel]      = useState("Quick Login");
  const [bioError,      setBioError]      = useState(false);
  const [bioAvailable,  setBioAvailable]  = useState(false);

  const siUsernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBioLabel(getBiometricLabel());

    try {
      const role = sessionStorage.getItem(SELECTED_ROLE_KEY);
      if (role && ROLE_LABELS[role]) {
        setSelectedRole(role);
      } else {
        setAdminMode(true);
      }
    } catch {
      setAdminMode(true);
    }

    if (hasSavedCredential()) {
      isPlatformAuthenticatorAvailable().then((ok) => {
        if (ok) setStep("biometric-prompt");
      });
    } else {
      isPlatformAuthenticatorAvailable().then(setBioAvailable);
    }

    setTimeout(() => siUsernameRef.current?.focus(), 50);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function saveSession(key: string) {
    try {
      if (rememberMe) localStorage.setItem(LS_KEY, key);
      else            sessionStorage.setItem(SS_KEY, key);
    } catch { /* ignore */ }
  }

  function afterLogin(sessionKey: string) {
    setResolvedKey(sessionKey);
    saveSession(sessionKey);
    try { sessionStorage.removeItem(SELECTED_ROLE_KEY); } catch { /* ignore */ }

    if (bioAvailable && !hasSavedCredential()) {
      setLoading(false);
      setStep("enable-biometric");
    } else {
      router.replace(postLoginRoute(sessionKey));
    }
  }

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSiError(null);
    const result = resolveCredentials(siUsername, siPassword);
    if (!result) { setSiError("Incorrect username or password."); return; }
    setLoading(true);
    afterLogin(result.sessionKey);
  }

  function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setCaError(null);

    const role = selectedRole as Exclude<Role, "master"> | null;
    if (!role)                    { setCaError("No role selected — go back and choose one."); return; }
    if (!caName.trim())           { setCaError("Please enter your name.");                    return; }
    if (!caUsername.trim())       { setCaError("Please choose a username.");                  return; }
    if (caUsername.trim().length < 3) { setCaError("Username must be at least 3 characters."); return; }
    if (caPassword.length < 6)    { setCaError("Password must be at least 6 characters.");    return; }
    if (caPassword !== caConfirm) { setCaError("Passwords don't match.");                      return; }

    setLoading(true);
    const result = createAccount(caUsername.trim(), caPassword, role, caName.trim());
    if ("error" in result) { setCaError(result.error); setLoading(false); return; }
    afterLogin(result.id);
  }

  async function handleBiometricLogin() {
    setLoading(true);
    setBioError(false);
    const savedKey = await authenticateWithBiometric();
    if (savedKey) {
      try { localStorage.setItem(LS_KEY, savedKey); } catch { /* ignore */ }
      router.replace(postLoginRoute(savedKey));
    } else {
      setLoading(false);
      setBioError(true);
    }
  }

  async function handleEnableBiometric() {
    if (!resolvedKey) return;
    setLoading(true);
    await registerBiometric(resolvedKey);
    setLoading(false);
    router.replace(postLoginRoute(resolvedKey));
  }

  // ── Shared sub-components (defined inline, no extra file) ──────────────────

  const roleInfo = selectedRole ? ROLE_LABELS[selectedRole] : null;

  function PasswordInput({
    label, value, onChange, show, onToggle, placeholder, autoComplete, error,
  }: {
    label: string; value: string; onChange: (v: string) => void;
    show: boolean; onToggle: () => void; placeholder?: string;
    autoComplete?: string; error?: boolean;
  }) {
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">{label}</label>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete={autoComplete}
            placeholder={placeholder ?? "••••••••"}
            className={cn(
              "w-full bg-white/[0.04] border rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder:text-white/18 outline-none transition-all",
              error ? "border-red-400/30 focus:border-red-400/50" : "border-white/8 focus:border-white/20"
            )}
          />
          <button type="button" onClick={onToggle} tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/22 hover:text-white/50 transition-colors">
            {show ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
          </button>
        </div>
      </div>
    );
  }

  function TextInput({
    label, value, onChange, autoComplete, error, inputRef,
  }: {
    label: string; value: string; onChange: (v: string) => void;
    autoComplete?: string; error?: boolean;
    inputRef?: React.RefObject<HTMLInputElement | null>;
  }) {
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">{label}</label>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement> | undefined}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          className={cn(
            "w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/18 outline-none transition-all",
            error ? "border-red-400/30 focus:border-red-400/50" : "border-white/8 focus:border-white/20"
          )}
        />
      </div>
    );
  }

  function RememberMeToggle() {
    return (
      <label className="flex items-center gap-2.5 cursor-pointer group">
        <div
          className={cn(
            "w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-all",
            rememberMe ? "border-[#B48B40]/60 bg-[#B48B40]/20" : "border-white/15 bg-transparent group-hover:border-white/25"
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
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 md:px-8 py-16 text-white">
      <div className="max-w-sm w-full space-y-8">

        {/* ── Biometric prompt ─────────────────────────────────────────────── */}
        {step === "biometric-prompt" && (
          <>
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate AI</p>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="text-sm text-white/40">Use {bioLabel} to sign in instantly.</p>
            </div>
            <div className="space-y-4">
              <button onClick={handleBiometricLogin} disabled={loading}
                className={cn(
                  "w-full rounded-2xl border py-5 flex flex-col items-center gap-3 transition-all duration-150",
                  loading ? "border-white/6 bg-white/[0.02] cursor-default" : "border-[#B48B40]/40 bg-[#B48B40]/5 hover:bg-[#B48B40]/10 active:scale-[0.98]"
                )}>
                <Fingerprint className={cn("w-9 h-9 transition-colors", loading ? "text-white/20" : "text-[#B48B40]")} strokeWidth={1.5} />
                <div className="text-center">
                  <p className="text-sm font-semibold text-white/80">
                    {loading ? "Waiting for biometric…" : `Sign in with ${bioLabel}`}
                  </p>
                  {bioError && <p className="text-xs text-red-400/70 mt-1">Authentication failed. Try again.</p>}
                </div>
              </button>
              <button onClick={() => { clearBiometric(); setStep("form"); setBioError(false); }}
                className="w-full text-center text-xs text-white/22 hover:text-white/40 transition-colors py-1">
                Use username and password instead
              </button>
            </div>
          </>
        )}

        {/* ── Enable biometric ──────────────────────────────────────────────── */}
        {step === "enable-biometric" && (
          <>
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate AI</p>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Quick Login</h1>
              <p className="text-sm text-white/40">Sign in faster next time.</p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/6 bg-white/[0.02] px-5 py-6 flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 rounded-full border border-[#B48B40]/30 bg-[#B48B40]/8 flex items-center justify-center">
                  <Fingerprint className="w-6 h-6 text-[#B48B40]" strokeWidth={1.5} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white/80">Enable {bioLabel}</p>
                  <p className="text-xs text-white/35 leading-relaxed">Sign in instantly on your next visit using your device biometrics.</p>
                </div>
              </div>
              <button onClick={handleEnableBiometric} disabled={loading}
                className={cn(
                  "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all duration-200",
                  loading ? "bg-white/5 text-white/25 cursor-default" : "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                )}>
                {loading ? "Setting up…" : <>{`Enable ${bioLabel}`} <ArrowRight className="w-4 h-4" strokeWidth={2} /></>}
              </button>
              <button onClick={() => router.replace(postLoginRoute(resolvedKey ?? "member"))}
                className="w-full text-center text-xs text-white/22 hover:text-white/40 transition-colors py-1">
                Not now
              </button>
            </div>
          </>
        )}

        {/* ── Main auth form ────────────────────────────────────────────────── */}
        {step === "form" && (
          <>
            {/* Brand + back link */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate AI</p>
                </div>
                <Link href="/welcome"
                  className="flex items-center gap-1 text-[11px] text-white/22 hover:text-white/45 transition-colors">
                  <ArrowLeft className="w-3 h-3" strokeWidth={1.5} />
                  {roleInfo ? "Change role" : "Role select"}
                </Link>
              </div>

              {roleInfo ? (
                <>
                  <h1 className="text-2xl font-semibold tracking-tight">Continue as {roleInfo.label}</h1>
                  <p className="text-sm text-white/40">{roleInfo.sub}</p>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
                  <p className="text-sm text-white/40">Enter your credentials to continue.</p>
                </>
              )}
            </div>

            {/* Tabs — only for public roles, not admin */}
            {roleInfo && !adminMode && (
              <div className="flex border-b border-white/[0.07]">
                {(["signin", "create"] as const).map((m) => (
                  <button key={m}
                    onClick={() => { setMode(m); setSiError(null); setCaError(null); }}
                    className={cn(
                      "flex-1 py-2.5 text-xs font-semibold tracking-wide transition-all",
                      mode === m
                        ? "text-white border-b-2 border-[#B48B40] -mb-px"
                        : "text-white/30 hover:text-white/55"
                    )}>
                    {m === "signin" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>
            )}

            {/* ── Sign in form ─────────────────────────────────────────────── */}
            {(mode === "signin" || adminMode) && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <TextInput label="Username" value={siUsername}
                  onChange={(v) => { setSiUsername(v); setSiError(null); }}
                  autoComplete="username" error={!!siError} inputRef={siUsernameRef} />

                <PasswordInput label="Password" value={siPassword}
                  onChange={(v) => { setSiPassword(v); setSiError(null); }}
                  show={siShowPass} onToggle={() => setSiShowPass((v) => !v)}
                  autoComplete="current-password" error={!!siError} />

                <div className="flex items-center justify-between min-h-[18px]">
                  {siError
                    ? <p className="text-xs text-red-400/70">{siError}</p>
                    : <span />}
                  <Link href="/forgot-password"
                    className="text-xs text-white/22 hover:text-white/45 transition-colors">
                    Forgot password?
                  </Link>
                </div>

                <RememberMeToggle />

                <button type="submit"
                  disabled={!siUsername || !siPassword || loading}
                  className={cn(
                    "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide transition-all duration-200 mt-2",
                    siUsername && siPassword && !loading
                      ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                      : "bg-white/5 text-white/25 cursor-default"
                  )}>
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            )}

            {/* ── Create account form ──────────────────────────────────────── */}
            {mode === "create" && !adminMode && roleInfo && (
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <TextInput label="Full name" value={caName}
                  onChange={(v) => { setCaName(v); setCaError(null); }}
                  autoComplete="name" error={!!caError} />

                <TextInput label="Username" value={caUsername}
                  onChange={(v) => { setCaUsername(v); setCaError(null); }}
                  autoComplete="username" error={!!caError} />

                <PasswordInput label="Password" value={caPassword}
                  onChange={(v) => { setCaPassword(v); setCaError(null); }}
                  show={caShowPass} onToggle={() => setCaShowPass((v) => !v)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password" error={!!caError} />

                <PasswordInput label="Confirm password" value={caConfirm}
                  onChange={(v) => { setCaConfirm(v); setCaError(null); }}
                  show={caShowConfirm} onToggle={() => setCaShowConfirm((v) => !v)}
                  autoComplete="new-password" error={!!caError} />

                {caError && <p className="text-xs text-red-400/70">{caError}</p>}

                <RememberMeToggle />

                <button type="submit"
                  disabled={!caName || !caUsername || !caPassword || !caConfirm || loading}
                  className={cn(
                    "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide transition-all duration-200 mt-2",
                    caName && caUsername && caPassword && caConfirm && !loading
                      ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                      : "bg-white/5 text-white/25 cursor-default"
                  )}>
                  {loading ? "Creating account…" : "Create account"}
                </button>
              </form>
            )}
          </>
        )}

      </div>
    </div>
  );
}
