"use client";

// Coach/admin account actions on the client file: resend the email-confirmation
// mail, or reset the client's password to a fresh temp one (shown once so the
// coach can pass it along). Backed by POST /api/clients/[id]/account.

import { useState } from "react";
import { Mail, KeyRound, Loader2, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClientAccountActions({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [busy, setBusy] = useState<null | "confirm" | "reset">(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run(action: "resend_confirmation" | "reset_password") {
    if (busy) return;
    if (action === "reset_password" && !confirm(`Reset ${clientName}'s password? Their current password stops working and you'll get a new temporary one to share.`)) return;
    setBusy(action === "resend_confirmation" ? "confirm" : "reset");
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

  return (
    <div className="no-print mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-sm font-semibold text-white/85 mb-1">Account</p>
      <p className="text-xs text-white/40 mb-3">Help {clientName} get into the app.</p>
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
