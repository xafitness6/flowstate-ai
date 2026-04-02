"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactDOM from "react-dom";
import { Flame, ExternalLink, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  USER_SNAPSHOTS,
  adherenceColor,
  canViewSnapshot,
  canViewProfile,
  type SnapshotUser,
} from "@/lib/userProfiles";
import { useUser } from "@/context/UserContext";

// ─── Hover card content ───────────────────────────────────────────────────────

function HoverCardContent({
  user,
  style,
  onMouseEnter,
  onMouseLeave,
}: {
  user: SnapshotUser;
  style: React.CSSProperties;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const router = useRouter();
  const snap = USER_SNAPSHOTS[user.id];
  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase();

  const ROLE_COLOR: Record<string, string> = {
    master:  "text-emerald-400/80",
    trainer: "text-[#B48B40]/80",
    client:  "text-[#93C5FD]/70",
    member:  "text-white/35",
  };

  const ROLE_LABEL: Record<string, string> = {
    master: "Admin", trainer: "Trainer", client: "Client", member: "Member",
  };

  const PLAN_COLOR: Record<string, string> = {
    elite: "text-[#B48B40]",
    pro:   "text-white/50",
    free:  "text-white/28",
  };

  return (
    <div
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-[200] w-64 rounded-2xl border border-white/10 bg-[#0F0F0F] shadow-2xl shadow-black/60 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1C1C1C] border border-white/10 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-semibold text-white/50">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/90 truncate">{user.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn("text-[10px] font-medium", ROLE_COLOR[user.role])}>
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
              {user.plan && (
                <>
                  <span className="text-white/15">·</span>
                  <span className={cn("text-[10px] font-medium capitalize", PLAN_COLOR[user.plan])}>
                    {user.plan}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {snap ? (
        <>
          {/* Goal + status */}
          <div className="px-4 py-3 border-b border-white/[0.06] space-y-1">
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                snap.adherence >= 75 ? "bg-emerald-400" :
                snap.adherence >= 50 ? "bg-[#B48B40]"   : "bg-[#F87171]/70"
              )} />
              <span className="text-[11px] text-white/45">{snap.currentStatus}</span>
            </div>
            <p className="text-xs text-white/65 font-medium">{snap.currentGoal}</p>
          </div>

          {/* Adherence + streak */}
          <div className="px-4 py-3 border-b border-white/[0.06] grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.14em] text-white/22 mb-1">Adherence</p>
              <p className={cn("text-xl font-semibold tabular-nums leading-none", adherenceColor(snap.adherence))}>
                {snap.adherence}%
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.14em] text-white/22 mb-1">Streak</p>
              <div className="flex items-baseline gap-1">
                {snap.streak > 0 && (
                  <Flame className="w-3 h-3 text-[#B48B40] shrink-0 mb-0.5" strokeWidth={1.5} />
                )}
                <span className={cn(
                  "text-xl font-semibold tabular-nums leading-none",
                  snap.streak > 0 ? "text-white/80" : "text-white/22"
                )}>
                  {snap.streak}
                </span>
                <span className="text-[10px] text-white/20">d</span>
              </div>
            </div>
          </div>

          {/* Metrics grid */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {snap.metrics.map((m) => (
                <div key={m.label}>
                  <p className="text-[9px] uppercase tracking-[0.12em] text-white/20 mb-0.5">{m.label}</p>
                  <p className="text-xs font-medium text-white/60 tabular-nums">{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="px-3 py-3 flex items-center gap-2">
            <button
              onClick={() => router.push(`/profile/${user.id}`)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition-all py-2 text-[11px] font-medium text-white/50 hover:text-white/75"
            >
              <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
              Open profile
            </button>
            <button
              onClick={() => router.push("/coach")}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition-all py-2 text-[11px] font-medium text-white/50 hover:text-white/75"
            >
              <MessageSquare className="w-3 h-3" strokeWidth={1.5} />
              Message
            </button>
          </div>
        </>
      ) : (
        <div className="px-4 py-4">
          <p className="text-xs text-white/25">No snapshot available.</p>
        </div>
      )}
    </div>
  );
}

// ─── UserNameLink ─────────────────────────────────────────────────────────────

export function UserNameLink({
  user,
  className,
}: {
  user: SnapshotUser;
  className?: string;
}) {
  const { user: viewer } = useUser();
  const router = useRouter();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen]       = useState(false);
  const [cardPos, setCardPos] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  const hideTimer             = useRef<ReturnType<typeof setTimeout> | null>(null);

  // hover card: master + assigned trainer clients
  const showCard = canViewSnapshot(viewer.role, viewer.name, user.id);
  // click-to-profile: same gate (plus own profile — but we only render others)
  const clickable = canViewProfile(viewer.role, viewer.name, user.id, viewer.id);

  useEffect(() => { setMounted(true); }, []);

  const clearHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const scheduleHide = useCallback(() => {
    clearHide();
    hideTimer.current = setTimeout(() => setOpen(false), 180);
  }, [clearHide]);

  function handleMouseEnter() {
    if (!showCard || !triggerRef.current) return;
    clearHide();
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceRight = window.innerWidth - rect.right;
    const cardWidth  = 256 + 8;
    const left = spaceRight >= cardWidth
      ? rect.right + 8
      : rect.left - cardWidth + 8;
    const top = Math.max(8, Math.min(rect.top - 12, window.innerHeight - 420));
    setCardPos({ left, top });
    setOpen(true);
  }

  function handleClick(e: React.MouseEvent) {
    if (!clickable) return;
    e.stopPropagation(); // don't bubble to parent row clicks
    router.push(`/profile/${user.id}`);
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={scheduleHide}
        onClick={handleClick}
        className={cn(
          "transition-colors",
          clickable
            ? "cursor-pointer hover:text-white underline-offset-2 hover:underline decoration-white/20"
            : "cursor-default",
          className
        )}
      >
        {user.name}
      </span>

      {mounted && open &&
        ReactDOM.createPortal(
          <HoverCardContent
            user={user}
            style={cardPos}
            onMouseEnter={clearHide}
            onMouseLeave={scheduleHide}
          />,
          document.body
        )
      }
    </>
  );
}
