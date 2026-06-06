"use client";

// Read-only view of a client's AI-coach conversations, for the coach. Lists
// past conversations; shows the selected transcript as chat bubbles.

import { useState, useEffect, useCallback } from "react";
import { Bot, Loader2, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Conv = { id: string; preview: string; updatedAt: string };
type Msg = { role: string; text: string };

export function ClientAICoachView({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [list, setList] = useState<Conv[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Msg[]>([]);
  const [loadingT, setLoadingT] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/ai-conversations`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setList(Array.isArray(j?.conversations) ? j.conversations : []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [clientId]);

  const openConv = useCallback((id: string) => {
    setActiveId(id); setLoadingT(true);
    fetch(`/api/clients/${clientId}/ai-conversations?id=${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setTranscript(Array.isArray(j?.transcript) ? j.transcript : []))
      .catch(() => setTranscript([]))
      .finally(() => setLoadingT(false));
  }, [clientId]);

  if (!loaded) return <div className="flex items-center gap-2 text-white/40 text-xs py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  if (list.length === 0) return <p className="text-sm text-white/35 text-center py-10">{clientName} hasn&apos;t chatted with the AI coach yet.</p>;

  // Transcript view
  if (activeId) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <button onClick={() => { setActiveId(null); setTranscript([]); }} className="self-start inline-flex items-center gap-1 text-xs text-white/50 hover:text-white/80 mb-2 shrink-0">
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} /> All AI conversations
        </button>
        <div className="flex-1 overflow-y-auto space-y-2.5 py-1">
          {loadingT ? (
            <div className="flex items-center gap-2 text-white/40 text-xs py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : transcript.map((m, i) => {
            const fromUser = m.role === "user";
            return (
              <div key={i} className={cn("flex", fromUser ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[82%] rounded-2xl px-3.5 py-2", fromUser ? "bg-white/[0.06] text-white/85 border border-white/[0.06]" : "bg-[#B48B40]/[0.10] text-white/80 border border-[#B48B40]/15")}>
                  {!fromUser && <p className="text-[9px] uppercase tracking-wider text-[#B48B40]/60 mb-0.5">AI coach</p>}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-white/25 pt-2 shrink-0">Read-only — this is {clientName}&apos;s conversation with the AI coach.</p>
      </div>
    );
  }

  // List view
  const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <div className="space-y-1.5 overflow-y-auto">
      {list.map((c) => (
        <button key={c.id} onClick={() => openConv(c.id)} className="w-full flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-left hover:border-white/15 transition-colors">
          <Bot className="w-4 h-4 text-[#B48B40]/70 mt-0.5 shrink-0" strokeWidth={1.8} />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-white/80 truncate">{c.preview}</span>
            <span className="block text-[10px] text-white/30 mt-0.5">{date(c.updatedAt)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
