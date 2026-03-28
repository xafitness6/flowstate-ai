"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Scale,
  Bot,
  Utensils,
  CheckCircle2,
  Circle,
  Lock,
  LockOpen,
  GripHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { AccountabilityTracker } from "@/components/dashboard/AccountabilityTracker";

// ─── Data ─────────────────────────────────────────────────────────────────────

const ADJUSTMENTS = [
  { label: "Calories",     before: "2,200 kcal", after: "2,050 kcal", direction: "down"    as const, reason: "Lighter intake on a rest-adjacent day." },
  { label: "Steps",        before: "8,000",       after: "9,500",       direction: "up"      as const, reason: "+1,500 steps · ~15 min walking" },
  { label: "Training load",before: "Unchanged",   after: "Unchanged",   direction: "neutral" as const, reason: "Recovery is holding. No change needed." },
];

const WHY_ITEMS = [
  "Sleep averaged 7.1h across the last 3 nights — within range but not peak.",
  "Yesterday's session RPE was logged at 8/10. Slightly elevated.",
  "Calorie surplus is ahead of schedule for the week. Trimming today maintains the average.",
  "Steps target raised to keep overall energy expenditure on track.",
];

const EXERCISES = [
  { name: "Lat Pulldown", meta: "4×10 @ 60kg" },
  { name: "Seated Row",   meta: "3×12 @ 50kg" },
  { name: "Face Pull",    meta: "3×15" },
  { name: "Bicep Curl",   meta: "3×12 @ 20kg" },
];

const QUICK_ACTIONS = [
  { label: "Log workout",      icon: Dumbbell, href: "/program"   },
  { label: "Update weight",    icon: Scale,    href: "/profile"   },
  { label: "Ask AI coach",     icon: Bot,      href: "/coach"     },
  { label: "Update nutrition", icon: Utensils, href: "/nutrition" },
];

type SignalLevel = "good" | "caution" | "low";
type BodySignal  = { id: string; label: string; value: string; level: SignalLevel; summary: string; detail: string; };

const BODY_SIGNALS: BodySignal[] = [
  { id: "fat_loss",   label: "Fat loss trend",    value: "On track",      level: "good",    summary: "Down 0.4 kg this week.",                  detail: "Your 7-day average weight is trending down at a rate consistent with ~0.5kg/week loss. Deficit is holding. No adjustment needed — keep nutrition consistent through the weekend." },
  { id: "muscle",     label: "Muscle retention",  value: "Signal strong", level: "good",    summary: "Protein and training load are aligned.",   detail: "Protein intake has averaged 172g/day over the last 5 days, and your session output is holding. No signs of muscle loss signal. Progressive overload is still occurring on your main lifts." },
  { id: "recovery",   label: "Recovery status",   value: "Moderate",      level: "caution", summary: "Sleep slightly below target.",             detail: "You've averaged 6.8h over the last 3 nights. Not critical, but it's affecting your recovery window. Today's session volume has been dialed back slightly. Prioritize 7.5h+ tonight before tomorrow's heavy lower session." },
  { id: "confidence", label: "Confidence score",  value: "74 / 100",      level: "good",    summary: "Solid execution this week.",              detail: "Score is based on adherence (82%), sleep consistency (65%), nutrition accuracy (88%), and training output relative to targets. The main drag is sleep. Fix that and you're above 85." },
];

const SIGNAL_STYLE: Record<SignalLevel, { dot: string; value: string; bar: string }> = {
  good:    { dot: "bg-emerald-400", value: "text-emerald-400", bar: "bg-emerald-400/70" },
  caution: { dot: "bg-[#FBBF24]",  value: "text-[#FBBF24]",  bar: "bg-[#FBBF24]/60"  },
  low:     { dot: "bg-[#F87171]",  value: "text-[#F87171]",  bar: "bg-[#F87171]/60"  },
};

const SIGNAL_BAR_WIDTH: Record<string, string> = {
  fat_loss: "w-[78%]", muscle: "w-[85%]", recovery: "w-[55%]", confidence: "w-[74%]",
};

const DEFAULT_CARD_ORDER = ["ai-insight", "todays-plan", "body-status", "accountability"];

// ─── BodySignalRow ────────────────────────────────────────────────────────────

