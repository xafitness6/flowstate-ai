"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Zap, ArrowRight, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInviteByToken, isInviteValid, acceptInvite } from "@/lib/invites";
import { createAccount, resolveAccount } from "@/lib/accounts";
import { resolvePostLoginRoute } from "@/lib/routing";
import type { Invite } from "@/lib/invites";

// ─── Storage keys ─────────────────────────────────────────────────────────────

const LS_KEY = "flowstate-active-role";

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = "text", autoComplete, placeholder, error,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; autoComplete?: string; placeholder?: string; error?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
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

function PasswordField({
  label, value, onChange, show, onToggle, autoComplete, placeholder, error,
}: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void;
  autoComplete?: string; placeholder?: string; error?: boolean;
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
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/22 hover:text-white/50 transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token  = params?.token as string;

  const [invite,       setInvite]      = useState<Invite | null>(null);
  const [loadError,    setLoadError]   = useState<string | null>(null);
  const [accepted,     setAccepted]    = useState(false);
  const [step,         setStep]        = useState<"landing" | "signup">("landing");

  // Form fields
  const [name,         setName]        = useState("");
  const [email,        setEmail]       = useState("");
  const [username,     setUsername]    = useState("");
  const [password,     setPassword]    = useState("");
  const [confirm,      setConfirm]     = useState("");
  const [showPass,     setShowPass]    = useState(false);
  const [showConfirm,  setShowConfirm] = useState(false);
  const [formError,    setFormError]   = useState<string | null>(null);
  const [loading,      setLoading]     = useState(false);

  // ── Load invite on mount ──────────────────────────────────────────────────

  useEffect(() => {
    if (!token) { setLoadError("Invalid invite link."); return; }
    const inv = getInviteByToken(token);
    if (!inv) { setLoadError("Invite not found. The link may be incorrect."); return; }
    const check = isInviteValid(inv);
    if (!check.valid) { setLoadError(check.reason ?? "This invite is no longer valid."); return; }
    setInvite(inv);
    // Pre-fill known fields
    setName(`${inv.firstName} ${inv.lastName}`.trim());
    setEmail(inv.inviteEmail);
    setUsername(inv.firstName.toLowerCase().replace(/\s+/g, ""));
  }, [token]);

  // ── Accept invite ─────────────────────────────────────────────────────────

  function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!invite) return;
    setFormError(null);

    if (!name.trim())         { setFormError("Please enter your name.");              return; }
    if (!email.trim() || !email.includes("@")) { setFormError("Enter a valid email."); return; }
    if (!username.trim() || username.length < 3) { setFormError("Username must be at least 3 characters."); return; }
    if (password.length < 6)  { setFormError("Password must be at least 6 characters."); return; }
    if (password !== confirm)  { setFormError("Passwords don't match.");               return; }

    setLoading(true);

    // Try to create account; if email already exists, try to sign in
    const result = createAccount(
      username.trim(),
      password,
      "client",
      name.trim(),
      email.trim().toLowerCase(),
      { inviteToken: token, assignedTrainerId: invite.assignedTrainerId },
    );

    if ("error" in result) {
      // Username taken — try to sign in instead
      const existing = resolveAccount(email.trim().toLowerCase(), password);
      if (!existing) {
        setFormError(result.error);
        setLoading(false);
        return;
      }
      // Sign in existing account
      acceptInvite(token);
      try { localStorage.setItem(LS_KEY, existing.id); } catch { /* ignore */ }
      setAccepted(true);
      setTimeout(() => router.replace(resolvePostLoginRoute(existing.id)), 1800);
      return;
    }

    // New account created
    acceptInvite(token);
    try { localStorage.setItem(LS_KEY, result.id); } catch { /* ignore */ }
    setAccepted(true);
    setTimeout(() => router.replace(resolvePostLoginRoute(result.id)), 1800);
  }

  // ── Render: error state ───────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 text-white">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-14 h-14 rounded-full bg-red-400/10 border border-red-400/20 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-red-400/70" strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-white/80">Invite unavailable</h1>
            <p className="text-sm text-white/40">{loadError}</p>
          </div>
          <button
            onClick={() => router.replace("/welcome")}
            className="w-full rounded-2xl border border-white/8 py-3 text-sm text-white/50 hover:text-white/75 transition-colors"
          >
            Go to Flowstate
          </button>
        </div>
      </div>
    );
  }

  if (!invite) {
    return <div className="min-h-screen bg-[#0A0A0A]" />;
  }

  // ── Render: accepted ──────────────────────────────────────────────────────

  if (accepted) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 text-white">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-14 h-14 rounded-full bg-[#B48B40]/15 border border-[#B48B40]/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-[#B48B40]" strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-white/80">You&apos;re in.</h1>
            <p className="text-sm text-white/40">Setting up your account…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: landing ───────────────────────────────────────────────────────

  if (step === "landing") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 py-16 text-white">
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[#B48B40]/[0.04] blur-[120px]" />
        </div>

        <div className="relative max-w-sm w-full space-y-10">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
            <span className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate AI</span>
          </div>

          {/* Invite message */}
          <div className="space-y-5">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/28">Personal invite</p>
              <h1 className="text-3xl font-semibold tracking-tight leading-tight">
                {invite.firstName}, you&apos;re invited.
              </h1>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#B48B40]/15 border border-[#B48B40]/25 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-[#B48B40]">
                    {invite.invitedByName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/75">{invite.invitedByName}</p>
                  <p className="text-xs text-white/35">Your coach on Flowstate</p>
                </div>
              </div>

              {invite.message && (
                <p className="text-sm text-white/55 leading-relaxed border-t border-white/[0.05] pt-3">
                  &ldquo;{invite.message}&rdquo;
                </p>
              )}
            </div>

            <p className="text-xs text-white/28 leading-relaxed">
              Flowstate is your performance operating system. Track training, follow your program, and get guided every step.
            </p>
          </div>

          <button
            onClick={() => setStep("signup")}
            className="w-full rounded-2xl bg-[#B48B40] text-black py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 hover:bg-[#c99840] active:scale-[0.98] transition-all duration-200"
          >
            Accept invite &amp; get started <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </button>

          <p className="text-center text-[11px] text-white/18">
            Invited to: {invite.inviteEmail}
          </p>
        </div>
      </div>
    );
  }

  // ── Render: signup ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 py-16 text-white">
      <div className="max-w-sm w-full space-y-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate AI</p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-sm text-white/40">
            Invited by <span className="text-white/60">{invite.invitedByName}</span>
          </p>
        </div>

        <form onSubmit={handleAccept} className="space-y-4">
          <Field
            label="Full name"
            value={name}
            onChange={(v) => { setName(v); setFormError(null); }}
            autoComplete="name"
            error={!!formError}
          />

          <Field
            label="Email"
            value={email}
            onChange={(v) => { setEmail(v); setFormError(null); }}
            type="email"
            autoComplete="email"
            error={!!formError}
          />

          <Field
            label="Username"
            value={username}
            onChange={(v) => { setUsername(v); setFormError(null); }}
            autoComplete="username"
            placeholder="Choose a username"
            error={!!formError}
          />

          <PasswordField
            label="Create password"
            value={password}
            onChange={(v) => { setPassword(v); setFormError(null); }}
            show={showPass}
            onToggle={() => setShowPass((v) => !v)}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            error={!!formError}
          />

          <PasswordField
            label="Confirm password"
            value={confirm}
            onChange={(v) => { setConfirm(v); setFormError(null); }}
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            autoComplete="new-password"
            error={!!formError}
          />

          {formError && <p className="text-xs text-red-400/70">{formError}</p>}

          <button
            type="submit"
            disabled={!name || !email || !username || !password || !confirm || loading}
            className={cn(
              "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all duration-200 mt-2",
              name && email && username && password && confirm && !loading
                ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                : "bg-white/5 text-white/25 cursor-default"
            )}
          >
            {loading ? "Creating account…" : <>Create account <ArrowRight className="w-4 h-4" strokeWidth={2} /></>}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setStep("landing")}
          className="w-full text-center text-xs text-white/22 hover:text-white/40 transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}
