"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, ChevronDown } from "lucide-react";
import { useEntitlement }               from "@/hooks/useEntitlement";
import { LockedPageState, UpgradeCard, FEATURES } from "@/components/ui/PlanGate";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { VoiceMic } from "@/components/voice/VoiceMic";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useUser } from "@/context/UserContext";
import { loadActiveProgramForUser, type ActiveProgram } from "@/lib/workout";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role      = "ai" | "user";
type Tone      = "direct" | "supportive" | "analytical";
type Profanity = "off" | "mild";
type Style     = "lite" | "pro";

type Message = {
  id:      string;
  role:    Role;
  text:    string;
  typing?: boolean;
};

type Prompt = {
  id:      string;
  label:   string;
  message: string;
};

// ─── Coach context (derived from real user + active program) ──────────────────

type CoachContext = {
  goal:   string;
  phase:  string;
  week:   string;
  status: string;
};

const FALLBACK_CONTEXT: CoachContext = {
  goal:   "Set in onboarding",
  phase:  "Setup",
  week:   "—",
  status: "Awaiting plan",
};

const GOAL_LABEL: Record<string, string> = {
  muscle_gain: "Hypertrophy",
  fat_loss:    "Fat Loss",
  strength:    "Strength",
  endurance:   "Endurance",
  recomp:      "Body Recomp",
  general:     "General Fitness",
};

