"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, ChevronDown, Check, RotateCcw, Utensils, Dumbbell, NotebookPen, Clock, Plus, X, MessageSquare, Trash2, AudioLines, Video, Loader2, AlertTriangle } from "lucide-react";
import { useEntitlement }               from "@/hooks/useEntitlement";
import { LockedPageState, UpgradeCard, FEATURES } from "@/components/ui/PlanGate";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useVoiceConversation } from "@/hooks/useVoiceConversation";
import { VoiceMic } from "@/components/voice/VoiceMic";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useUser } from "@/context/UserContext";
import { loadActiveProgramForUser, type ActiveProgram } from "@/lib/workout";
import { GroupedMealReviewModal, type ReviewMealInput } from "@/components/nutrition/GroupedMealReviewModal";
import { saveHydrationLog } from "@/lib/nutrition/hydration";
import type { LoggedMeal, NutritionParseResult, MealType } from "@/lib/nutrition/types";
import { logWorkoutComplete, logReflection, undoCoachLog } from "@/lib/coach/actions";
import { saveReadiness, getTodayReadiness, formatReadinessContext } from "@/lib/coach/readiness";
import type { CoachIntentOutput } from "@/lib/ai/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "ai" | "user";

type ActionCard = {
  kind:    "meal" | "workout" | "reflection";
  summary: string;
  undo?:   () => void;
  undone?: boolean;
  href?:   string;
};

