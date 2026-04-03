"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, ArrowRight, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { createAccount } from "@/lib/accounts";
import type { Role } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

type SignupStep = "role" | "details";
type SignupRole = Exclude<Role, "master">;

const LS_KEY = "flowstate-active-role";
const SS_KEY = "flowstate-session-role";

const ROLE_OPTIONS: { key: SignupRole; label: string; sub: string; plan: string }[] = [
  { key: "member",  label: "Member",  sub: "Self-guided training & accountability", plan: "Foundation"  },
  { key: "client",  label: "Client",  sub: "Full coaching & nutrition guidance",    plan: "Training"    },
  { key: "trainer", label: "Trainer", sub: "Manage clients & build programs",       plan: "Performance" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter();

  const [step,         setStep]         = useState<SignupStep>("role");
  const [selectedRole, setSelectedRole] = useState<SignupRole | null>(null);
  const [name,         setName]         = useState("");
  const [username,     setUsername]     = useState("");
  const [password,     setPassword]     = useState("");
  const [confirmPass,  setConfirmPass]  = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [rememberMe,   setRememberMe]   = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function handleRoleSelect(role: SignupRole) {
    setSelectedRole(role);
    setStep("details");
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  function saveSession(key: string) {
    try {
      if (rememberMe) {
        localStorage.setItem(LS_KEY, key);
      } else {
        sessionStorage.setItem(SS_KEY, key);
      }
    } catch { /* ignore */ }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedRole)          return;
    if (!name.trim())            { setError("Please enter your name.");                    return; }
    if (!username.trim())        { setError("Please choose a username.");                  return; }
    if (username.trim().length < 3) { setError("Username must be at least 3 characters."); return; }
    if (password.length < 6)    { setError("Password must be at least 6 characters.");    return; }
    if (password !== confirmPass){ setError("Passwords don't match.");                     return; }

    setLoading(true);

    const result = createAccount(username.trim(), password, selectedRole, name.trim());

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Store the account ID as the session key — used by UserContext and AppShell
    // to identify this specific user, same as demo accounts use their role key.
    saveSession(result.id);
    router.replace("/onboarding");
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
          <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
          <p className="text-sm text-white/40">
            {step === "role" ? "Choose how you'll use Flowstate." : "Set up your login credentials."}
          </p>
        </div>

        {/* ── Step 1: Role selection ───────────────────────────────────────────── */}
        {step === "role" && (
          <div className="space-y-3">
            {ROLE_OPTIONS.map(({ key, label, sub, plan }) => (
              <button
                key={key}
                onClick={() => handleRoleSelect(key)}
                className="w-full rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-4 text-left hover:border-white/15 hover:bg-white/[0.04] transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white/80">{label}</p>
                    <p className="text-xs text-white/30 mt-0.5">{sub}</p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-[10px] uppercase tracking-wider text-white/20">{plan}</span>
                    <ArrowRight
                      className="w-4 h-4 text-white/18 group-hover:text-white/45 transition-colors"
                      strokeWidth={1.5}
                    />
                  </div>
                </div>
              </button>
            ))}

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="text-xs text-white/22 hover:text-white/45 transition-colors"
              >
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        )}

        {/* ── Step 2: Details form ─────────────────────────────────────────────── */}
        {step === "details" && selectedRole && (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Role chip — tap to go back */}
            <button
              type="button"
              onClick={() => { setStep("role"); setError(null); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all"
            >
              <span className="text-xs text-white/50 capitalize">{selectedRole}</span>
              <span className="text-[10px] text-white/25">← change</span>
            </button>

            {/* Full name */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                Full name
              </label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                autoComplete="name"
                className={cn(
                  "w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/18 outline-none transition-all",
                  error ? "border-red-400/30 focus:border-red-400/50" : "border-white/8 focus:border-white/20"
                )}
              />
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(null); }}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className={cn(
                  "w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/18 outline-none transition-all",
                  error ? "border-red-400/30 focus:border-red-400/50" : "border-white/8 focus:border-white/20"
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
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={cn(
                    "w-full bg-white/[0.04] border rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder:text-white/18 outline-none transition-all",
                    error ? "border-red-400/30 focus:border-red-400/50" : "border-white/8 focus:border-white/20"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/22 hover:text-white/50 transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                Confirm password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPass}
                  onChange={(e) => { setConfirmPass(e.target.value); setError(null); }}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={cn(
                    "w-full bg-white/[0.04] border rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder:text-white/18 outline-none transition-all",
                    error ? "border-red-400/30 focus:border-red-400/50" : "border-white/8 focus:border-white/20"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/22 hover:text-white/50 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && <p className="text-xs text-red-400/70">{error}</p>}

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
              disabled={!name || !username || !password || !confirmPass || loading}
              className={cn(
                "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide transition-all duration-200 mt-2",
                name && username && password && confirmPass && !loading
                  ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                  : "bg-white/5 text-white/25 cursor-default"
              )}
            >
              {loading ? "Creating account…" : "Create account"}
            </button>

            <div className="text-center pt-1">
              <Link
                href="/login"
                className="text-xs text-white/22 hover:text-white/40 transition-colors"
              >
                Already have an account? Sign in
              </Link>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