function BodySignalRow({ signal }: { signal: BodySignal }) {
  const [open, setOpen] = useState(false);
  const style = SIGNAL_STYLE[signal.level];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
          <span className="text-xs text-white/45">{signal.label}</span>
        </div>
        <span className={cn("text-xs font-medium tabular-nums", style.value)}>{signal.value}</span>
      </div>
      <div className="h-1 rounded-full bg-white/6 overflow-hidden">
        <div className={cn("h-full rounded-full", style.bar, SIGNAL_BAR_WIDTH[signal.id])} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-white/30 leading-snug">{signal.summary}</p>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-white/20 hover:text-white/50 transition-colors shrink-0"
        >
          {open ? <ChevronUp className="w-3 h-3" strokeWidth={2} /> : <ChevronDown className="w-3 h-3" strokeWidth={2} />}
        </button>
      </div>
      {open && (
        <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3.5 py-3">
          <p className="text-xs text-white/50 leading-relaxed">{signal.detail}</p>
        </div>
      )}
    </div>
  );
}

function DirectionIcon({ dir }: { dir: "up" | "down" | "neutral" }) {
  if (dir === "up")   return <ArrowUp   className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />;
  if (dir === "down") return <ArrowDown className="w-3.5 h-3.5 text-[#F87171]"  strokeWidth={2} />;
  return <Minus className="w-3.5 h-3.5 text-white/25" strokeWidth={2} />;
}

// ─── Sortable card wrapper ────────────────────────────────────────────────────

