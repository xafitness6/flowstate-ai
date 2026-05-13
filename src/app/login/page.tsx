"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, Fingerprint, ArrowRight, Eye, EyeOff, Mail, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveAccount } from "@/lib/accounts";
import { resolvePostLoginRoute } from "@/lib/routing";
import { createClient } from "@/lib/supabase/client";
import {
  isPlatformAuthenticatorAvailable,
  hasSavedCredential,
  getBiometricLabel,
  registerBiometric,
  registerBiometricWithSession,
  authenticateWithBiometric,
  authenticateWithBiometricSession,
  saveBiometricSession,
  clearBiometric,
  type BiometricSession,
} from "@/lib/biometric";

// ─── Constants ────────────────────────────────────────────────────────────────

type AuthStep = "form" | "biometric-prompt" | "enable-biometric";

const LS_KEY = "flowstate-active-role";
const SS_KEY = "flowstate-session-role";
const ADMIN_EMAIL = "xavellis4@gmail.com";

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
  const router = useRouter();

  const [step,     setStep]     = useState<AuthStep>("form");
  const [loading,  setLoading]  = useState(false);

  // Sign in
  const [siEmail,    setSiEmail]    = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siShowPass, setSiShowPass] = useState(false);
  const [siError,    setSiError]    = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  // Biometric
  const [resolvedKey,      setResolvedKey]      = useState<string | null>(null);
  const [bioLabel,         setBioLabel]         = useState("Quick Login");
  const [bioError,         setBioError]         = useState(false);
  const [bioAvailable,     setBioAvailable]     = useState(false);
  const [pendingSession,   setPendingSession]   = useState<BiometricSession | null>(null);
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);

  // Magic link
  const [magicSent, setMagicSent] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get("error");
      const reason = params.get("reason");
      if (authError === "auth") {
        setSiError(
          reason === "exchange"
            ? "Sign-in started, but Supabase could not finish the callback. Check the production redirect URL and try again."
            : "Sign-in could not be completed. Try email and password, or check the Supabase auth setup.",
        );
      } else if (authError === "archived") {
        setSiError("This account has been archived. Contact your admin to restore access.");
      }
    } catch { /* ignore */ }

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
      if (rememberMe) {
        localStorage.setItem(LS_KEY, key);
        sessionStorage.removeItem(SS_KEY);
      } else {
        sessionStorage.setItem(SS_KEY, key);
        localStorage.removeItem(LS_KEY);
      }
    } catch { /* ignore */ }
  }

  function afterLogin(sessionKey: string) {
    setResolvedKey(sessionKey);
    saveSession(sessionKey);

    if (bioAvailable && !hasSavedCredential()) {
      setLoading(false);
      setStep("enable-biometric");
    } else {
      router.replace(resolvePostLoginRoute(sessionKey));
    }
  }

  async function syncCurrentProfile() {
    try {
      const res = await fetch("/api/auth/sync-profile", { method: "POST" });
      if (!res.ok) return null;
      const body = await res.json() as { profile?: { role?: string; is_admin?: boolean } };
      return body.profile ?? null;
    } catch {
      return null;
    }
  }

  async function routeSupabaseUser(
    userId: string,
    email?: string | null,
    opts: { offerBiometric?: boolean } = {},
  ) {
    saveSession(userId);

    const syncedProfile = await syncCurrentProfile();
    const { getMyProfile } = await import("@/lib/db/profiles");
    const { resolveOnboardingRoute } = await import("@/lib/db/onboarding");

    const profile = await getMyProfile();

    // Archived users are locked out — even on a successful sign-in, drop them.
    if (profile?.archived_at) {
      const { signOutEverywhere } = await import("@/lib/auth/signOut");
      await signOutEverywhere({ redirect: "/login?error=archived" });
      return;
    }

    const role = syncedProfile?.role ?? profile?.role;
    const isAdmin =
      email?.trim().toLowerCase() === ADMIN_EMAIL ||
      role === "master" ||
      syncedProfile?.is_admin ||
      profile?.is_admin;

    let destination: string;
    if (isAdmin) {
      destination = "/admin";
    } else {
      const blocker = await resolveOnboardingRoute(userId);
      destination = blocker ?? resolvePostLoginRoute(userId, { role });
    }

    if (opts.offerBiometric && bioAvailable && !hasSavedCredential()) {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && session?.refresh_token) {
        setResolvedKey(userId);
        setPendingSession({
          access_token:  session.access_token,
          refresh_token: session.refresh_token,
        });
        setPendingDestination(destination);
        setLoading(false);
        setStep("enable-biometric");
        return;
      }
    }

    window.location.replace(destination);
  }

  async function routeExistingSession() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return false;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    await routeSupabaseUser(user.id, user.email);
    return true;
  }

  useEffect(() => {
    void routeExistingSession();

    // Backstop: if the session arrives via a delayed cookie write
    // (post-OAuth race) the SIGNED_IN event fires and we route immediately.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        void routeSupabaseUser(session.user.id, session.user.email);
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sign in ────────────────────────────────────────────────────────────────

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSiError(null);

    // Demo / local account path (accepts username or email)
    const demo = siEmail.includes("@") ? null : resolveDemoCredentials(siEmail, siPassword);
    if (demo) {
      setLoading(true);
      afterLogin(demo.sessionKey);
      return;
    }

    // Supabase path
    if (siEmail.includes("@")) {
      setLoading(true);
      const email = siEmail.trim().toLowerCase();
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: siPassword,
      });
      if (error || !data.user) {
        setSiError(
          email === ADMIN_EMAIL
            ? "Admin login failed. Reset the Supabase admin password with scripts/setup-admin.mjs, then try again."
            : "Incorrect email or password.",
        );
        setLoading(false);
        return;
      }
      await routeSupabaseUser(data.user.id, data.user.email);
      return;
    }

    setSiError("Incorrect email or password.");
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────

  async function handleGoogleLogin() {
    setSiError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setSiError("Google sign-in is not available. Try email instead.");
        setLoading(false);
      }
      // On success, the browser navigates to Google; nothing else to do here.
    } catch {
      setSiError("Google sign-in failed. Try email instead.");
      setLoading(false);
    }
  }

  // ── Magic link ────────────────────────────────────────────────────────────

  async function handleMagicLink() {
    setSiError(null);
    const trimmed = siEmail.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setSiError("Enter your email above first.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setSiError(error.message);
        setLoading(false);
        return;
      }
      setMagicSent(true);
    } catch {
      setSiError("Couldn't send the link. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Biometric ─────────────────────────────────────────────────────────────

  async function handleBiometricLogin() {
    setLoading(true);
    setBioError(false);

    // Path 1: session-aware (real Supabase user). Restore the session and route.
    const bioSession = await authenticateWithBiometricSession();
    if (bioSession) {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.setSession(bioSession);
        if (error || !data.session || !data.user) {
          clearBiometric();
          setLoading(false);
          setBioError(true);
          setStep("form");
          return;
        }
        // Supabase rotates refresh tokens — persist the fresh pair for next time.
        saveBiometricSession({
          access_token:  data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        await routeSupabaseUser(data.user.id, data.user.email);
        return;
      } catch {
        clearBiometric();
        setLoading(false);
        setBioError(true);
        setStep("form");
        return;
      }
    }

    // Path 2: legacy demo-role biometric (no Supabase session was stored).
    const savedKey = await authenticateWithBiometric();
    if (savedKey && savedKey !== "__supabase__") {
      try { localStorage.setItem(LS_KEY, savedKey); } catch { /* ignore */ }
      router.replace(resolvePostLoginRoute(savedKey));
      return;
    }

    setLoading(false);
    setBioError(true);
  }

  async function handleEnableBiometric() {
    setLoading(true);
    if (pendingSession) {
      await registerBiometricWithSession(pendingSession);
    } else if (resolvedKey) {
      await registerBiometric(resolvedKey);
    }
    setLoading(false);

    const dest = pendingDestination
      ?? (resolvedKey ? resolvePostLoginRoute(resolvedKey) : "/");
    router.replace(dest);
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
                  if (pendingDestination) {
                    router.replace(pendingDestination);
                    return;
                  }
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

        {/* ── Main auth form ────────────────────────────────────────────────── */}
        {step === "form" && (
          <>
            {/* Brand */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate</p>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="text-sm text-white/40">Sign in to continue.</p>
            </div>

            {/* Google OAuth */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className={cn(
                "w-full rounded-2xl border py-3.5 text-sm font-medium flex items-center justify-center gap-2.5 transition-all duration-150",
                loading
                  ? "border-white/6 bg-white/[0.02] text-white/30 cursor-default"
                  : "border-white/10 bg-white/[0.04] text-white/85 hover:bg-white/[0.07] hover:border-white/15 active:scale-[0.99]",
              )}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/6" />
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/22">Or with email</p>
              <div className="flex-1 h-px bg-white/6" />
            </div>

            {/* Sign in form */}
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

              {magicSent ? (
                <div className="flex items-center gap-2 justify-center text-xs text-emerald-400/80 py-1">
                  <Check className="w-3.5 h-3.5" strokeWidth={2} />
                  Magic link sent — check your inbox
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={!siEmail || loading}
                  className={cn(
                    "w-full flex items-center justify-center gap-1.5 text-xs transition-colors py-1",
                    siEmail && !loading
                      ? "text-white/45 hover:text-white/70"
                      : "text-white/20 cursor-default",
                  )}
                >
                  <Mail className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Email me a sign-in link instead
                </button>
              )}
            </form>

            {/* Invite-only note */}
            <p className="text-center text-[11px] text-white/18 leading-relaxed">
              Invite only — contact your coach to get access.
            </p>
          </>
        )}

      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageContent />;
}
