"use client";

// Reusable trainer↔client message thread. Coach mounts it with mineFromCoach;
// the client mounts it without. Polls lightly so new messages appear.

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { id: string; from_coach: boolean; text: string; created_at: string };

export function ChatThread({ endpoint, mineFromCoach, emptyHint }: { endpoint: string; mineFromCoach: boolean; emptyHint?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetch(endpoint, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j?.messages)) setMessages(j.messages); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [endpoint]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    // optimistic
    const optimistic: Msg = { id: `tmp-${Date.now()}`, from_coach: mineFromCoach, text, created_at: new Date().toISOString() };
    setMessages((p) => [...p, optimistic]);
    setInput("");
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Send failed");
      setMessages((p) => p.map((m) => (m.id === optimistic.id ? (j.message as Msg) : m)));
    } catch {
      setMessages((p) => p.filter((m) => m.id !== optimistic.id)); // revert
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  const time = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto space-y-2.5 py-2">
        {!loaded ? (
          <div className="flex items-center gap-2 text-white/40 text-xs py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-white/35 text-center py-10">{emptyHint ?? "No messages yet — say hi."}</p>
        ) : (
          messages.map((m) => {
            const mine = m.from_coach === mineFromCoach;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2",
                  mine ? "bg-[#B48B40] text-black" : "bg-white/[0.05] text-white/85 border border-white/[0.06]",
                )}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</p>
                  <p className={cn("text-[10px] mt-1", mine ? "text-black/45" : "text-white/30")}>{time(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-white/[0.06] pt-3 mt-1">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          rows={1}
          placeholder="Write a message…"
          className="flex-1 resize-none bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/50 max-h-32"
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          className="shrink-0 w-10 h-10 rounded-xl bg-[#B48B40] text-black flex items-center justify-center hover:bg-[#c99840] disabled:opacity-50 transition-all"
          aria-label="Send"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
}
