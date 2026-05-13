"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, Eye, EyeOff, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);

  // Verify we have an active recovery session. The user only lands here after
  // clicking the email link, which the /auth/callback route has just turned
  // into a Supabase session via exchangeCodeForSession.
  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSessionOk(!!session);
    })();

    // Supabase also emits PASSWORD_RECOVERY in some flows — treat that as ok.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setSessionOk(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function validate(): string | null {
    if (password.length < 8)  return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = validate();
    if (msg) { setError(msg); return; }
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 md:px-8 py-16 text-white">
      <div className="max-w-sm w-full space-y-8">

        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate AI</p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {done ? "Password updated" : "Set new password"}
          </h1>
          <p className="text-sm text-white/40">
            {done
              ? "Your password has been changed. You can now sign in."
              : "Choose a strong password for your account."}
          </p>
        </div>

        {sessionOk === false && !done && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-400/15 bg-red-400/5 px-5 py-5 text-center">
              <p className="text-sm text-red-400/80">
                This reset link is invalid or has expired.
              </p>
              <p className="text-xs text-white/30 mt-1">Request a new link to continue.</p>
            </div>
            <button
              onClick={() => router.push("/forgot-password")}
              className="w-full rounded-2xl py-4 text-sm font-semibold tracking-wide bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98] transition-all duration-200"
            >
              Request a new link
            </button>
          </div>
        )}

        {done && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/6 bg-white/[0.02] px-5 py-6 flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-full border border-[#B48B40]/30 bg-[#B48B40]/8 flex items-center justify-center">
                <Check className="w-6 h-6 text-[#B48B40]" strokeWidth={1.5} />
              </div>
              <p className="text-sm text-white/55 leading-relaxed">
                Your new password is active.
              </p>
            </div>
            <button
              onClick={() => router.push("/login")}
              className="w-full rounded-2xl py-4 text-sm font-semibold tracking-wide bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98] transition-all duration-200"
            >
              Sign in
            </button>
          </div>
        )}

        {sessionOk === true && !done && (
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  className={cn(
                    "w-full bg-white/[0.04] border rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder:text-white/18 outline-none transition-all",
                    error
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

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                Confirm password
              </label>
              <input
                type={showPass ? "text" : "password"}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                autoComplete="new-password"
                placeholder="Re-enter password"
                className={cn(
                  "w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/18 outline-none transition-all",
                  error
                    ? "border-red-400/30 focus:border-red-400/50"
                    : "border-white/8 focus:border-white/20"
                )}
              />
            </div>

            {error && (
              <p className="text-xs text-red-400/70">{error}</p>
            )}

            <button
              type="submit"
              disabled={!password || !confirm || loading}
              className={cn(
                "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide transition-all duration-200 mt-2",
                password && confirm && !loading
                  ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                  : "bg-white/5 text-white/25 cursor-default"
              )}
            >
              {loading ? "Updating…" : "Update password"}
            </button>

          </form>
        )}

      </div>
    </div>
  );
}
