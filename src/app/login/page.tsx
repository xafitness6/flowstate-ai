"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Zap, Fingerprint, ArrowRight, Eye, EyeOff, ArrowLeft, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { createAccount, resolveAccount } from "@/lib/accounts";
import { resolvePostLoginRoute } from "@/lib/routing";
import { createClient } from "@/lib/supabase/client";
import { resolveOnboardingRoute } from "@/lib/db/onboarding";
import {
  isAdminEmail,
  hasAdminPassword,
  verifyAdminPassword,
  createAdminPassword,
} from "@/lib/adminCredentials";
import {
  isPlatformAuthenticatorAvailable,
  hasSavedCredential,
  getBiometricLabel,
  registerBiometric,
  authenticateWithBiometric,
  clearBiometric,
} from "@/lib/biometric";

// ─── Constants ────────────────────────────────────────────────────────────────

type AuthStep = "form" | "biometric-prompt" | "enable-biometric" | "admin-create-password";
type AuthMode = "signin" | "create";

const LS_KEY = "flowstate-active-role";
const SS_KEY = "flowstate-session-role";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve demo/local credentials. Returns session key or null. */
function resolveDemoCredentials(
  usernameOrEmail: string,
  password: string,
): { sessionKey: string } | null {
  // Hard-coded demo accounts (alex/flowstate, kai/flowstate, luca/flowstate)
  const DEMO: Record<string, { username: string; password: string }> = {
    trainer: { username: "alex", password: "flowstate" },
    client:  { username: "kai",  password: "flowstate" },
    member:  { username: "luca", password: "flowstate" },
  };
  for (const [key, entry] of Object.entries(DEMO)) {
    if (
      usernameOrEmail.trim().toLowerCase() === entry.username.toLowerCase() &&
      password === entry.password
    ) {
      return { sessionKey: key };
    }
  }
  // Dynamically created local accounts
  const account = resolveAccount(usernameOrEmail, password);
  if (account) return { sessionKey: account.id };
  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TextField({
  label,
  value,
  onChange,
  autoComplete,
  type = "text",
  error,
  inputRef,
  placeholder,
}: {
  label:        string;
  value:        string;
  onChange:     (v: string) => void;
  autoComplete?: string;
  type?:        string;
  error?:       boolean;
  inputRef?:    React.RefObject<HTMLInputElement | null>;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">{label}</label>
      <input
        ref={inputRef as React.RefObject<HTMLInputElement> | undefined}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        placeholder={placeholder}
        className={cn(
          "w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none transition-all",
          error
            ? "border-red-400/30 focus:border-red-400/50"
            : "border-white/8 focus:border-white/20",
        )}
      />
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  placeholder,
  error,
}: {
  label:        string;
  value:        string;
  onChange:     (v: string) => void;
  show:         boolean;
  onToggle:     () => void;
  autoComplete?: string;
  placeholder?: string;
  error?:       boolean;
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
            error
              ? "border-red-400/30 focus:border-red-400/50"
              : "border-white/8 focus:border-white/20",
          )}
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/22 hover:text-white/50 transition-colors"
        >
          {show
            ? <EyeOff className="w-4 h-4" strokeWidth={1.5} />
            : <Eye    className="w-4 h-4" strokeWidth={1.5} />}
        </button>
      </div>
    </div>
  );
}

