"use client";

// Coach/admin account actions on the client file: resend the email-confirmation
// mail, or reset the client's password to a fresh temp one (shown once so the
// coach can pass it along). Backed by POST /api/clients/[id]/account.

import { useState, useEffect, useCallback } from "react";
import { Mail, KeyRound, Loader2, Check, Copy, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClientAccountActions({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [busy, setBusy] = useState<null | "confirm" | "reset" | "verify">(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState<string | null | undefined>(undefined); // undefined = loading

  const loadStatus = useCallback(async () => {
    try {
      const j = await fetch(`/api/clients/${clientId}/account`, { cache: "no-store" }).then((r) => r.json());
      setConfirmedAt(j?.emailConfirmedAt ?? null);
    } catch { setConfirmedAt(null); }
  }, [clientId]);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  async function run(action: "resend_confirmation" | "reset_password" | "confirm_email") {
    if (busy) return;
    if (action === "reset_password" && !confirm(`Reset ${clientName}'s password? Their current password stops working and you'll get a new temporary one to share.`)) return;
    if (action === "confirm_email" && !confirm(`Manually confirm ${clientName}'s email? This verifies them without the email link.`)) return;
    setBusy(action === "resend_confirmation" ? "confirm" : action === "confirm_email" ? "verify" : "reset");
    setMsg(null); setTempPw(null); setCopied(false);
    try {
      const res = await fetch(`/api/clients/${clientId}/account`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Action failed.");
      if (action === "resend_confirmation") {
        setMsg({ kind: "ok", text: `Confirmation email sent to ${j.email}. Tell them to check spam if it doesn't arrive.` });
      } else if (action === "confirm_email") {
        setConfirmedAt(j.emailConfirmedAt ?? new Date().toISOString());
        setMsg({ kind: "ok", text: `${clientName}'s email is now confirmed — they can log in.` });
      } else {
        setTempPw(j.password as string);
        setMsg({ kind: "ok", text: "New temporary password set. Share it privately — they can change it in Profile." });
      }
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Action failed." });
    } finally {
      setBusy(null);
    }
  }

  const confirmed = !!confirmedAt;

  return (
    <div className="no-print mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-sm font-semibold text-white/85 mb-1">Account</p>
      <p className="text-xs text-white/40 mb-3">Help {clientName} get into the app.</p>

      {/* Email confirmation status */}
      {confirmedAt !== undefined && (
        <div className={cn(
          "mb-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
          confirmed ? "border-emerald-400/25 bg-emerald-400/[0.07]" : "border-amber-400/25 bg-amber-400/[0.06]",
        )}>
          <span className={cn("text-xs font-semibold flex items-center gap-1.5", confirmed ? "text-emerald-300" : "text-amber-300")}>
            {confirmed
              ? <><ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} /> Email confirmed</>
              : <><ShieldAlert className="w-3.5 h-3.5" strokeWidth={2} /> Email not confirmed</>}
          </span>
          {!confirmed && (
            <button
              onClick={() => run("confirm_email")}
              disabled={!!busy}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#B48B40] text-black px-2.5 py-1.5 text-[11px] font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all"
            >
              {busy === "verify" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" strokeWidth={2.5} />}
              Confirm now
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => run("resend_confirmation")}
          disabled={!!busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 hover:border-[#B48B40]/40 hover:text-[#B48B40] disabled:opacity-50 transition-all"
        >
          {busy === "confirm" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" strokeWidth={1.8} />}
          Resend confirmation email
        </button>
        <button
          onClick={() => run("reset_password")}
          disabled={!!busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 hover:border-[#B48B40]/40 hover:text-[#B48B40] disabled:opacity-50 transition-all"
        >
          {busy === "reset" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" strokeWidth={1.8} />}
          Reset password
        </button>
      </div>

      {tempPw && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#B48B40]/25 bg-[#B48B40]/[0.06] px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Temporary password</p>
            <p className="text-sm font-semibold text-white/90 font-mono truncate">{tempPw}</p>
          </div>
          <button
            onClick={() => { navigator.clipboard?.writeText(tempPw).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-white/12 px-2.5 py-1.5 text-[11px] text-white/70 hover:text-white/95"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" strokeWidth={2.5} /> : <Copy className="w-3 h-3" strokeWidth={2} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      {msg && (
        <p className={cn("mt-2 text-xs", msg.kind === "ok" ? "text-emerald-400/80" : "text-red-300/80")}>{msg.text}</p>
      )}
    </div>
  );
}
