"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import {
  Upload, Link2, X, Play, Clapperboard, Plus, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FORM_SUBMISSIONS,
  visibleSubmissions,
  statusLabel,
  scoreColor,
  type FormSubmission,
} from "@/lib/formAnalysis";
import { TRAINER_ASSIGNMENTS } from "@/lib/userProfiles";
import { extractYouTubeId } from "@/lib/videoLibrary";
import { YTIcon } from "@/components/library/YTIcon";

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 7) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const stroke = score >= 85 ? "#34d399" : score >= 70 ? "#B48B40" : "#F87171";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3.5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={stroke} strokeWidth={3.5} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
      />
    </svg>
  );
}

// ─── Submission card ──────────────────────────────────────────────────────────

function SubmissionCard({ sub }: { sub: FormSubmission }) {
  const router = useRouter();
  const st = statusLabel(sub.status);
  const isYT = sub.source === "youtube";
  const thumbUrl = isYT && sub.youtubeData
    ? `https://img.youtube.com/vi/${sub.youtubeData.videoId}/hqdefault.jpg`
    : null;
  const [imgErr, setImgErr] = useState(false);

  return (
    <button
      onClick={() => router.push(`/form/${sub.id}`)}
      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-white/6 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04] transition-all text-left group"
    >
      {/* Thumbnail */}
      <div className={cn(
        "relative w-16 aspect-video rounded-xl overflow-hidden bg-gradient-to-br shrink-0",
        sub.thumbnailColor
      )}>
        {thumbUrl && !imgErr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl} alt="" className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center border border-white/15">
            <Play className="w-2.5 h-2.5 text-white fill-white ml-0.5" />
          </div>
        </div>
        {isYT && (
          <div className="absolute top-1 left-1">
            <YTIcon className="w-2.5 h-2.5 text-[#FF4444]" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/85 truncate">{sub.exerciseName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-[10px] font-medium", st.color)}>{st.label}</span>
          <span className="text-white/15">·</span>
          <span className="text-[10px] text-white/35">{sub.submittedByName}</span>
          <span className="text-white/15">·</span>
          <span className="text-[10px] text-white/30">
            {new Date(sub.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
        {sub.notes && (
          <p className="text-[10px] text-white/25 truncate mt-1">{sub.notes}</p>
        )}
      </div>

      {/* Score */}
      {sub.aiAnalysis && (
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          <div className="relative flex items-center justify-center">
            <ScoreRing score={sub.aiAnalysis.score} size={40} />
            <span className={cn(
              "absolute text-[11px] font-semibold tabular-nums",
              scoreColor(sub.aiAnalysis.score)
            )}>
              {sub.aiAnalysis.score}
            </span>
          </div>
          <span className="text-[9px] text-white/20 uppercase tracking-[0.12em]">score</span>
        </div>
      )}

      <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/30 transition-colors shrink-0" />
    </button>
  );
}

// ─── Submit modal ─────────────────────────────────────────────────────────────

function SubmitModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (sub: FormSubmission) => void;
}) {
  const { user } = useUser();
  const [tab, setTab] = useState<"upload" | "youtube">("upload");
  const [exercise, setExercise] = useState("");
  const [notes, setNotes] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const ytId = extractYouTubeId(ytUrl);
  const ytValid = tab === "youtube" ? !!ytId : true;
  const canSubmit = exercise.trim().length > 0 && ytValid && !submitting;

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);

    const THUMB_COLORS = [
      "from-[#1a1a2e] to-[#16213e]",
      "from-[#1a2a1a] to-[#0d1f0d]",
      "from-[#2a1a1a] to-[#1f0d0d]",
      "from-[#1a1f2a] to-[#0d1219]",
    ];
    const color = THUMB_COLORS[Math.floor(Math.random() * THUMB_COLORS.length)];

    const newSub: FormSubmission = {
      id: `fs_${Date.now()}`,
      exerciseName: exercise.trim(),
      source: tab === "youtube" ? "youtube" : "upload",
      ...(tab === "youtube" && ytId ? { youtubeData: { videoId: ytId, url: ytUrl } } : {}),
      thumbnailColor: color,
      submittedAt: new Date().toISOString(),
      submittedById: user.id,
      submittedByName: user.name,
      status: "pending",
      notes: notes.trim(),
    };

    setTimeout(() => {
      onSubmit(newSub);
      onClose();
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-[#111111] border border-white/8 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <div>
            <h2 className="text-sm font-semibold text-white/90">Submit Form Video</h2>
            <p className="text-xs text-white/30 mt-0.5">Upload footage or paste a YouTube link</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Exercise name */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.12em] text-white/30 mb-1.5 block">
              Exercise name
            </label>
            <input
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              placeholder="e.g. Barbell Back Squat"
              className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 transition-all"
            />
          </div>

          {/* Source tabs */}
          <div>
            <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/6 mb-3">
              {(["upload", "youtube"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                    tab === t
                      ? "bg-white/8 text-white/80"
                      : "text-white/30 hover:text-white/55"
                  )}
                >
                  {t === "upload" ? (
                    <><Upload className="w-3 h-3" /> Upload</>
                  ) : (
                    <><YTIcon className="w-3 h-3" /> YouTube</>
                  )}
                </button>
              ))}
            </div>

            {tab === "upload" ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-white/8 rounded-2xl bg-white/[0.01] hover:border-white/14 hover:bg-white/[0.025] transition-all cursor-pointer group">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-white/8 transition-colors">
                  <Upload className="w-4 h-4 text-white/30" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-white/45">Drop video or click to browse</p>
                  <p className="text-[10px] text-white/22 mt-0.5">MP4, MOV — max 200 MB</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                  <input
                    value={ytUrl}
                    onChange={(e) => setYtUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className={cn(
                      "w-full bg-white/[0.04] border rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder:text-white/25 outline-none transition-all",
                      ytUrl && !ytId
                        ? "border-[#F87171]/40 text-[#F87171]/80"
                        : ytId
                        ? "border-emerald-500/30 text-white/80"
                        : "border-white/8 text-white/80 focus:border-[#B48B40]/40"
                    )}
                  />
                </div>
                {ytId && (
                  <div className="flex items-center gap-2.5 p-2.5 bg-white/[0.02] border border-white/6 rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                      alt="" className="w-14 aspect-video object-cover rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <YTIcon className="w-2.5 h-2.5 text-[#FF4444] shrink-0" />
                        <p className="text-[11px] text-white/55 truncate">YouTube video detected</p>
                      </div>
                      <p className="text-[10px] text-white/25 truncate mt-0.5 font-mono">{ytId}</p>
                    </div>
                  </div>
                )}
                {ytUrl && !ytId && (
                  <p className="text-[10px] text-[#F87171]/70 px-1">Couldn't parse a YouTube video ID from that URL.</p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.12em] text-white/30 mb-1.5 block">
              Notes <span className="normal-case tracking-normal text-white/20">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any context for your coach — load, how it felt, specific concerns..."
              className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "w-full py-2.5 rounded-xl text-sm font-semibold transition-all",
              canSubmit
                ? "bg-[#B48B40] hover:bg-[#C9932A] text-black"
                : "bg-white/5 text-white/20 cursor-not-allowed"
            )}
          >
            {submitting ? "Submitting…" : "Submit for review"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FormPage() {
  const { user } = useUser();
  const [submissions, setSubmissions] = useState<FormSubmission[]>(FORM_SUBMISSIONS);
  const [showModal, setShowModal] = useState(false);

  const visible = useMemo(
    () => visibleSubmissions(submissions, user.id, user.role, user.name, TRAINER_ASSIGNMENTS),
    [submissions, user]
  );

  const canSubmit = ["client", "member", "trainer", "master"].includes(user.role);

  function handleSubmit(sub: FormSubmission) {
    setSubmissions((prev) => [sub, ...prev]);
  }

  const coachReviewed = visible.filter((s) => s.status === "coach_reviewed");
  const aiReviewed    = visible.filter((s) => s.status === "ai_reviewed");
  const pending       = visible.filter((s) => s.status === "pending" || s.status === "analyzing");

  return (
    <div className="flex-1 min-h-screen bg-[#0A0A0A]">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-10">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Clapperboard className="w-4 h-4 text-[#B48B40]" />
              <h1 className="text-lg font-semibold text-white/90">Form Analysis</h1>
            </div>
            <p className="text-sm text-white/35">
              {user.role === "master" || user.role === "trainer"
                ? "Review submissions and leave coaching feedback"
                : "Submit a video and get coaching feedback from your trainer"}
            </p>
          </div>
          {canSubmit && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#B48B40] hover:bg-[#C9932A] text-black text-xs font-semibold transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Submit video
            </button>
          )}
        </div>

        {/* Empty state */}
        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/6 flex items-center justify-center mb-4">
              <Clapperboard className="w-5 h-5 text-white/20" />
            </div>
            <p className="text-sm font-medium text-white/35">No submissions yet</p>
            <p className="text-xs text-white/20 mt-1">
              {canSubmit ? "Submit a video and your coach will review it and leave feedback." : "No submissions to review yet."}
            </p>
          </div>
        )}

        {/* Coach reviewed */}
        {coachReviewed.length > 0 && (
          <section className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/25 mb-2 px-1">Coach reviewed</p>
            <div className="space-y-2">
              {coachReviewed.map((s) => <SubmissionCard key={s.id} sub={s} />)}
            </div>
          </section>
        )}

        {/* Reviewed (includes legacy AI-reviewed submissions) */}
        {aiReviewed.length > 0 && (
          <section className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/25 mb-2 px-1">Reviewed</p>
            <div className="space-y-2">
              {aiReviewed.map((s) => <SubmissionCard key={s.id} sub={s} />)}
            </div>
          </section>
        )}

        {/* Pending */}
        {pending.length > 0 && (
          <section className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/25 mb-2 px-1">Pending</p>
            <div className="space-y-2">
              {pending.map((s) => <SubmissionCard key={s.id} sub={s} />)}
            </div>
          </section>
        )}
      </div>

      {showModal && (
        <SubmitModal onClose={() => setShowModal(false)} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