function RememberMe({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <div
        className={cn(
          "w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-all",
          checked
            ? "border-[#B48B40]/60 bg-[#B48B40]/20"
            : "border-white/15 bg-transparent group-hover:border-white/25",
        )}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-[#B48B40]" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-xs text-white/40 select-none">Remember me</span>
    </label>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function LoginPageContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [step,     setStep]     = useState<AuthStep>("form");
  const [mode,     setMode]     = useState<AuthMode>("signin");

  // Sync tab from query param after mount/navigation.
  // useEffect runs after hydration so searchParams is reliably populated.
  // /login?tab=create → signup tab, /login → sign in tab.
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "create") setMode("create");
    else                  setMode("signin");
  }, [searchParams]);
  const [loading,  setLoading]  = useState(false);

  // Sign in
  const [siEmail,    setSiEmail]    = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siShowPass, setSiShowPass] = useState(false);
  const [siError,    setSiError]    = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  // Create account
  const [caName,        setCaName]        = useState("");
  const [caEmail,       setCaEmail]       = useState("");
  const [caPassword,    setCaPassword]    = useState("");
  const [caConfirm,     setCaConfirm]     = useState("");
  const [caShowPass,    setCaShowPass]    = useState(false);
  const [caShowConfirm, setCaShowConfirm] = useState(false);
  const [caError,       setCaError]       = useState<string | null>(null);

  // Admin first-time password creation
  const [adminNewPass,     setAdminNewPass]     = useState("");
  const [adminConfirmPass, setAdminConfirmPass] = useState("");
  const [adminShowNew,     setAdminShowNew]     = useState(false);
  const [adminShowConfirm, setAdminShowConfirm] = useState(false);
  const [adminError,       setAdminError]       = useState<string | null>(null);

  // Biometric
  const [resolvedKey,  setResolvedKey]  = useState<string | null>(null);
  const [bioLabel,     setBioLabel]     = useState("Quick Login");
  const [bioError,     setBioError]     = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBioLabel(getBiometricLabel());

    if (hasSavedCredential()) {
      isPlatformAuthenticatorAvailable().then((ok) => {
        if (ok) setStep("biometric-prompt");
      });
    } else {
      isPlatformAuthenticatorAvailable().then(setBioAvailable);
    }

    setTimeout(() => emailRef.current?.focus(), 50);
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

    // Admin skips biometric
    if (sessionKey === "master") {
      clearBiometric();
      router.replace(resolvePostLoginRoute(sessionKey));
      return;
    }

    if (bioAvailable && !hasSavedCredential()) {
      setLoading(false);
      setStep("enable-biometric");
    } else {
      router.replace(resolvePostLoginRoute(sessionKey));
    }
  }

  // ── Sign in ────────────────────────────────────────────────────────────────

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSiError(null);

    // Admin path (email-based)
    if (isAdminEmail(siEmail)) {
      if (!hasAdminPassword()) { setStep("admin-create-password"); return; }
      if (!verifyAdminPassword(siPassword)) { setSiError("Incorrect password."); return; }
      setLoading(true);
      afterLogin("master");
      return;
    }

    // Demo / local account path (accepts username or email)
    const demo = resolveDemoCredentials(siEmail, siPassword);
    if (demo) {
      setLoading(true);
      afterLogin(demo.sessionKey);
      return;
    }

    // Supabase path
    if (siEmail.includes("@")) {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email:    siEmail.trim().toLowerCase(),
        password: siPassword,
      });
      if (error || !data.user) {
        setSiError("Incorrect email or password.");
        setLoading(false);
        return;
      }
      // UserContext picks up the session via onAuthStateChange.
      // Resolve route from DB onboarding + subscription state.
      const { getMyProfile } = await import("@/lib/db/profiles");
      const profile = await getMyProfile();
      const onboardingRoute = await resolveOnboardingRoute(data.user.id);
      if (onboardingRoute) {
        router.replace(onboardingRoute);
        return;
      }
      router.replace(
        resolvePostLoginRoute(data.user.id, {
          role:               profile?.role,
          subscriptionStatus: profile?.subscription_status,
        }),
      );
      return;
    }

    setSiError("Incorrect email or password.");
  }

  // ── Create account ─────────────────────────────────────────────────────────

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setCaError(null);

    if (!caName.trim())           { setCaError("Please enter your name.");                  return; }
    if (!caEmail.trim())          { setCaError("Please enter your email.");                 return; }
    if (!caEmail.includes("@"))   { setCaError("Enter a valid email address.");             return; }
    if (caPassword.length < 6)    { setCaError("Password must be at least 6 characters."); return; }
    if (caPassword !== caConfirm) { setCaError("Passwords don't match.");                   return; }

    const supabaseConfigured =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseConfigured) {
      // Supabase signup — role is always "client" for public signups
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email:    caEmail.trim().toLowerCase(),
        password: caPassword,
        options:  {
          data: {
            full_name: caName.trim(),
            role:      "client", // DB trigger reads this; never allow public trainer/admin creation
          },
        },
      });
      if (error || !data.user) {
        setCaError(error?.message ?? "Could not create account. Try a different email.");
        setLoading(false);
        return;
      }
      // New Supabase users always start at calibration (no onboarding state yet)
      router.replace("/onboarding/calibration");
      return;
    }

    // No Supabase — create local account.
    // Derive a username from the email prefix for the local store.
    setLoading(true);
    const username = caEmail.trim().toLowerCase().split("@")[0].replace(/[^a-z0-9_]/g, "");
    const result = createAccount(
      username || `user_${Date.now()}`,
      caPassword,
      "client", // always client
      caName.trim(),
      caEmail.trim().toLowerCase(),
    );
    if ("error" in result) {
      setCaError(result.error);
      setLoading(false);
      return;
    }
    afterLogin(result.id);
  }

  // ── Admin first-time password ──────────────────────────────────────────────

  function handleAdminCreatePassword(e: React.FormEvent) {
    e.preventDefault();
    setAdminError(null);
    if (adminNewPass.length < 8)     { setAdminError("Password must be at least 8 characters."); return; }
    if (adminNewPass !== adminConfirmPass) { setAdminError("Passwords don't match.");             return; }
    try {
      createAdminPassword(adminNewPass);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Failed to create password.");
      return;
    }
    setLoading(true);
    afterLogin("master");
  }

  // ── Biometric ─────────────────────────────────────────────────────────────

  async function handleBiometricLogin() {
    setLoading(true);
    setBioError(false);
    const savedKey = await authenticateWithBiometric();
    if (savedKey) {
      try { localStorage.setItem(LS_KEY, savedKey); } catch { /* ignore */ }
      router.replace(resolvePostLoginRoute(savedKey));
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
    router.replace(resolvePostLoginRoute(resolvedKey));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 md:px-8 py-16 text-white">
      <div className="max-w-sm w-full space-y-8">

        {/* ── Biometric prompt ────────────────────────────────────────────── */}
        {step === "biometric-prompt" && (
          <>
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate</p>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="text-sm text-white/40">Use {bioLabel} to sign in instantly.</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={handleBiometricLogin}
                disabled={loading}
                className={cn(
                  "w-full rounded-2xl border py-5 flex flex-col items-center gap-3 transition-all duration-150",
                  loading
                    ? "border-white/6 bg-white/[0.02] cursor-default"
                    : "border-[#B48B40]/40 bg-[#B48B40]/5 hover:bg-[#B48B40]/10 active:scale-[0.98]",
                )}
              >
                <Fingerprint
                  className={cn("w-9 h-9", loading ? "text-white/20" : "text-[#B48B40]")}
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
                onClick={() => { clearBiometric(); setStep("form"); setBioError(false); }}
                className="w-full text-center text-xs text-white/22 hover:text-white/40 transition-colors py-1"
              >
                Use email and password instead
              </button>
            </div>
          </>
        )}

        {/* ── Enable biometric ─────────────────────────────────────────────── */}
        {step === "enable-biometric" && (
          <>
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate</p>
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
                  <p className="text-xs text-white/35 leading-relaxed">
                    Sign in instantly on your next visit using your device biometrics.
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
                    : "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]",
                )}
              >
                {loading
                  ? "Setting up…"
                  : <>{`Enable ${bioLabel}`} <ArrowRight className="w-4 h-4" strokeWidth={2} /></>}
              </button>

              <button
                onClick={() => {
                  const key = sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_KEY) || "member";
                  router.replace(resolvePostLoginRoute(key));
                }}
                className="w-full text-center text-xs text-white/22 hover:text-white/40 transition-colors py-1"
              >
                Not now
              </button>
            </div>
          </>
        )}

        {/* ── Admin: first-time password creation ──────────────────────────── */}
        {step === "admin-create-password" && (
          <>
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate</p>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-white/40" strokeWidth={1.5} />
                <h1 className="text-2xl font-semibold tracking-tight">Create your password</h1>
              </div>
              <p className="text-sm text-white/40">
                First sign-in. Set a secure password for your account.
              </p>
            </div>

            <form onSubmit={handleAdminCreatePassword} className="space-y-4">
              <PasswordField
                label="New password"
                value={adminNewPass}
                onChange={(v) => { setAdminNewPass(v); setAdminError(null); }}
                show={adminShowNew}
                onToggle={() => setAdminShowNew((v) => !v)}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                error={!!adminError}
              />
              <PasswordField
                label="Confirm password"
                value={adminConfirmPass}
                onChange={(v) => { setAdminConfirmPass(v); setAdminError(null); }}
                show={adminShowConfirm}
                onToggle={() => setAdminShowConfirm((v) => !v)}
                autoComplete="new-password"
                error={!!adminError}
              />
              {adminError && <p className="text-xs text-red-400/70">{adminError}</p>}
              <button
                type="submit"
                disabled={!adminNewPass || !adminConfirmPass || loading}
                className={cn(
                  "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all duration-200 mt-2",
                  adminNewPass && adminConfirmPass && !loading
                    ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                    : "bg-white/5 text-white/25 cursor-default",
                )}
              >
                {loading ? "Setting up…" : <>Set password <ArrowRight className="w-4 h-4" strokeWidth={2} /></>}
              </button>
              <button
                type="button"
                onClick={() => { setStep("form"); setAdminNewPass(""); setAdminConfirmPass(""); setAdminError(null); }}
                className="w-full text-center text-xs text-white/22 hover:text-white/40 transition-colors py-1"
              >
                Back
              </button>
            </form>
          </>
        )}

        {/* ── Main auth form ────────────────────────────────────────────────── */}
        {step === "form" && (
          <>
            {/* Brand */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate</p>
                </div>
                <Link
                  href="/welcome"
                  className="flex items-center gap-1 text-[11px] text-white/22 hover:text-white/45 transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" strokeWidth={1.5} />
                  Back
                </Link>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {mode === "signin" ? "Welcome back" : "Create account"}
              </h1>
              <p className="text-sm text-white/40">
                {mode === "signin"
                  ? "Sign in to continue."
                  : "Start your Flowstate journey."}
              </p>
            </div>

            {/* Mode tabs */}
            <div className="flex border-b border-white/[0.07]">
              {(["signin", "create"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setSiError(null); setCaError(null); }}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-semibold tracking-wide transition-all",
                    mode === m
                      ? "text-white border-b-2 border-[#B48B40] -mb-px"
                      : "text-white/30 hover:text-white/55",
                  )}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            {/* ── Sign in form ──────────────────────────────────────────────── */}
            {mode === "signin" && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <TextField
                  label="Email"
                  value={siEmail}
                  onChange={(v) => { setSiEmail(v); setSiError(null); }}
                  autoComplete="email"
                  type="text"
                  error={!!siError}
                  inputRef={emailRef}
                  placeholder="you@example.com"
                />
                <PasswordField
                  label="Password"
                  value={siPassword}
                  onChange={(v) => { setSiPassword(v); setSiError(null); }}
                  show={siShowPass}
                  onToggle={() => setSiShowPass((v) => !v)}
                  autoComplete="current-password"
                  error={!!siError}
                />

                <div className="flex items-center justify-between min-h-[18px]">
                  {siError
                    ? <p className="text-xs text-red-400/70">{siError}</p>
                    : <span />}
                  <Link
                    href="/forgot-password"
                    className="text-xs text-white/22 hover:text-white/45 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                <RememberMe checked={rememberMe} onChange={setRememberMe} />

                <button
                  type="submit"
                  disabled={!siEmail || !siPassword || loading}
                  className={cn(
                    "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide transition-all duration-200 mt-2",
                    siEmail && siPassword && !loading
                      ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                      : "bg-white/5 text-white/25 cursor-default",
                  )}
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            )}

            {/* ── Create account form ───────────────────────────────────────── */}
            {mode === "create" && (
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <TextField
                  label="Full name"
                  value={caName}
                  onChange={(v) => { setCaName(v); setCaError(null); }}
                  autoComplete="name"
                  placeholder="Jane Smith"
                  error={!!caError}
                />
                <TextField
                  label="Email"
                  value={caEmail}
                  onChange={(v) => { setCaEmail(v); setCaError(null); }}
                  autoComplete="email"
                  type="email"
                  placeholder="you@example.com"
                  error={!!caError}
                />
                <PasswordField
                  label="Password"
                  value={caPassword}
                  onChange={(v) => { setCaPassword(v); setCaError(null); }}
                  show={caShowPass}
                  onToggle={() => setCaShowPass((v) => !v)}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  error={!!caError}
                />
                <PasswordField
                  label="Confirm password"
                  value={caConfirm}
                  onChange={(v) => { setCaConfirm(v); setCaError(null); }}
                  show={caShowConfirm}
                  onToggle={() => setCaShowConfirm((v) => !v)}
                  autoComplete="new-password"
                  error={!!caError}
                />

                {caError && <p className="text-xs text-red-400/70">{caError}</p>}

                <RememberMe checked={rememberMe} onChange={setRememberMe} />

                <button
                  type="submit"
                  disabled={!caName || !caEmail || !caPassword || !caConfirm || loading}
                  className={cn(
                    "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide transition-all duration-200 mt-2",
                    caName && caEmail && caPassword && caConfirm && !loading
                      ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                      : "bg-white/5 text-white/25 cursor-default",
                  )}
                >
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

// Suspense boundary required by Next.js App Router for useSearchParams().
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0A]" />}>
      <LoginPageContent />
    </Suspense>
  );
}