function buildContextFromProgram(prog: ActiveProgram | null): CoachContext {
  if (!prog) return FALLBACK_CONTEXT;
  return {
    goal:   GOAL_LABEL[prog.goal] ?? prog.goal,
    phase:  prog.name,
    week:   `Week ${prog.currentWeek} of ${prog.durationWeeks}`,
    status: prog.currentWeek <= prog.durationWeeks ? "On track" : "Block complete",
  };
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const PROMPTS: Prompt[] = [
  { id: "p1", label: "Why did my plan change?",   message: "Why did my plan change?"                             },
  { id: "p2", label: "Adjust for travel",          message: "I'm traveling this week. Can you adjust my plan?"  },
  { id: "p3", label: "Explain my body status",     message: "Can you explain what my body status means right now?" },
  { id: "p4", label: "Simplify today",             message: "Simplify today's session for me."                  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Display labels ───────────────────────────────────────────────────────────

const TONE_LABELS: Record<Tone, string> = {
  direct:     "Direct",
  supportive: "Supportive",
  analytical: "Analytical",
};

const STYLE_LABELS: Record<Style, string> = {
  lite: "Lite",
  pro:  "Pro",
};

// ─── Typing dots ──────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#B48B40]/60 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "900ms" }}
        />
      ))}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isAI = message.role === "ai";
  return (
    <div className={cn("flex gap-3", isAI ? "items-start" : "items-start flex-row-reverse")}>
      {isAI && (
        <div className="w-7 h-7 rounded-full bg-[#1C1C1C] border border-[#B48B40]/25 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[#B48B40] text-xs leading-none">◈</span>
        </div>
      )}
      <div className={cn(
        "rounded-2xl px-4 py-3 max-w-[82%]",
        isAI
          ? "bg-[#111111] border border-white/7 rounded-tl-sm"
          : "bg-[#B48B40]/12 border border-[#B48B40]/18 rounded-tr-sm"
      )}>
        {message.typing ? (
          <TypingDots />
        ) : (
          <p className={cn("text-sm leading-relaxed", isAI ? "text-white/80" : "text-white/70")}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const INITIAL_MESSAGE: Message = { id: "init", role: "ai", text: "What do you need?" };

export default function CoachPage() {
  const { can } = useEntitlement();

  // Page-level gate — Core plan required
  if (!can(FEATURES.COACH)) {
    return <LockedPageState feature={FEATURES.COACH} />;
  }

  return <CoachPageInner />;
}

function CoachPageInner() {
  const { can } = useEntitlement();
  const { user, isLoading: userLoading } = useUser();
  const [messages,    setMessages   ] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input,       setInput      ] = useState("");
  const [loading,     setLoading    ] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [promptsUsed, setPromptsUsed] = useState(false);
  const [context,     setContext    ] = useState<CoachContext>(FALLBACK_CONTEXT);

  // Pull the real active program + derive coach context so the side panel
  // doesn't lie ("Week 3 of 8") to every user.
  useEffect(() => {
    if (userLoading || !user?.id) return;
    let active = true;
    loadActiveProgramForUser(user.id)
      .then((prog) => { if (active) setContext(buildContextFromProgram(prog)); })
      .catch(() => { /* keep fallback */ });
    return () => { active = false; };
  }, [user?.id, userLoading]);

  const voice = useVoiceInput();

  // When voice finishes a final chunk, append it to the text input
  useEffect(() => {
    if (voice.transcript) setInput(voice.transcript);
  }, [voice.transcript]);

  const [tone     ] = useLocalStorage<Tone>     ("coach-tone",      "direct");
  const [profanity] = useLocalStorage<Profanity>("coach-profanity", "off");
  const [style    ] = useLocalStorage<Style>    ("coach-style",     "pro");

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Build conversation history for API — exclude typing placeholders and the init message
  const buildHistory = useCallback((msgs: Message[]) =>
    msgs
      .filter((m) => m.id !== "init" && !m.typing)
      .map((m) => ({ role: m.role === "ai" ? "coach" as const : "user" as const, content: m.text })),
  []);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg:   Message = { id: uid(), role: "user", text: text.trim() };
    const typingId   = uid();
    const typingMsg: Message = { id: typingId, role: "ai", text: "", typing: true };

    setMessages((prev) => [...prev, userMsg, typingMsg]);
    setInput("");
    setLoading(true);
    setPromptsUsed(true);

    try {
      const history = buildHistory(messages);

      const res = await fetch("/api/ai/coach", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          message:   text.trim(),
          history,
          context:   context,
          tone:      tone      ?? "direct",
          style:     style     ?? "pro",
          profanity: profanity ?? "off",
        }),
      });

      const data = await res.json() as { content?: string; error?: string };

      if (!res.ok || !data.content) {
        throw new Error(data.error ?? "No response");
      }

      // Split on double newline → separate bubbles, animated in sequence
      const paragraphs = data.content
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean);

      // Remove typing indicator then stream paragraphs in
      setMessages((prev) => prev.filter((m) => m.id !== typingId));

      paragraphs.forEach((text, i) => {
        setTimeout(() => {
          setMessages((prev) => [...prev, { id: uid(), role: "ai", text }]);
          if (i === paragraphs.length - 1) setLoading(false);
        }, i * 500);
      });

    } catch (err) {
      const errText = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== typingId),
        { id: uid(), role: "ai", text: errText },
      ]);
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  const activeTone      = tone      ?? "direct";
  const activeStyle     = style     ?? "pro";
  const activeProfanity = profanity ?? "off";

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] text-white">

      {/* ── Context bar ──────────────────────────────────────────────── */}
      <div className="border-b border-white/6 bg-[#0A0A0A] shrink-0">
        <button
          onClick={() => setContextOpen((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-3"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/25">Goal</span>
              <span className="text-xs font-medium text-[#B48B40]">{context.goal}</span>
            </div>
            <span className="text-white/10">·</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/25">Phase</span>
              <span className="text-xs font-medium text-white/55">{context.week}</span>
            </div>
            <span className="hidden sm:block text-white/10">·</span>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/25">Status</span>
              <span className="text-xs font-medium text-emerald-400">{context.status}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] uppercase tracking-[0.13em] text-white/22">
              {TONE_LABELS[activeTone]}
            </span>
            <span className="text-white/10">·</span>
            <span className="text-[10px] uppercase tracking-[0.13em] text-white/22">
              {STYLE_LABELS[activeStyle]}
            </span>
            {activeProfanity === "mild" && (
              <>
                <span className="text-white/10">·</span>
                <span className="text-[10px] uppercase tracking-[0.13em] text-[#B48B40]/40">Mild</span>
              </>
            )}
            <ChevronDown
              className={cn("w-3.5 h-3.5 text-white/20 transition-transform ml-1", contextOpen && "rotate-180")}
              strokeWidth={1.5}
            />
          </div>
        </button>

        {contextOpen && (
          <div className="px-6 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-white/5 pt-3">
            {[
              { label: "Goal",   value: context.goal,   color: "text-[#B48B40]"  },
              { label: "Phase",  value: context.phase,  color: "text-white/65"   },
              { label: "Week",   value: context.week,   color: "text-white/65"   },
              { label: "Status", value: context.status, color: "text-emerald-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.1em] text-white/22 mb-1">{label}</p>
                <p className={cn("text-xs font-semibold", color)}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Messages ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-4">
        {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* ── Suggested prompts ────────────────────────────────────────── */}
      {!promptsUsed && (
        <div className="px-4 md:px-6 pb-3 shrink-0">
          <div className="flex gap-2 flex-wrap">
            {PROMPTS.map((p) => (
              <button
                key={p.id}
                onClick={() => sendMessage(p.message)}
                className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2 text-xs text-white/50 hover:text-white/80 hover:border-white/15 hover:bg-white/[0.04] transition-all"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Pro upgrade nudge (shown to Core users after first message) ── */}
      {promptsUsed && !can(FEATURES.COACH_UNLIMITED) && (
        <div className="px-4 md:px-6 pb-2 shrink-0">
          <UpgradeCard feature={FEATURES.COACH_UNLIMITED} compact />
        </div>
      )}

      {/* ── Input bar ────────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 pb-4 md:pb-6 shrink-0">
        <div className={cn(
          "flex items-end gap-3 rounded-2xl border bg-[#111111] px-4 py-3 transition-colors",
          input ? "border-[#B48B40]/30" : "border-white/8"
        )}>
          <textarea
            value={voice.status === "listening" ? (input + (voice.interim ? ` ${voice.interim}` : "")) : input}
            onChange={(e) => { setInput(e.target.value); if (voice.status !== "listening") voice.reset(); }}
            onKeyDown={handleKeyDown}
            placeholder={voice.status === "listening" ? "Listening…" : "Ask anything..."}
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/22 resize-none outline-none leading-relaxed max-h-32 disabled:opacity-50"
            style={{ scrollbarWidth: "none" }}
          />
          <div className="flex items-center gap-1.5 mb-0.5">
            <VoiceMic
              status={voice.status}
              isSupported={voice.isSupported}
              onStart={voice.start}
              onStop={() => { voice.stop(); }}
              size="sm"
            />
            <button
              onClick={() => { sendMessage(input); voice.reset(); }}
              disabled={!input.trim() || loading}
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all",
                input.trim() && !loading
                  ? "bg-[#B48B40] text-black hover:bg-[#c99840]"
                  : "bg-white/5 text-white/20 cursor-not-allowed"
              )}
            >
              <Send className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-white/18 text-center mt-2">
          Shift + Enter for new line · {TONE_LABELS[activeTone]} · {STYLE_LABELS[activeStyle]}
          {activeProfanity === "mild" ? " · Mild" : ""} · Change in Profile
        </p>
      </div>
    </div>
  );
}
