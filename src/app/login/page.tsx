"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import { redirectPasswordSessionToReset, signInWithPassword } from "@/lib/auth/service";
import { resolvePostAuthDestination } from "@/lib/auth/postLogin";
import { signOutEverywhere } from "@/lib/auth/signOut";

function PasswordField({
  value,
  onChange,
  show,
  onToggle,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  error?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
        Password
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
          className={cn(
            "w-full bg-white/[0.04] border rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder:text-white/18 outline-none transition-all",
            error ? "border-red-400/30 focus:border-red-400/50" : "border-white/8 focus:border-white/20",
          )}
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/22 hover:text-white/50 transition-colors"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show
            ? <EyeOff className="w-4 h-4" strokeWidth={1.5} />
            : <Eye className="w-4 h-4" strokeWidth={1.5} />}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (redirectPasswordSessionToReset()) return;

    try {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get("error");
      const reason = params.get("reason");
      const queryNotice = params.get("notice");

      if (queryNotice === "confirmation_used" || queryNotice === "email_confirmed") {
        setNotice("Your email is confirmed. Sign in to continue onboarding.");
      }
      if (authError === "archived") {
        setError("This account is not currently active. Contact your coach for access.");
      } else if (authError === "auth") {
        setError(
          reason === "exchange"
            ? "Sign-in started, but could not be completed. Try signing in again."
            : "Sign-in could not be completed. Try email and password again.",
        );
      } else if (authError === "invite") {
        setError("Sign in with the email your coach invited to continue onboarding.");
      }
    } catch { /* ignore */ }

    window.setTimeout(() => emailRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;

    async function routeExistingSession() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const routed = await resolvePostAuthDestination({
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      });
      if (cancelled) return;
      if (routed.kind === "archived") {
        await signOutEverywhere({ redirect: routed.destination });
        return;
      }
      window.location.replace(routed.destination);
    }

    void routeExistingSession().catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    if (!isSupabaseConfigured()) {
      setError("Supabase is not configured for this environment.");
      return;
    }

    setLoading(true);
    const result = await signInWithPassword(cleanEmail, password);
    if (!result.ok) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    const user = result.data.data.user;
    if (!user) {
      setError("Sign-in could not be completed. Try again.");
      setLoading(false);
      return;
    }

    const routed = await resolvePostAuthDestination({
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    });

    if (routed.kind === "archived") {
      await signOutEverywhere({ redirect: routed.destination });
      return;
    }

    window.location.replace(routed.destination);
  }

  return (
    <div className="min-h-[100dvh] overflow-y-auto flex flex-col items-center justify-start sm:justify-center px-5 md:px-8 py-8 sm:py-10 text-white">
      <div className="max-w-sm w-full space-y-7">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate</p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-white/40">Sign in with your invited account.</p>
        </div>

        {notice && (
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-2 text-xs leading-relaxed text-emerald-300/80">
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
              Email
            </label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); setNotice(null); }}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              className={cn(
                "w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none transition-all",
                error ? "border-red-400/30 focus:border-red-400/50" : "border-white/8 focus:border-white/20",
              )}
            />
          </div>

          <PasswordField
            value={password}
            onChange={(v) => { setPassword(v); setError(null); setNotice(null); }}
            show={showPass}
            onToggle={() => setShowPass((v) => !v)}
            error={!!error}
          />

          <div className="flex items-center justify-between min-h-[18px]">
            {error ? <p className="text-xs text-red-400/70">{error}</p> : <span />}
            <Link
              href="/forgot-password"
              className="text-xs text-white/22 hover:text-white/45 transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={!email || !password || loading}
            className={cn(
              "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide transition-all duration-200 mt-2 flex items-center justify-center gap-2",
              email && password && !loading
                ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                : "bg-white/5 text-white/25 cursor-default",
            )}
          >
            {loading ? "Signing in..." : <>Sign in <ArrowRight className="w-4 h-4" strokeWidth={2} /></>}
          </button>
        </form>

        <p className="text-center text-[11px] text-white/18 leading-relaxed">
          Invite only - contact your coach or admin for access.
        </p>

        {/* Legal footer — every pre-auth surface needs these reachable. */}
        <div className="flex items-center justify-center gap-5 pt-2 text-[11px] text-white/25">
          <Link href="/privacy"    className="hover:text-[#B48B40] transition-colors">Privacy</Link>
          <Link href="/terms"      className="hover:text-[#B48B40] transition-colors">Terms</Link>
          <Link href="/disclaimer" className="hover:text-[#B48B40] transition-colors">Disclaimer</Link>
        </div>
      </div>
    </div>
  );
}
