"use client";

import { useState, useRef, useEffect } from "react";
import { Send, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/useLocalStorage";

// ─── Types ───────────────────────────────────────────────────────────────────

type Role     = "ai" | "user";
type Tone     = "direct" | "supportive" | "analytical";
type Profanity = "off" | "mild";
type Style     = "lite" | "pro";

type Message = {
  id: string;
  role: Role;
  text: string;
  typing?: boolean;
};

type Prompt = {
  id: string;
  label: string;
  message: string;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const CONTEXT = {
  goal:   "Hypertrophy",
  phase:  "Phase 1 — Foundation",
  week:   "Week 3 of 8",
  status: "On track",
};

// ─── Suggested prompts ────────────────────────────────────────────────────────

const PROMPTS: Prompt[] = [
  { id: "p1", label: "Why did my plan change?",   message: "Why did my plan change?"                            },
  { id: "p2", label: "Adjust for travel",          message: "I'm traveling this week. Can you adjust my plan?" },
  { id: "p3", label: "Explain my body status",     message: "Can you explain what my body status means right now?" },
  { id: "p4", label: "Simplify today",             message: "Simplify today's session for me."                 },
];

// ─── Response table ───────────────────────────────────────────────────────────
//
// Structure: question → tone → profanity → messages (pro/full length)
// "lite" is derived at call time by applyLite().
// For supportive + analytical tones, mild === off (profanity reads forced there).

const AI_RESPONSES: Record<string, Record<Tone, Record<Profanity, string[]>>> = {

  "Why did my plan change?": {
    direct: {
      off: [
        "Three things shifted overnight.",
        "Your sleep averaged 6.8h across the last three nights — not critical, but enough to affect your recovery window. Your calorie intake was also running about 180kcal ahead of the weekly target. And your session RPE on Wednesday logged at 8/10, which is slightly elevated for where you are in the phase.",
        "So I pulled calories down to 2,050, raised your step target slightly to keep energy expenditure on track, and kept your training load unchanged. Nothing dramatic — it's a small recalibration, not a reset.",
      ],
      mild: [
        "Three things shifted — here's what's actually going on.",
        "Sleep's been running short at 6.8h. Calories crept about 180kcal over target. And Wednesday hit harder than it should have — RPE 8/10 in Phase 1. None of it is catastrophic, but I'm not letting it slide.",
        "Pulled calories to 2,050, added steps, kept training exactly the same. It's a small correction. Don't make it a bigger deal than it is.",
      ],
    },
    supportive: {
      off: [
        "Good that you noticed — that means you're paying attention.",
        "A few things came together over the past few days. Your sleep has been running a little short (around 6.8h average), your calories were slightly above target, and Wednesday's session felt pretty hard based on your RPE. None of that is a problem on its own — it happens — but together it made sense to recalibrate.",
        "I kept your training exactly the same because you've been showing up consistently. I just nudged calories down a bit and added a few more steps to keep things balanced. You're still very much on track.",
      ],
      mild: [
        "Good that you noticed — that means you're paying attention.",
        "A few things came together over the past few days. Your sleep has been running a little short (around 6.8h average), your calories were slightly above target, and Wednesday's session felt pretty hard based on your RPE. None of that is a problem on its own — it happens — but together it made sense to recalibrate.",
        "I kept your training exactly the same because you've been showing up consistently. I just nudged calories down a bit and added a few more steps to keep things balanced. You're still very much on track.",
      ],
    },
    analytical: {
      off: [
        "Three data points triggered the adjustment.",
        "Sleep: 6.8h average over 3 nights (target: 7.5h). Deficit: ~2.1h total. Caloric surplus: ~180kcal above weekly target — extrapolates to ~1,260kcal over 7 days, enough to meaningfully affect composition trajectory. RPE: Wednesday logged 8/10 vs. expected 7/10 for Phase 1 loading.",
        "Adjustment vector: calories reduced to 2,050 (−180kcal), daily steps +800. Training volume held constant — recovery buffer is sufficient. Recalibration is minor and corrective, not indicative of plan failure.",
      ],
      mild: [
        "Three data points triggered the adjustment.",
        "Sleep: 6.8h average over 3 nights (target: 7.5h). Deficit: ~2.1h total. Caloric surplus: ~180kcal above weekly target — extrapolates to ~1,260kcal over 7 days, enough to meaningfully affect composition trajectory. RPE: Wednesday logged 8/10 vs. expected 7/10 for Phase 1 loading.",
        "Adjustment vector: calories reduced to 2,050 (−180kcal), daily steps +800. Training volume held constant — recovery buffer is sufficient. Recalibration is minor and corrective, not indicative of plan failure.",
      ],
    },
  },

  "I'm traveling this week. Can you adjust my plan?": {
    direct: {
      off: [
        "Done. Here's how I've restructured it.",
        "I've switched your sessions to full-body formats that work without a full gym setup. Three sessions across the week — bodyweight-focused with band work where it matters. Protein stays the priority; aim for 150g minimum even if calories drift a bit. Sleep and hydration matter more than usual when you're moving through time zones.",
        "Nutrition-wise, use the travel meal structure on your nutrition page. It's built for restaurants and hotel buffets. Stick to the framework and don't stress the precision.",
      ],
      mild: [
        "Done. Here's the real version.",
        "I've rebuilt your sessions around what you can actually do. Three full-body workouts, bodyweight and bands, 25–35 minutes each. Gets the job done wherever you are. Protein stays the priority — 150g minimum even if everything else slips a bit. Sleep and hydration matter more when you're crossing time zones.",
        "Nutrition: use the travel structure on your nutrition page. Don't try to be perfect — just work the framework and don't stress the details.",
      ],
    },
    supportive: {
      off: [
        "Absolutely — travel weeks are part of the plan, not a deviation from it.",
        "I've rebuilt this week's sessions to work with whatever space you have. Three full-body workouts, bodyweight and bands, 25–35 minutes each. Totally doable from a hotel room or gym. The key thing is just showing up — even a shortened session counts and keeps your momentum going.",
        "For food, don't stress perfection. Keep protein as your anchor (aim for 150g) and hydrate more than usual if you're crossing time zones. Check your nutrition page — I've got a travel structure there that makes restaurant eating way less stressful.",
      ],
      mild: [
        "Absolutely — travel weeks are part of the plan, not a deviation from it.",
        "I've rebuilt this week's sessions to work with whatever space you have. Three full-body workouts, bodyweight and bands, 25–35 minutes each. Totally doable from a hotel room or gym. The key thing is just showing up — even a shortened session counts and keeps your momentum going.",
        "For food, don't stress perfection. Keep protein as your anchor (aim for 150g) and hydrate more than usual if you're crossing time zones. Check your nutrition page — I've got a travel structure there that makes restaurant eating way less stressful.",
      ],
    },
    analytical: {
      off: [
        "Travel adjustment applied. Reconfigured on three axes: volume, logistics, nutrition.",
        "Training: switched to full-body stimulus protocol (3 sessions). Rationale — equipment uncertainty is the primary constraint; full-body format preserves stimulus with zero equipment dependency. Volume reduction: ~15% from baseline. Acceptable given single-week duration — detraining threshold is ~2 weeks.",
        "Nutrition: protein floor set at 150g (vs. normal 172g target). Rationale — travel environments make precision tracking unreliable; floor-based targeting reduces cognitive load while preserving muscle retention signal. Hydration: flag elevated given likely time zone shift.",
      ],
      mild: [
        "Travel adjustment applied. Reconfigured on three axes: volume, logistics, nutrition.",
        "Training: switched to full-body stimulus protocol (3 sessions). Rationale — equipment uncertainty is the primary constraint; full-body format preserves stimulus with zero equipment dependency. Volume reduction: ~15% from baseline. Acceptable given single-week duration — detraining threshold is ~2 weeks.",
        "Nutrition: protein floor set at 150g (vs. normal 172g target). Rationale — travel environments make precision tracking unreliable; floor-based targeting reduces cognitive load while preserving muscle retention signal. Hydration: flag elevated given likely time zone shift.",
      ],
    },
  },

  "Can you explain what my body status means right now?": {
    direct: {
      off: [
        "Here's the direct read.",
        "Fat loss is tracking at about 0.4kg down this week — that's the right rate. Fast enough to make progress, slow enough to hold muscle. Muscle retention signal is strong: your protein has averaged 172g/day and your lifts are still moving, which tells me you're not in a catabolic state.",
        "Recovery is the one caution flag. Sleep has been slightly below target, which is compressing your recovery window. It's not derailing anything right now, but if it continues for another 3–4 days, I'll need to reduce next week's volume. Your confidence score is sitting at 74. Fix sleep and it goes above 80.",
      ],
      mild: [
        "Here's the straight read.",
        "Fat loss is tracking at 0.4kg down this week — that's exactly where it should be. Fast enough to matter, slow enough to hold muscle. Protein's averaged 172g/day and your lifts are still moving, which means you're not burning through muscle.",
        "The one flag is sleep. It's been short and that's compressing recovery. It's not wrecking anything right now, but another 3–4 days of this and I'll have to pull volume. Confidence score at 74 — fix sleep and it crosses 80. It's that direct a line.",
      ],
    },
    supportive: {
      off: [
        "You're actually in a good spot — here's what it means.",
        "Your fat loss is right where we want it: about 0.4kg this week, which is a healthy pace. You're losing fat without burning through muscle, which is the hardest balance to get right. Your protein has been consistent and your lifts are still progressing — both really positive signs.",
        "The one thing worth paying attention to is sleep. It's been slightly short, and that's what's holding your confidence score at 74 instead of above 80. Sleep is the one lever that improves almost everything else. You're doing well — this is fine-tuning, not damage control.",
      ],
      mild: [
        "You're actually in a good spot — here's what it means.",
        "Your fat loss is right where we want it: about 0.4kg this week, which is a healthy pace. You're losing fat without burning through muscle, which is the hardest balance to get right. Your protein has been consistent and your lifts are still progressing — both really positive signs.",
        "The one thing worth paying attention to is sleep. It's been slightly short, and that's what's holding your confidence score at 74 instead of above 80. Sleep is the one lever that improves almost everything else. You're doing well — this is fine-tuning, not damage control.",
      ],
    },
    analytical: {
      off: [
        "Body status breakdown across four signal categories.",
        "Composition: fat loss velocity = 0.4kg/week (optimal range: 0.3–0.6kg/week). Lean mass retention indicators: positive — protein avg 172g/day (2.1g/kg BW), progressive overload maintained across 3 of 4 primary lifts. Catabolic risk: low.",
        "Recovery: sleep avg 6.8h vs. 7.5h target. Recovery window compression estimated at ~12%. Threshold for volume reduction: 4 consecutive days below 6.5h. Confidence score: 74/100. Primary constraint: sleep deficit (−0.7h/night). Corrective projection: +6–8 points per 3 nights of target sleep achieved.",
      ],
      mild: [
        "Body status breakdown across four signal categories.",
        "Composition: fat loss velocity = 0.4kg/week (optimal range: 0.3–0.6kg/week). Lean mass retention indicators: positive — protein avg 172g/day (2.1g/kg BW), progressive overload maintained across 3 of 4 primary lifts. Catabolic risk: low.",
        "Recovery: sleep avg 6.8h vs. 7.5h target. Recovery window compression estimated at ~12%. Threshold for volume reduction: 4 consecutive days below 6.5h. Confidence score: 74/100. Primary constraint: sleep deficit (−0.7h/night). Corrective projection: +6–8 points per 3 nights of target sleep achieved.",
      ],
    },
  },

  "Simplify today's session for me.": {
    direct: {
      off: [
        "Here's today stripped down.",
        "Keep the two main lifts — Lat Pulldown and Seated Row. Those are your highest-value movements for today's stimulus. Drop Face Pull and Bicep Curl entirely. Add one set to each main lift if energy is there. Total time: 25–30 minutes.",
        "You're not losing anything meaningful. The volume you're removing is accessory work. The base stimulus stays intact. Do those two lifts well and call it done.",
      ],
      mild: [
        "Here's what actually matters today.",
        "Two lifts — Lat Pulldown and Seated Row. That's the real work. Drop the Face Pull and Bicep Curl. They're accessories and you don't need them today. Add a set to each main if you've got energy left. 25–30 minutes and you're out.",
        "You're not losing a damn thing by cutting the accessories. The core stimulus stays intact. Do the two lifts right and get out.",
      ],
    },
    supportive: {
      off: [
        "Of course — sometimes simpler is exactly right.",
        "Focus on just the two main lifts: Lat Pulldown and Seated Row. These are doing the real work in today's session anyway. You can skip the Face Pull and Bicep Curl completely — they're accessories and you won't lose anything by dropping them today.",
        "If you have energy, add an extra set to one of the main lifts. If not, don't. Either way, you're doing the session, and that's what matters. 25–30 minutes and you're done.",
      ],
      mild: [
        "Of course — sometimes simpler is exactly right.",
        "Focus on just the two main lifts: Lat Pulldown and Seated Row. These are doing the real work in today's session anyway. You can skip the Face Pull and Bicep Curl completely — they're accessories and you won't lose anything by dropping them today.",
        "If you have energy, add an extra set to one of the main lifts. If not, don't. Either way, you're doing the session, and that's what matters. 25–30 minutes and you're done.",
      ],
    },
    analytical: {
      off: [
        "Minimum effective dose protocol applied.",
        "Retained: Lat Pulldown (primary stimulus — lat vertical pull), Seated Row (primary stimulus — lat horizontal pull). Combined, these two movements account for approximately 78% of today's training stimulus by volume × load. Removed: Face Pull (posterior shoulder accessory), Bicep Curl (arm isolation — negligible impact on primary adaptation target).",
        "Optional: +1 set on each retained movement to compensate for volume reduction (adds ~7 min). Net stimulus retention: ~85% of full session with 35–40% time reduction. Recommended when recovery is compromised or time-constrained.",
      ],
      mild: [
        "Minimum effective dose protocol applied.",
        "Retained: Lat Pulldown (primary stimulus — lat vertical pull), Seated Row (primary stimulus — lat horizontal pull). Combined, these two movements account for approximately 78% of today's training stimulus by volume × load. Removed: Face Pull (posterior shoulder accessory), Bicep Curl (arm isolation — negligible impact on primary adaptation target).",
        "Optional: +1 set on each retained movement to compensate for volume reduction (adds ~7 min). Net stimulus retention: ~85% of full session with 35–40% time reduction. Recommended when recovery is compromised or time-constrained.",
      ],
    },
  },
};

const FALLBACK_RESPONSES: Record<Tone, Record<Profanity, string[]>> = {
  direct: {
    off: [
      "Got it.",
      "I don't have a specific data point on that right now, but here's how I'd think about it based on where you are in your plan.",
      "You're in Week 3 of Phase 1 — this is a foundation block. The priority right now is consistency, not optimization. If something feels off, the first variable to check is always sleep and nutrition before you adjust the training. What specifically are you trying to figure out?",
    ],
    mild: [
      "Got it.",
      "I don't have a specific number on that right now, but here's the honest framing based on where you are.",
      "Week 3, Phase 1 — foundation block. The work right now is about consistency, not optimization. If something feels off, check sleep and nutrition first before you start adjusting training. What's the actual issue?",
    ],
  },
  supportive: {
    off: [
      "Good question — let me think through that with you.",
      "I don't have a specific read on that exact thing right now, but I can work with you on it. You're in a foundation phase, which means the fundamentals — sleep, nutrition, showing up — are doing most of the heavy lifting.",
      "If something feels off, that's worth exploring. The most common culprits are sleep and calorie balance before anything else. What's prompting the question?",
    ],
    mild: [
      "Good question — let me think through that with you.",
      "I don't have a specific read on that exact thing right now, but I can work with you on it. You're in a foundation phase, which means the fundamentals — sleep, nutrition, showing up — are doing most of the heavy lifting.",
      "If something feels off, that's worth exploring. The most common culprits are sleep and calorie balance before anything else. What's prompting the question?",
    ],
  },
  analytical: {
    off: [
      "Noted. Insufficient context for a specific response — here's the relevant framing.",
      "Current phase context: Phase 1, Week 3 of 8 (Foundation block). Adaptation targets: base strength, motor pattern establishment, habit formation. Primary optimization levers in rank order: sleep duration/quality, caloric target adherence, training consistency, training quality.",
      "Without a specific data point to reference, the decision tree defaults to: (1) Is sleep on target? (2) Is nutrition within ±10% of targets? (3) Is training being completed as scheduled? Provide more specifics for a targeted response.",
    ],
    mild: [
      "Noted. Insufficient context for a specific response — here's the relevant framing.",
      "Current phase context: Phase 1, Week 3 of 8 (Foundation block). Adaptation targets: base strength, motor pattern establishment, habit formation. Primary optimization levers in rank order: sleep duration/quality, caloric target adherence, training consistency, training quality.",
      "Without a specific data point to reference, the decision tree defaults to: (1) Is sleep on target? (2) Is nutrition within ±10% of targets? (3) Is training being completed as scheduled? Provide more specifics for a targeted response.",
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// Lite: first message + first sentence of second message only
function applyLite(messages: string[]): string[] {
  if (messages.length <= 1) return messages;
  const second = messages[1];
  const sentenceEnd = second.search(/[.!?]\s/);
  const shortened   = sentenceEnd > 0
    ? second.slice(0, sentenceEnd + 1)
    : second.length > 110 ? second.slice(0, 110).trimEnd() + "…" : second;
  return [messages[0], shortened];
}

// Context classification — determines if mild profanity is appropriate.
// Profanity fits: motivational pushes, accountability callouts, natural conversation.
// Does NOT fit: analytics summaries, system explanations, formal definitions.
type MessageContext = "motivational" | "accountability" | "conversational" | "analytical" | "system";

function classifyMessageContext(message: string): MessageContext {
  const m = message.toLowerCase();
  if (/miss|skip|slack|didn'?t|haven'?t|fell off|cheat|excuse|failing|behind|not done|blew/i.test(m))
    return "accountability";
  if (/can'?t|give up|tired|hard|push|motivat|harder|quit|done with|struggling|overwhelm/i.test(m))
    return "motivational";
  if (/data|stat|metric|analytic|trend|number|breakdown|score|rate|percentage|report|chart|graph/i.test(m))
    return "analytical";
  if (/explain|what is|how does|why does|what'?s|calculate|system|mean|work|define|tell me about/i.test(m))
    return "system";
  return "conversational";
}

function getAIResponse(
  message:   string,
  tone:      Tone,
  profanity: Profanity,
  style:     Style,
): string[] {
  // Profanity rules:
  // 1. Supportive/analytical tones never use mild (it reads forced in those registers)
  // 2. Direct tone respects the setting, but only in conversational contexts:
  //    motivation, accountability, and general conversation.
  //    Analytical summaries, system explanations, and formal content always stay clean.
  const ctx = classifyMessageContext(message);
  const contextAllowsMild = ctx === "motivational" || ctx === "accountability" || ctx === "conversational";
  const effectiveProfanity: Profanity =
    tone === "direct" && contextAllowsMild ? profanity : "off";

  let lines: string[] = FALLBACK_RESPONSES[tone][effectiveProfanity];
  for (const key of Object.keys(AI_RESPONSES)) {
    if (message.toLowerCase().includes(key.toLowerCase().slice(0, 20))) {
      lines = AI_RESPONSES[key][tone][effectiveProfanity];
      break;
    }
  }

  return style === "lite" ? applyLite(lines) : lines;
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
  const [messages,     setMessages    ] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input,        setInput       ] = useState("");
  const [loading,      setLoading     ] = useState(false);
  const [contextOpen,  setContextOpen ] = useState(false);
  const [promptsUsed,  setPromptsUsed ] = useState(false);

  const [tone     ] = useLocalStorage<Tone     >("coach-tone",      "direct");
  const [profanity] = useLocalStorage<Profanity>("coach-profanity", "off");
  const [style    ] = useLocalStorage<Style    >("coach-style",     "pro");

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg:   Message = { id: uid(), role: "user", text: text.trim() };
    const typingMsg: Message = { id: uid(), role: "ai",   text: "", typing: true };

    setMessages((prev) => [...prev, userMsg, typingMsg]);
    setInput("");
    setLoading(true);
    setPromptsUsed(true);

    const lines = getAIResponse(
      text,
      tone      ?? "direct",
      profanity ?? "off",
      style     ?? "pro",
    );

    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => !m.typing));
      lines.forEach((line, i) => {
        setTimeout(() => {
          setMessages((prev) => [...prev, { id: uid(), role: "ai", text: line }]);
          if (i === lines.length - 1) setLoading(false);
        }, i * 600);
      });
    }, 900);
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
              <span className="text-xs font-medium text-[#B48B40]">{CONTEXT.goal}</span>
            </div>
            <span className="text-white/10">·</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/25">Phase</span>
              <span className="text-xs font-medium text-white/55">{CONTEXT.week}</span>
            </div>
            <span className="hidden sm:block text-white/10">·</span>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/25">Status</span>
              <span className="text-xs font-medium text-emerald-400">{CONTEXT.status}</span>
            </div>
          </div>

          {/* Active settings pills */}
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
                <span className="text-[10px] uppercase tracking-[0.13em] text-[#B48B40]/40">
                  Mild
                </span>
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
              { label: "Goal",   value: CONTEXT.goal,           color: "text-[#B48B40]"    },
              { label: "Phase",  value: CONTEXT.phase,          color: "text-white/65"      },
              { label: "Week",   value: CONTEXT.week,           color: "text-white/65"      },
              { label: "Status", value: CONTEXT.status,         color: "text-emerald-400"   },
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

      {/* ── Input bar ────────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 pb-4 md:pb-6 shrink-0">
        <div className={cn(
          "flex items-end gap-3 rounded-2xl border bg-[#111111] px-4 py-3 transition-colors",
          input ? "border-[#B48B40]/30" : "border-white/8"
        )}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/22 resize-none outline-none leading-relaxed max-h-32 disabled:opacity-50"
            style={{ scrollbarWidth: "none" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all mb-0.5",
              input.trim() && !loading
                ? "bg-[#B48B40] text-black hover:bg-[#c99840]"
                : "bg-white/5 text-white/20 cursor-not-allowed"
            )}
          >
            <Send className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
        <p className="text-[10px] text-white/18 text-center mt-2">
          Shift + Enter for new line · {TONE_LABELS[activeTone]} · {STYLE_LABELS[activeStyle]}
          {activeProfanity === "mild" ? " · Mild" : ""} · Change in Profile
        </p>
      </div>
    </div>
  );
}