type Message = {
  id:      string;
  role:    Role;
  text:    string;
  typing?: boolean;
  action?: ActionCard;
  /** Optional avatar video — populated by the coach-avatar API on demand. */
  avatar?: { status: "loading" | "ready" | "error"; videoUrl?: string; error?: string };
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

const INTENSITY_LABELS: Record<number, string> = {
  1: "Gentle",
  2: "Supportive",
  3: "Balanced",
  4: "Firm",
  5: "Militant",
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

function MessageBubble({ message, onPlayAvatar }: {
  message:      Message;
  onPlayAvatar: (messageId: string) => void;
}) {
  const isAI         = message.role === "ai";
  const canPlayAvatar = isAI && !message.typing && !message.action && message.text.trim().length > 0;
  return (
    <div className={cn("flex gap-3", isAI ? "items-start" : "items-start flex-row-reverse")}>
      {isAI && (
        <div className="w-7 h-7 rounded-full bg-[#1C1C1C] border border-[#B48B40]/25 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[#B48B40] text-xs leading-none">◈</span>
        </div>
      )}
      <div className={cn(
        "rounded-2xl px-4 py-3 max-w-[82%] space-y-2",
        isAI
          ? "bg-[#111111] border border-white/7 rounded-tl-sm"
          : "bg-[#B48B40]/12 border border-[#B48B40]/18 rounded-tr-sm"
      )}>
        {message.typing ? (
          <TypingDots />
        ) : message.action ? (
          <ActionCardView action={message.action} />
        ) : (
          <p className={cn("text-sm leading-relaxed", isAI ? "text-white/80" : "text-white/70")}>
            {message.text}
          </p>
        )}

        {/* Avatar video — appears when the user taps "Play as video" on an AI reply */}
        {message.avatar?.status === "ready" && message.avatar.videoUrl && (
          <video
            src={message.avatar.videoUrl}
            controls
            autoPlay
            playsInline
            className="w-full max-w-[300px] rounded-xl border border-white/10 bg-black mt-2"
          />
        )}
        {message.avatar?.status === "error" && (
          <p className="text-[11px] text-red-300/75 flex items-center gap-1.5 mt-1">
            <AlertTriangle className="w-3 h-3" strokeWidth={1.8} />
            {message.avatar.error ?? "Couldn't generate video."}
          </p>
        )}
        {canPlayAvatar && !message.avatar && (
          <button
            onClick={() => onPlayAvatar(message.id)}
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B48B40]/65 hover:text-[#B48B40] transition-colors pt-1"
            title="Generate a talking-head video of this reply"
          >
            <Video className="w-3 h-3" strokeWidth={1.8} />
            Play as video
          </button>
        )}
        {message.avatar?.status === "loading" && (
          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 pt-1">
            <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
            Rendering avatar…
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Action result card ───────────────────────────────────────────────────────

const ACTION_ICON = { meal: Utensils, workout: Dumbbell, reflection: NotebookPen } as const;
const ACTION_LABEL = { meal: "Meal logged", workout: "Workout logged", reflection: "Saved & shared with your coach" } as const;

function ActionCardView({ action }: { action: ActionCard }) {
  const Icon = ACTION_ICON[action.kind];
  return (
    <div className="flex items-center gap-2.5 min-w-[200px]">
      <div className="w-6 h-6 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
        {action.undone
          ? <RotateCcw className="w-3 h-3 text-white/40" strokeWidth={2} />
          : <Check className="w-3 h-3 text-emerald-400/80" strokeWidth={2.5} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-white/70">
          {action.undone ? "Removed" : ACTION_LABEL[action.kind]}
        </p>
        <p className="text-xs text-white/45 truncate flex items-center gap-1.5">
          {action.summary}
          {!action.undone && <Icon className="w-3 h-3 text-white/25 shrink-0" strokeWidth={1.5} />}
        </p>
      </div>
      {action.undo && !action.undone && (
        <button
          onClick={action.undo}
          className="shrink-0 text-[11px] font-semibold text-[#B48B40] hover:text-[#c99840] transition-colors flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" strokeWidth={2} /> Undo
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const INITIAL_MESSAGE: Message = { id: "init", role: "ai", text: "What do you need?" };

export default function CoachPage() {
  const { can } = useEntitlement();

  // Page-level gate — Foundation gets basic coach access; unlimited depth stays gated.
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
  // Persistent conversations (cross-device).
  const [convId,      setConvId     ] = useState<string | null>(null);
  const [convList,    setConvList   ] = useState<{ id: string; preview: string; updatedAt: string }[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [convLoaded,  setConvLoaded ] = useState(false);
  const isRealUser = !!user?.id && /^[0-9a-f-]{36}$/i.test(user.id) && !!process.env.NEXT_PUBLIC_SUPABASE_URL;

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

  // ── Live, hands-free voice conversation ──────────────────────────────────────
  // Continuous mic: each spoken utterance auto-sends as a message; the coach's
  // reply is spoken back, then listening resumes — a real back-and-forth that
  // reads as a normal chat thread.
  const conv = useVoiceConversation((text) => { voice.reset(); void sendMessage(text); });
  const liveRef = useRef(false);
  useEffect(() => { liveRef.current = conv.active; }, [conv.active]);

  // Speak the coach's reply (live mode only), then un-pause the mic on end so it
  // never transcribes the coach's own voice.
  const speakThenResume = useCallback((text: string) => {
    if (!liveRef.current) return;
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth || !text.trim()) { conv.setPaused(false); return; }
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[*_#`>]/g, ""));
      u.rate = 1.05;
      const resume = () => conv.setPaused(false);
      u.onend = resume; u.onerror = resume;
      synth.speak(u);
    } catch { conv.setPaused(false); }
  }, [conv]);

  const [intensity,      setIntensity]      = useLocalStorage<number> ("coach-intensity",       3);
  const [strongLanguage, setStrongLanguage] = useLocalStorage<boolean>("coach-strong-language", false);

  // Review-first meal logging from chat (reuses the nutrition review modal)
  const [reviewMeals, setReviewMeals] = useState<ReviewMealInput[]>([]);

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

  // ── Persistence: load the most recent conversation, save as it changes ──────
  const fetchConvList = useCallback(() => {
    fetch("/api/me/coach-conversations", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j?.conversations)) setConvList(j.conversations); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isRealUser) { setConvLoaded(true); return; }
    let active = true;
    fetch("/api/me/coach-conversations", { cache: "no-store" })
      .then((r) => r.json())
      .then(async (j) => {
        if (!active) return;
        const list = Array.isArray(j?.conversations) ? j.conversations : [];
        setConvList(list);
        if (list[0]) {
          const t = await fetch(`/api/me/coach-conversations?id=${list[0].id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
          const tr = Array.isArray(t?.transcript) ? t.transcript : [];
          if (active && tr.length) {
            setConvId(list[0].id);
            setMessages([INITIAL_MESSAGE, ...tr.map((m: { role: string; text: string }, i: number) => ({ id: `h${i}`, role: m.role === "user" ? "user" as const : "ai" as const, text: m.text }))]);
          }
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setConvLoaded(true); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Debounced save of the active transcript.
  useEffect(() => {
    if (!isRealUser || !convLoaded || loading) return;
    const transcript = messages.filter((m) => m.id !== "init" && !m.typing && m.text.trim()).map((m) => ({ role: m.role, text: m.text }));
    if (transcript.length === 0) return;
    const h = setTimeout(() => {
      fetch("/api/me/coach-conversations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: convId ?? undefined, transcript }) })
        .then((r) => r.json())
        .then((j) => { if (j?.id && !convId) { setConvId(j.id); fetchConvList(); } })
        .catch(() => {});
    }, 900);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, convLoaded, loading]);

  // Avatar playback — generate a talking-head video for an AI reply on demand.
  async function playAvatar(messageId: string) {
    setMessages((prev) => prev.map((m) =>
      m.id === messageId ? { ...m, avatar: { status: "loading" } } : m,
    ));
    const msg = messages.find((m) => m.id === messageId);
    const text = msg?.text?.trim();
    if (!text) {
      setMessages((prev) => prev.map((m) =>
        m.id === messageId ? { ...m, avatar: { status: "error", error: "No text to speak." } } : m,
      ));
      return;
    }
    try {
      const res = await fetch("/api/ai/coach-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text }),
      });
      const json = await res.json() as { videoUrl?: string; error?: string };
      if (!res.ok || !json.videoUrl) {
        throw new Error(json.error ?? "Couldn't render that reply.");
      }
      setMessages((prev) => prev.map((m) =>
        m.id === messageId ? { ...m, avatar: { status: "ready", videoUrl: json.videoUrl } } : m,
      ));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't render that reply.";
      setMessages((prev) => prev.map((m) =>
        m.id === messageId ? { ...m, avatar: { status: "error", error: message } } : m,
      ));
    }
  }

  function newConversation() {
    setConvId(null);
    setMessages([INITIAL_MESSAGE]);
    setHistoryOpen(false);
  }
  async function openConversation(id: string) {
    const t = await fetch(`/api/me/coach-conversations?id=${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    const tr = Array.isArray(t?.transcript) ? t.transcript : [];
    setConvId(id);
    setMessages([INITIAL_MESSAGE, ...tr.map((m: { role: string; text: string }, i: number) => ({ id: `h${i}`, role: m.role === "user" ? "user" as const : "ai" as const, text: m.text }))]);
    setHistoryOpen(false);
  }

  // ── Message helpers ─────────────────────────────────────────────────────────
  const removeTyping = (id: string) => setMessages((prev) => prev.filter((m) => m.id !== id));
  const pushAi       = (text: string) => setMessages((prev) => [...prev, { id: uid(), role: "ai", text }]);
  function pushActionCard(kind: ActionCard["kind"], summary: string, opts: { logId?: string; href?: string }) {
    const msgId = uid();
    const action: ActionCard = { kind, summary, href: opts.href };
    if (opts.logId) {
      const logId = opts.logId;
      action.undo = () => {
        undoCoachLog(user.id, logId);
        setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, action: { ...m.action!, undone: true } } : m));
      };
    }
    setMessages((prev) => [...prev, { id: msgId, role: "ai", text: "", action }]);
  }

  // ── Conversational coach call (streams paragraphs in) ─────────────────────────
  async function callCoach(text: string, typingId: string, recoveryContext?: string) {
    const history = buildHistory(messages);
    const res = await fetch("/api/ai/coach", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        message: text,
        history,
        context,
        intensity:           intensity ?? 3,
        allowStrongLanguage: !!strongLanguage,
        recoveryContext,
      }),
    });
    const data = await res.json() as { content?: string; error?: string };
    if (!res.ok || !data.content) throw new Error(data.error ?? "No response");

    const paragraphs = data.content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    removeTyping(typingId);
    paragraphs.forEach((t, i) => {
      setTimeout(() => {
        setMessages((prev) => [...prev, { id: uid(), role: "ai", text: t }]);
        if (i === paragraphs.length - 1) setLoading(false);
      }, i * 500);
    });
    // Live mode: speak the full reply, then resume listening.
    speakThenResume(data.content);
  }

  // ── Meal intent → parse → review-first modal ──────────────────────────────────
  async function handleMealIntent(transcript: string, typingId: string) {
    const hour = new Date().getHours();
    const tod  = hour < 5 ? "night (after midnight)" : hour < 11 ? "morning"
      : hour < 14 ? "midday / lunch time" : hour < 17 ? "afternoon"
      : hour < 21 ? "evening / dinner time" : "night";
    const res = await fetch("/api/ai/nutrition", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ mode: "parse", transcript, timeContext: `Current time: ${hour}:00 (${tod})` }),
    });
    if (!res.ok) throw new Error("Couldn't read that meal.");
    const parsed = await res.json() as NutritionParseResult;
    removeTyping(typingId);

    if (parsed.items.length === 0) {
      if (parsed.hydrationMl && parsed.hydrationMl > 0) {
        saveHydrationLog(user.id, { amountMl: parsed.hydrationMl, source: "voice" });
        pushActionCard("meal", `Water · ${parsed.hydrationMl} ml`, { href: "/nutrition" });
      } else {
        pushAi("Didn't catch any food in that — tell me what you ate and I'll log it.");
      }
      return;
    }
    setReviewMeals([{
      id:              `coach_${Date.now()}`,
      mealType:        (parsed.mealType === "unknown" ? "snack" : parsed.mealType) as MealType,
      source:          "voice",
      rawTranscript:   transcript,
      cleanTranscript: parsed.cleanTranscript,
      confidence:      parsed.confidence,
      hydrationMl:     parsed.hydrationMl ?? null,
      items:           parsed.items,
    }]);
    pushAi("Here's what I caught — check it and hit confirm.");
  }

  function handleMealReviewed(saved: { meal: LoggedMeal; hydrationMl: number | null }[]) {
    setReviewMeals([]);
    for (const { meal, hydrationMl } of saved) {
      if (hydrationMl && hydrationMl > 0) {
        saveHydrationLog(user.id, { amountMl: hydrationMl, source: "voice", linkedMealId: meal.id });
      }
    }
    if (saved.length > 0) {
      const m = saved[0].meal;
      const more = saved.length > 1 ? ` +${saved.length - 1} more` : "";
      pushActionCard("meal", `${m.cleanTranscript ?? "Meal"} · ${Math.round(m.totals.calories)} kcal${more}`, { href: "/nutrition" });
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────────
  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const clean = text.trim();

    const userMsg:   Message = { id: uid(), role: "user", text: clean };
    const typingId   = uid();
    const typingMsg: Message = { id: typingId, role: "ai", text: "", typing: true };

    setMessages((prev) => [...prev, userMsg, typingMsg]);
    setInput("");
    setLoading(true);
    setPromptsUsed(true);
    // Live mode: pause the mic while we think + speak so it doesn't hear itself.
    if (liveRef.current) conv.setPaused(true);

    try {
      // 1. Classify intent (fall back to chat if the router is unavailable)
      let route: CoachIntentOutput | null = null;
      try {
        const r = await fetch("/api/ai/coach-intent", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: clean, history: buildHistory(messages) }),
        });
        if (r.ok) route = await r.json() as CoachIntentOutput;
      } catch { /* fall through to chat */ }

      const intent = route?.intent ?? "chat";
      const act    = route && !route.needsClarification;

      // 2. Actionable intents
      if (act && intent === "log_meal" && route!.payload.mealTranscript) {
        await handleMealIntent(route!.payload.mealTranscript, typingId);
        setLoading(false);
        if (liveRef.current) conv.setPaused(false);
        return;
      }
      if (act && intent === "log_workout_complete") {
        const r = await logWorkoutComplete(user.id, route!.payload);
        removeTyping(typingId);
        pushActionCard("workout", r.summary, { logId: r.logId });
        setLoading(false);
        speakThenResume(r.summary);
        return;
      }
      if (act && intent === "log_reflection" && route!.payload.reflectionText) {
        const r = logReflection(user.id, route!.payload.reflectionText);
        removeTyping(typingId);
        pushActionCard("reflection", r.summary, { logId: r.logId });
        setLoading(false);
        speakThenResume(r.summary);
        return;
      }
      // Relay to the human coach — fire the notification, then let the AI reply
      // conversationally (no early return).
      if (act && intent === "message_coach" && route!.payload.coachMessage) {
        fetch("/api/me/coach-message", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: route!.payload.coachMessage }),
        }).catch(() => {});
      }

      // 3. Recovery → capture any numbers, then coach with the context
      if (intent === "recovery_check" && route) {
        const p = route.payload;
        if (p.sleepHours != null || p.soreness != null || p.energy != null) {
          saveReadiness(user.id, {
            sleepHours: p.sleepHours ?? undefined,
            soreness:   p.soreness ?? undefined,
            energy:     p.energy ?? undefined,
          });
        }
      }

      // 4. Ambiguous → ask, don't act — but ONLY for logging intents, where acting
      //    on the wrong thing is harmful. For chat / follow-ups, never short-circuit:
      //    the main coach has the full thread and answers with context (this is what
      //    was making it ask "what do you mean?" instead of using the conversation).
      const LOGGING_INTENTS = ["log_meal", "log_workout_complete", "log_reflection"];
      if (route?.needsClarification && route.clarifyingQuestion && LOGGING_INTENTS.includes(intent)) {
        removeTyping(typingId);
        pushAi(route.clarifyingQuestion);
        setLoading(false);
        speakThenResume(route.clarifyingQuestion);
        return;
      }

      // 5. Chat / recovery dialogue
      const recoveryContext = formatReadinessContext(getTodayReadiness(user.id));
      await callCoach(clean, typingId, recoveryContext);

    } catch (err) {
      const errText = err instanceof Error ? err.message : "Something went wrong.";
      removeTyping(typingId);
      pushAi(errText);
      setLoading(false);
      if (liveRef.current) conv.setPaused(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  const activeIntensity = intensity ?? 3;

  return (
    <div className="flex h-[calc(100dvh-56px-6rem)] min-h-0 flex-col overflow-hidden text-white md:h-[calc(100dvh-56px-1.5rem)]">

      {/* ── Conversation controls ───────────────────────────────────── */}
      {isRealUser && (
        <div className="flex items-center justify-between gap-2 border-b border-white/6 bg-[#0A0A0A] px-4 py-2 shrink-0 md:px-6">
          <button onClick={() => { fetchConvList(); setHistoryOpen(true); }} className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/85 transition-colors">
            <Clock className="w-3.5 h-3.5" strokeWidth={1.8} /> Past conversations{convList.length ? ` · ${convList.length}` : ""}
          </button>
          <button onClick={newConversation} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/60 hover:text-white/90 hover:border-white/20 transition-all">
            <Plus className="w-3.5 h-3.5" strokeWidth={2} /> New chat
          </button>
        </div>
      )}

      {/* ── History drawer ──────────────────────────────────────────── */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setHistoryOpen(false)} />
          <div className="relative ml-auto h-full w-full max-w-xs bg-[#0E0E0E] border-l border-white/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <p className="text-sm font-semibold text-white/85">Past conversations</p>
              <button onClick={() => setHistoryOpen(false)} className="text-white/40 hover:text-white/80"><X className="w-4 h-4" strokeWidth={2} /></button>
            </div>
            <button onClick={newConversation} className="mx-3 mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#B48B40] text-black py-2 text-xs font-semibold hover:bg-[#c99840] transition-all">
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> New conversation
            </button>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {convList.length === 0 ? (
                <p className="text-xs text-white/30 px-1 py-4 text-center">No past conversations yet.</p>
              ) : convList.map((c) => (
                <div key={c.id} className={cn("group flex items-center gap-2 rounded-xl border px-3 py-2.5", c.id === convId ? "border-[#B48B40]/30 bg-[#B48B40]/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/15")}>
                  <button onClick={() => openConversation(c.id)} className="flex items-start gap-2 min-w-0 flex-1 text-left">
                    <MessageSquare className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" strokeWidth={1.8} />
                    <span className="min-w-0">
                      <span className="block text-[13px] text-white/80 truncate">{c.preview}</span>
                      <span className="block text-[10px] text-white/30 mt-0.5">{new Date(c.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </span>
                  </button>
                  <button
                    onClick={() => { fetch(`/api/me/coach-conversations?id=${c.id}`, { method: "DELETE" }).catch(() => {}); setConvList((p) => p.filter((x) => x.id !== c.id)); if (c.id === convId) newConversation(); }}
                    className="text-white/20 hover:text-red-300/80 opacity-0 group-hover:opacity-100 transition-all shrink-0" aria-label="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Context bar ──────────────────────────────────────────────── */}
      <div className="border-b border-white/6 bg-[#0A0A0A] shrink-0">
        <button
          onClick={() => setContextOpen((v) => !v)}
          className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left md:px-6 md:py-3"
        >
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-[9px] uppercase tracking-[0.16em] text-white/25 md:text-[10px]">Goal</span>
              <span className="min-w-0 truncate text-xs font-medium text-[#B48B40]">{context.goal}</span>
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-2 sm:hidden">
              <span className="shrink-0 text-[9px] uppercase tracking-[0.16em] text-white/20">Phase</span>
              <span className="min-w-0 truncate text-[11px] font-medium text-white/50">{context.phase}</span>
            </div>
            <div className="mt-1 hidden min-w-0 items-center gap-3 sm:flex">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/25">Phase</span>
                <span className="min-w-0 truncate text-xs font-medium text-white/55">{context.phase}</span>
              </div>
              <span className="text-white/10">·</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/25">Week</span>
                <span className="text-xs font-medium text-white/55">{context.week}</span>
              </div>
              <span className="text-white/10">·</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/25">Status</span>
                <span className="text-xs font-medium text-emerald-400">{context.status}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-full border border-[#B48B40]/20 bg-[#B48B40]/8 px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-[#B48B40]/70">
              {INTENSITY_LABELS[activeIntensity]}
            </span>
            {strongLanguage && (
              <span className="hidden rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-white/35 min-[390px]:inline">
                Unfiltered
              </span>
            )}
            <ChevronDown
              className={cn("ml-0.5 h-3.5 w-3.5 text-white/20 transition-transform", contextOpen && "rotate-180")}
              strokeWidth={1.5}
            />
          </div>
        </button>

        {contextOpen && (
          <div className="grid grid-cols-2 gap-2 border-t border-white/5 px-4 pb-3 pt-3 sm:grid-cols-4 md:px-6">
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

            {/* Coaching voice controls */}
            <div className="col-span-2 sm:col-span-4 rounded-xl border border-white/6 bg-white/[0.02] px-3.5 py-3 mt-0.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.1em] text-white/22">Coaching voice</p>
                <span className="text-xs font-semibold text-[#B48B40]">{INTENSITY_LABELS[activeIntensity]}</span>
              </div>
              <input
                type="range" min={1} max={5} step={1}
                value={activeIntensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full accent-[#B48B40] cursor-pointer"
              />
              <div className="flex justify-between text-[9px] uppercase tracking-[0.1em] text-white/25 mt-1">
                <span>Gentle</span><span>Militant</span>
              </div>
              <button
                onClick={() => setStrongLanguage((v) => !v)}
                className="mt-3 flex items-center justify-between w-full text-left"
              >
                <span className="text-[11px] text-white/45">Allow strong language</span>
                <span className={cn(
                  "relative w-9 h-5 rounded-full transition-colors shrink-0",
                  strongLanguage ? "bg-[#B48B40]/80" : "bg-white/10",
                )}>
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                    strongLanguage ? "left-[1.125rem]" : "left-0.5",
                  )} />
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Messages ─────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 space-y-4 md:px-6 md:py-6">
        {messages.map((msg) => <MessageBubble key={msg.id} message={msg} onPlayAvatar={playAvatar} />)}
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
      <div className="px-4 pb-3 shrink-0 md:px-6 md:pb-5">
        <div className={cn(
          "flex items-end gap-3 rounded-2xl border bg-[#111111] px-4 py-3 transition-colors",
          conv.active ? "border-[#B48B40]/45" : input ? "border-[#B48B40]/30" : "border-white/8"
        )}>
          <textarea
            value={
              conv.active ? conv.interim
              : voice.status === "listening" ? (input + (voice.interim ? ` ${voice.interim}` : ""))
              : input
            }
            onChange={(e) => { setInput(e.target.value); if (voice.status !== "listening") voice.reset(); }}
            onKeyDown={handleKeyDown}
            placeholder={
              conv.active ? (loading ? "Coach is replying…" : "Listening — just talk…")
              : voice.status === "listening" ? "Listening…" : "Ask anything..."
            }
            rows={1}
            readOnly={conv.active}
            disabled={loading && !conv.active}
            className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/22 resize-none outline-none leading-relaxed max-h-32 disabled:opacity-50"
            style={{ scrollbarWidth: "none" }}
          />
          <div className="flex items-center gap-1.5 mb-0.5">
            {/* Live conversation toggle — hands-free back-and-forth */}
            {conv.isSupported && (
              <button
                onClick={() => (conv.active ? conv.stop() : (voice.reset(), setInput(""), conv.start()))}
                title={conv.active ? "End live voice" : "Start live voice conversation"}
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all relative",
                  conv.active
                    ? "bg-[#B48B40]/20 text-[#B48B40] border border-[#B48B40]/40"
                    : "bg-white/5 text-white/35 hover:text-white/70 hover:bg-white/8"
                )}
              >
                {conv.active && <span className="absolute inset-0 rounded-xl bg-[#B48B40]/15 animate-ping" />}
                <AudioLines className="w-4 h-4 relative" strokeWidth={2} />
              </button>
            )}
            {!conv.active && (
              <VoiceMic
                status={voice.status}
                isSupported={voice.isSupported}
                onStart={voice.start}
                onStop={() => { voice.stop(); }}
                size="sm"
              />
            )}
            <button
              onClick={() => { sendMessage(input); voice.reset(); }}
              disabled={!input.trim() || loading || conv.active}
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all",
                input.trim() && !loading && !conv.active
                  ? "bg-[#B48B40] text-black hover:bg-[#c99840]"
                  : "bg-white/5 text-white/20 cursor-not-allowed"
              )}
            >
              <Send className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-white/18 text-center mt-2">
          Talk to log a meal, finish a workout, or check in — {INTENSITY_LABELS[activeIntensity]} voice
        </p>
      </div>

      {/* ── Review-first meal logging (from chat) ─────────────────────── */}
      {reviewMeals.length > 0 && (
        <GroupedMealReviewModal
          meals={reviewMeals}
          userId={user.id}
          onSaved={handleMealReviewed}
          onCancel={() => { setReviewMeals([]); pushAi("No worries — nothing logged. What else?"); }}
        />
      )}
    </div>
  );
}
