"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Zap, ArrowRight, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionKey, ROLE_TO_USER_ID } from "@/lib/routing";
import {
  loadOnboardingState,
  completePlanningConversation,
  type PlanningData,
  type BodyFocusArea,
} from "@/lib/onboarding";
import { loadIntake } from "@/lib/data/intake";

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  role:    "coach" | "user";
  content: string;
  ts:      number;
};

type QuickReply = {
  label: string;
  value: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(
  intake:       ReturnType<typeof loadIntake>,
  onboarding:   ReturnType<typeof loadOnboardingState>,
): string {
  const goal      = intake?.primaryGoal   ?? onboarding.intakeData?.primaryGoal   ?? "general fitness";
  const exp       = intake?.experience    ?? onboarding.intakeData?.experience     ?? "intermediate";
  const days      = intake?.daysPerWeek   ?? onboarding.intakeData?.daysPerWeek    ?? 4;
  const equip     = (intake?.equipment    ?? onboarding.intakeData?.equipment      ?? []).join(", ") || "gym equipment";
  const injuries  = intake?.injuries      ?? onboarding.intakeData?.injuries       ?? "none";
  const session   = intake?.sessionLength ?? onboarding.intakeData?.sessionLength  ?? "60";
  const focus     = onboarding.bodyFocusAreas?.join(", ") || "full body";
  const primary   = onboarding.primaryFocus ?? "general";

  return `You are a world-class performance coach conducting an onboarding session on Flowstate AI.

You already know this about the user from their intake:
- Goal: ${goal}
- Experience level: ${exp}
- Training days per week: ${days}
- Session length: ${session} minutes
- Available equipment: ${equip}
- Body focus areas: ${focus} (primary: ${primary})
- Injuries/limitations: ${injuries}

Your job:
1. Have a natural coaching conversation — NOT a form or wizard
2. Reference their intake data — never ask for info they already gave
3. Confirm and refine: timeline, training structure, intensity level, split preference
4. Ask ONE question at a time
5. Be direct, confident, and encouraging — coach voice
6. After 6-8 exchanges, propose a finalized plan and ask them to confirm

When finalizing, output a JSON block (wrapped in triple backticks) with this exact structure:
\`\`\`json
{
  "planDuration": "8_weeks",
  "planFocus": "${goal}",
  "intensity": "moderate",
  "split": "upper_lower",
  "coachingStyle": "direct",
  "weeklyTrainingDays": ${days},
  "sessionLength": "${session}",
  "bodyFocusAreas": ${JSON.stringify(onboarding.bodyFocusAreas ?? [])},
  "primaryFocus": "${primary}",
  "constraints": "${injuries}"
}
\`\`\`

After outputting the JSON, end with a brief confirmation message asking if they want to lock in this plan.`;
}

function extractPlanFromMessage(content: string): PlanningData | null {
  try {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (!match) return null;
    const parsed = JSON.parse(match[1].trim()) as PlanningData;
    if (!parsed.planDuration || !parsed.planFocus) return null;
    return parsed;
  } catch {
    return null;
  }
}

function stripJsonBlock(content: string): string {
  return content.replace(/```(?:json)?\s*[\s\S]*?```/g, "").trim();
}

function getQuickReplies(msgCount: number): QuickReply[] {
  if (msgCount <= 1) return [
    { label: "Let's build it", value: "Let's build my plan." },
    { label: "I have questions first", value: "I have some questions before we start." },
  ];
  if (msgCount <= 3) return [
    { label: "Sounds good", value: "Sounds good, let's keep going." },
    { label: "Change my goal", value: "Actually, I want to adjust my goal." },
    { label: "Push it harder", value: "I want to train harder — max intensity." },
  ];
  return [];
}

// ─── Components ───────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: Message }) {
  const isCoach   = message.role === "coach";
  const displayed = isCoach ? stripJsonBlock(message.content) : message.content;
  if (!displayed) return null;

  return (
    <div className={cn("flex gap-3", isCoach ? "items-start" : "items-end flex-row-reverse")}>
      {isCoach && (
        <div className="w-7 h-7 rounded-full bg-[#B48B40]/15 border border-[#B48B40]/25 flex items-center justify-center shrink-0 mt-0.5">
          <Zap className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2.5} />
        </div>
      )}
      <div className={cn(
        "rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[80%]",
        isCoach
          ? "rounded-tl-sm bg-white/[0.04] border border-white/[0.06] text-white/80"
          : "rounded-br-sm bg-[#B48B40]/15 border border-[#B48B40]/20 text-white/85"
      )}>
        {displayed.split("\n").map((line, i) => (
          <span key={i}>{line}{i < displayed.split("\n").length - 1 && <br />}</span>
        ))}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-7 h-7 rounded-full bg-[#B48B40]/15 border border-[#B48B40]/25 flex items-center justify-center shrink-0">
        <Zap className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2.5} />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.06] px-4 py-3.5 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoachPlanningPage() {
  const router = useRouter();

  const [userId,       setUserId]       = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [input,        setInput]        = useState("");
  const [sending,      setSending]      = useState(false);
  const [pendingPlan,  setPendingPlan]  = useState<PlanningData | null>(null);
  const [confirmed,    setConfirmed]    = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const key = getSessionKey();
    if (!key || key === "master") { router.replace("/welcome"); return; }
    const uid = ROLE_TO_USER_ID[key] ?? key;
    setUserId(uid);

    const onboarding = loadOnboardingState(uid);
    const intake     = loadIntake(uid);
    const sysPrompt  = buildSystemPrompt(intake, onboarding);
    setSystemPrompt(sysPrompt);

    // Send opening message from coach
    sendCoachMessage(sysPrompt, [], uid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Scroll to bottom on new message ────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // ── Send coach message via AI ───────────────────────────────────────────────

  async function sendCoachMessage(
    sysPrompt:   string,
    history:     Message[],
    uid:         string,
    userMessage?: string,
  ) {
    setSending(true);

    const apiHistory = history.map((m) => ({
      role:    m.role === "coach" ? "assistant" : "user",
      content: m.content,
    }));

    try {
      const res = await fetch("/api/ai/coach", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage ?? "Start the coaching session with a brief, personalized greeting and your first question.",
          history: apiHistory,
          context: sysPrompt,
          tone:    "direct",
          style:   "pro",
        }),
      });

      if (!res.ok) throw new Error("API error");
      const data = await res.json() as { content: string };

      const coachMsg: Message = { role: "coach", content: data.content, ts: Date.now() };
      setMessages((prev) => [...prev, coachMsg]);

      // Check if coach included a finalized plan JSON
      const plan = extractPlanFromMessage(data.content);
      if (plan) {
        setPendingPlan(plan);
      }
    } catch {
      const errMsg: Message = {
        role: "coach",
        content: "Something went wrong — let's try again. What are you looking to achieve in the next few months?",
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  }

  // ── User sends message ──────────────────────────────────────────────────────

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending || !userId) return;

    setInput("");
    const userMsg: Message = { role: "user", content, ts: Date.now() };
    const updatedHistory   = [...messages, userMsg];
    setMessages(updatedHistory);

    await sendCoachMessage(systemPrompt, updatedHistory, userId, content);
    inputRef.current?.focus();
  }

  // ── Confirm plan ────────────────────────────────────────────────────────────

  function handleConfirm() {
    if (!userId || !pendingPlan) return;
    completePlanningConversation(userId, pendingPlan);
    setConfirmed(true);
    setTimeout(() => router.push("/onboarding/program-generation"), 1200);
  }

  // ── Textarea auto-resize ────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const quickReplies = getQuickReplies(messages.length);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="w-7 h-7 rounded-full bg-[#B48B40]/15 border border-[#B48B40]/25 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/80">AI Coach</p>
          <p className="text-[11px] text-white/30">Building your plan</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        {messages.length === 0 && !sending && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 text-white/20 animate-spin" strokeWidth={1.5} />
          </div>
        )}

        {messages.map((m) => (
          <ChatBubble key={m.ts} message={m} />
        ))}

        {sending && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Confirm plan banner */}
      {pendingPlan && !confirmed && (
        <div className="mx-5 mb-3 rounded-2xl border border-[#B48B40]/25 bg-[#B48B40]/8 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#B48B40]">Plan ready to lock in</p>
            <p className="text-[11px] text-white/40 mt-0.5">
              {pendingPlan.planDuration?.replace("_", " ")} · {pendingPlan.split?.replace(/_/g, " ")} · {pendingPlan.weeklyTrainingDays} days/week
            </p>
          </div>
          <button
            onClick={handleConfirm}
            className="shrink-0 px-4 py-2 rounded-xl bg-[#B48B40] text-black text-xs font-semibold flex items-center gap-1.5 hover:bg-[#c99840] active:scale-[0.97] transition-all"
          >
            Lock it in <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {confirmed && (
        <div className="mx-5 mb-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/8 px-4 py-3">
          <p className="text-xs font-semibold text-emerald-400">Plan confirmed — generating your program…</p>
        </div>
      )}

      {/* Quick replies */}
      {quickReplies.length > 0 && !sending && !pendingPlan && messages.length > 0 && (
        <div className="px-5 pb-2 flex flex-wrap gap-2">
          {quickReplies.map((qr) => (
            <button
              key={qr.value}
              onClick={() => handleSend(qr.value)}
              className="px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white/50 hover:border-white/20 hover:text-white/75 transition-all"
            >
              {qr.label}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="px-5 pb-6 pt-2 border-t border-white/[0.06]">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={1}
            disabled={sending || confirmed}
            className={cn(
              "flex-1 bg-white/[0.04] border border-white/8 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/22 outline-none focus:border-white/20 transition-all resize-none",
              "max-h-32 overflow-y-auto",
              (sending || confirmed) && "opacity-40 cursor-default"
            )}
            style={{ height: "auto" }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending || confirmed}
            className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all",
              input.trim() && !sending && !confirmed
                ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.95]"
                : "bg-white/5 text-white/20 cursor-default"
            )}
          >
            {sending
              ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
              : <Send className="w-4 h-4" strokeWidth={2} />}
          </button>
        </div>
        <p className="text-[10px] text-white/18 mt-2">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
