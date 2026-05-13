"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });

      // Always show success — never reveal whether the email exists (email enumeration protection)
      if (resetError) {
        console.error("Password reset error:", resetError.message);
      }
    } catch (err) {
      console.error("Unexpected password reset error:", err);
    } finally {
      setLoading(false);
      setSent(true);
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
            {sent ? "Check your email" : "Forgot password?"}
          </h1>
          <p className="text-sm text-white/40">
            {sent
              ? "If an account exists for that address, a reset link has been sent."
              : "Enter your account email and we'll send a reset link."}
          </p>
        </div>

        {sent && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/6 bg-white/[0.02] px-5 py-6 flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-full border border-[#B48B40]/30 bg-[#B48B40]/8 flex items-center justify-center">
                <Check className="w-6 h-6 text-[#B48B40]" strokeWidth={1.5} />
              </div>
              <p className="text-sm text-white/55 leading-relaxed">
                Didn&apos;t get it? Check your spam folder or{" "}
                <button
                  onClick={() => setSent(false)}
                  className="text-[#B48B40]/80 hover:text-[#B48B40] underline underline-offset-2 transition-colors"
                >
                  try again
                </button>
                .
              </p>
            </div>

            <button
              onClick={() => router.push("/login")}
              className="w-full rounded-2xl py-4 text-sm font-semibold tracking-wide bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98] transition-all duration-200"
            >
              Back to sign in
            </button>
          </div>
        )}

        {!sent && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@example.com"
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
              disabled={!email || loading}
              className={cn(
                "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide transition-all duration-200 mt-2",
                email && !loading
                  ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                  : "bg-white/5 text-white/25 cursor-default"
              )}
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/login")}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-white/22 hover:text-white/45 transition-colors py-1"
            >
              <ArrowLeft className="w-3 h-3" strokeWidth={1.5} />
              Back to sign in
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
