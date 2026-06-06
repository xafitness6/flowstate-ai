"use client";

// Client-facing chat with their human coach (separate from the AI coach).

import { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { ChatThread } from "@/components/chat/ChatThread";

export default function MessagesPage() {
  const [info, setInfo] = useState<{ hasCoach: boolean; coachName: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/me/messages", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setInfo({ hasCoach: !!j?.hasCoach, coachName: j?.coachName ?? null }))
      .catch(() => setInfo({ hasCoach: false, coachName: null }));
  }, []);

  return (
    <div className="px-5 md:px-8 py-6 max-w-2xl mx-auto text-white flex flex-col h-[calc(100dvh-56px-6rem)] min-h-[26rem] md:h-[calc(100dvh-56px-1.5rem)]">
      <h1 className="text-2xl font-semibold tracking-tight mb-1 flex items-center gap-2 shrink-0">
        <MessageSquare className="w-5 h-5 text-[#B48B40]" strokeWidth={1.8} />
        {info?.coachName ? info.coachName : "Your coach"}
      </h1>
      <p className="text-xs text-white/40 mb-3 shrink-0">Direct messages with your coach. For instant help, use the AI coach tab.</p>

      {info && !info.hasCoach ? (
        <div className="flex-1 flex items-center justify-center text-center">
          <p className="text-sm text-white/40 max-w-xs">You don&apos;t have a coach assigned yet. Once you do, you can message them here.</p>
        </div>
      ) : (
        <ChatThread endpoint="/api/me/messages" mineFromCoach={false} emptyHint={`Send ${info?.coachName ?? "your coach"} a message.`} />
      )}
    </div>
  );
}