function SortableCard({
  id,
  locked,
  children,
}: {
  id: string;
  locked: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: locked });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative group/card", isDragging && "z-50 opacity-80 shadow-2xl shadow-black/50")}
    >
      {/* Drag handle — visible only when unlocked, centered above card */}
      {!locked && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-10 h-4 rounded-md bg-white/[0.05] border border-white/8 cursor-grab active:cursor-grabbing hover:bg-white/[0.10] hover:border-white/15 transition-all opacity-0 group-hover/card:opacity-100"
        >
          <GripHorizontal className="w-3 h-3 text-white/30" strokeWidth={1.5} />
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Card content components ──────────────────────────────────────────────────

function AIInsightCard() {
  const [whyOpen, setWhyOpen]     = useState(false);
  const [committed, setCommitted] = useState(false);

  return (
    <section>
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/30 mb-3 px-1">AI Adjustment</p>
      <div className="rounded-2xl border border-[#6f4a17]/60 bg-[#0e0d0b] overflow-hidden">
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-white/90">3 changes to your plan today.</p>
            <p className="text-sm text-white/40 mt-0.5">Based on recovery, load, and weekly targets.</p>
          </div>
          <span className="text-[#B48B40] text-base shrink-0 mt-0.5">◈</span>
        </div>
        <div className="h-px bg-white/6 mx-6" />
        <div className="px-6 py-1 divide-y divide-white/[0.05]">
          {ADJUSTMENTS.map((adj) => (
            <div key={adj.label} className="flex items-center gap-4 py-3.5">
              <div className="w-5 flex justify-center shrink-0"><DirectionIcon dir={adj.direction} /></div>
              <span className="text-sm text-white/50 w-28 shrink-0">{adj.label}</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={cn("text-sm tabular-nums", adj.direction === "neutral" ? "text-white/25" : "text-white/35 line-through decoration-white/15")}>
                  {adj.before}
                </span>
                {adj.direction !== "neutral" && (
                  <>
                    <span className="text-white/15 text-xs">→</span>
                    <span className={cn("text-sm font-medium tabular-nums", adj.direction === "up" ? "text-emerald-400" : "text-[#F87171]")}>
                      {adj.after}
                    </span>
                  </>
                )}
                {adj.direction === "neutral" && <span className="text-sm text-white/25">{adj.after}</span>}
              </div>
              <p className="text-xs text-white/30 hidden sm:block text-right max-w-[180px] leading-relaxed">{adj.reason}</p>
            </div>
          ))}
        </div>
        <div className="h-px bg-white/6 mx-6" />
        <div className="px-6 py-4">
          <p className="text-xs uppercase tracking-[0.15em] text-white/20 mb-1.5">Expected outcome</p>
          <p className="text-sm text-white/55 leading-relaxed">
            Maintains your weekly caloric average, keeps output high, and reduces accumulated fatigue going into your next heavy session.
          </p>
        </div>
        <div className="border-t border-white/6">
          <button
            onClick={() => setWhyOpen((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-3.5 text-sm text-white/35 hover:text-white/60 transition-colors"
          >
            <span>Why this changed</span>
            {whyOpen ? <ChevronUp className="w-4 h-4" strokeWidth={1.5} /> : <ChevronDown className="w-4 h-4" strokeWidth={1.5} />}
          </button>
          {whyOpen && (
            <div className="px-6 pb-4 space-y-2.5">
              {WHY_ITEMS.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-[#B48B40]/50 text-xs mt-0.5 shrink-0">◈</span>
                  <p className="text-sm text-white/40 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 pb-5 pt-1">
          <div className="flex items-center gap-3">
            <button className={cn("text-sm transition-colors", committed ? "text-white/12 pointer-events-none" : "text-white/28 hover:text-white/55")}>
              Revert
            </button>
            <button
              onClick={() => !committed && setCommitted(true)}
              className={cn("ml-auto rounded-xl px-5 py-2 text-sm font-medium transition-all", committed ? "bg-white/5 text-white/35 cursor-default" : "bg-[#B48B40] text-black hover:bg-[#c99840]")}
            >
              {committed ? "Committed" : "COMMIT"}
            </button>
          </div>
          {committed && <p className="text-xs text-emerald-400/65 text-right mt-2">Plan updated.</p>}
        </div>
      </div>
    </section>
  );
}

function TodaysPlanCard() {
  const router = useRouter();
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const completedCount = Object.values(completed).filter(Boolean).length;

  function toggleExercise(name: string) {
    setCompleted((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  return (
    <section>
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/30 mb-3 px-1">Today&apos;s Plan</p>
      <div className="rounded-2xl border border-white/8 bg-[#111111] overflow-hidden">
        <div className="px-6 pt-5 pb-4 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Upper Body · Pull</h2>
            <p className="text-white/38 mt-1 text-sm">
              4 exercises · ~45 min
              {completedCount > 0 && <span className="ml-2 text-[#B48B40]">· {completedCount}/{EXERCISES.length} done</span>}
            </p>
          </div>
          <button onClick={() => router.push("/program")} className="text-[#B48B40] text-sm hover:text-[#d4a95a] transition mt-1">
            Start →
          </button>
        </div>
        {completedCount > 0 && (
          <div className="h-0.5 bg-white/6 mx-6 mb-1 rounded-full overflow-hidden">
            <div className="h-full bg-[#B48B40] transition-all duration-500" style={{ width: `${(completedCount / EXERCISES.length) * 100}%` }} />
          </div>
        )}
        <div className="divide-y divide-white/[0.06] px-6">
          {EXERCISES.map(({ name, meta }) => {
            const done = !!completed[name];
            return (
              <div key={name} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleExercise(name)} className="text-white/20 hover:text-[#B48B40]/70 transition-colors shrink-0">
                    {done ? <CheckCircle2 className="w-4 h-4 text-[#B48B40]" strokeWidth={1.5} /> : <Circle className="w-4 h-4" strokeWidth={1.5} />}
                  </button>
                  <span className={cn("text-base transition-colors", done ? "text-white/30 line-through decoration-white/15" : "text-white/88")}>
                    {name}
                  </span>
                </div>
                <span className="text-sm text-white/32 tabular-nums">{meta}</span>
              </div>
            );
          })}
        </div>
        <div className="mx-6 mt-2 mb-5 rounded-xl border border-white/6 bg-black/20 px-4 py-3.5">
          <p className="text-xs text-white/28 mb-1.5 uppercase tracking-[0.12em]">Coach note</p>
          <p className="text-sm text-white/60 leading-relaxed">
            Push load slightly today if your first two working sets feel clean. Prioritize full control on rows.
          </p>
        </div>
      </div>
    </section>
  );
}

function BodyStatusCard() {
  return (
    <section>
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/30 mb-3 px-1">Body Status</p>
      <div className="rounded-2xl border border-white/6 bg-[#0f0f0f] px-5 py-4">
        <div className="space-y-5 divide-y divide-white/[0.05]">
          {BODY_SIGNALS.map((signal, i) => (
            <div key={signal.id} className={cn(i > 0 && "pt-5")}>
              <BodySignalRow signal={signal} />
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4 border-t border-white/5 grid grid-cols-3 gap-2">
          {[{ label: "Weight", value: "84 kg" }, { label: "Sleep", value: "6.8 h" }, { label: "Streak", value: "6 days" }].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-sm font-semibold text-white/65 tabular-nums">{value}</p>
              <p className="text-[10px] text-white/22 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Card registry ────────────────────────────────────────────────────────────

const CARD_COMPONENTS: Record<string, React.ComponentType> = {
  "ai-insight":     AIInsightCard,
  "todays-plan":    TodaysPlanCard,
  "body-status":    BodyStatusCard,
  "accountability": AccountabilityTracker,
};

const CARD_LABELS: Record<string, string> = {
  "ai-insight":     "AI Insight",
  "todays-plan":    "Today's Plan",
  "body-status":    "Body Status",
  "accountability": "Accountability",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [cardOrder, setCardOrder] = useLocalStorage<string[]>("dashboard-card-order", DEFAULT_CARD_ORDER);
  const [locked,    setLocked]    = useLocalStorage<boolean>("dashboard-locked", true);

  // First-run detection: redirect to onboarding if not yet completed
  useEffect(() => {
    try {
      const onboarded = localStorage.getItem("flowstate-onboarded");
      if (!onboarded) {
        router.replace("/onboarding");
        return;
      }
      // Redirect to user's preferred starting screen
      const pref = JSON.parse(localStorage.getItem("dashboard-default") ?? '"overview"');
      if (pref === "program")             router.replace("/program");
      else if (pref === "nutrition")      router.replace("/nutrition");
      else if (pref === "accountability") router.replace("/accountability");
    } catch { /* ignore */ }
  }, [router]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCardOrder((prev) => {
        const oldIdx = prev.indexOf(active.id as string);
        const newIdx = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }

  return (
    <div className="px-5 md:px-8 py-6 max-w-3xl mx-auto text-white">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight mb-1.5">Good morning.</h1>
            <div className="flex items-center gap-3">
              <p className="text-white/40">Here&apos;s your day.</p>
              <span className="text-[10px] font-medium tracking-[0.12em] uppercase px-2 py-1 rounded-lg border border-emerald-400/20 bg-emerald-400/8 text-emerald-400">
                On track
              </span>
            </div>
          </div>

          {/* Lock layout toggle */}
          <div className="flex items-center gap-1.5 shrink-0 mt-1">
            {!locked && (
              <span className="text-[10px] text-white/22 hidden sm:block">Editing layout</span>
            )}
            <button
              onClick={() => setLocked((v) => !v)}
              title={locked ? "Unlock layout" : "Lock layout"}
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                locked
                  ? "text-white/18 hover:text-white/40 bg-transparent"
                  : "text-[#B48B40] bg-[#B48B40]/10 border border-[#B48B40]/20 hover:bg-[#B48B40]/15"
              )}
            >
              {locked
                ? <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
                : <LockOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
              }
            </button>
          </div>
        </div>

        {/* ── Unlock hint ─────────────────────────────────────────────── */}
        {!locked && (
          <div className="mb-5 rounded-xl border border-[#B48B40]/15 bg-[#B48B40]/5 px-4 py-2.5 flex items-center gap-2.5">
            <GripHorizontal className="w-3.5 h-3.5 text-[#B48B40]/60 shrink-0" strokeWidth={1.5} />
            <p className="text-xs text-white/40">Drag cards to reorder. Hover a card to see the handle.</p>
          </div>
        )}

        {/* ── Draggable cards ─────────────────────────────────────────── */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={cardOrder} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {cardOrder.map((id) => {
                const CardComponent = CARD_COMPONENTS[id];
                if (!CardComponent) return null;
                return (
                  <SortableCard key={id} id={id} locked={locked}>
                    <CardComponent />
                  </SortableCard>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* ── Quick Actions (static, not draggable) ───────────────────── */}
        <div className="mt-6 space-y-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/22 px-1">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map(({ label, icon: Icon, href }) => (
              <a
                key={label}
                href={href}
                className="flex items-center gap-3 rounded-xl border border-white/6 bg-[#0f0f0f] px-4 py-3 text-sm text-white/50 hover:text-white/80 hover:border-white/12 hover:bg-white/[0.03] transition-all group"
              >
                <Icon className="w-4 h-4 text-white/22 group-hover:text-[#B48B40]/70 transition-colors shrink-0" strokeWidth={1.5} />
                {label}
              </a>
            ))}
          </div>
        </div>

    </div>
  );
}
