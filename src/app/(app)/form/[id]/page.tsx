"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import {
  ArrowLeft, Star, CheckCircle2, ChevronDown, ChevronUp,
  TrendingUp, AlertCircle, Zap, Play, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FORM_SUBMISSIONS,
  scoreColor,
  scoreLabel,
  statusLabel,
  type FormSubmission,
  type CoachReview,
} from "@/lib/formAnalysis";
import { youTubeEmbedUrl } from "@/lib/videoLibrary";
import { YTIcon } from "@/components/library/YTIcon";

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const stroke = score >= 85 ? "#34d399" : score >= 70 ? "#B48B40" : "#F87171";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={stroke} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
    </svg>
  );
}

// ─── Mock video player ────────────────────────────────────────────────────────

function MockPlayer({ sub }: { sub: FormSubmission }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div
      className={cn(
        "relative w-full aspect-video rounded-2xl overflow-hidden bg-gradient-to-br cursor-pointer group",
        sub.thumbnailColor
      )}
      onClick={() => setPlaying(!playing)}
    >
      {!playing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-full bg-black/50 border border-white/15 flex items-center justify-center group-hover:bg-black/65 transition-colors">
            <Play className="w-6 h-6 text-white fill-white ml-1" />
          </div>
          <p className="text-xs text-white/30">{sub.exerciseName}</p>
        </div>
      )}
      {playing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <p className="text-sm text-white/40">Video playback (mock)</p>
        </div>
      )}
    </div>
  );
}

// ─── Cue priority badge ───────────────────────────────────────────────────────

function PriorityDot({ priority }: { priority: "high" | "medium" | "low" }) {
  return (
    <span className={cn(
      "w-1.5 h-1.5 rounded-full shrink-0 mt-1.5",
      priority === "high"   ? "bg-[#F87171]/80" :
      priority === "medium" ? "bg-[#B48B40]"    : "bg-white/20"
    )} />
  );
}

// ─── Star rating ─────────────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          disabled={!onChange}
          className={cn(
            "transition-colors",
            onChange ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"
          )}
        >
          <Star
            className={cn(
              "w-4 h-4",
              n <= value ? "text-[#B48B40] fill-[#B48B40]" : "text-white/15"
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Coach review section ─────────────────────────────────────────────────────

function CoachReviewSection({
  sub,
  canReview,
  onSave,
}: {
  sub: FormSubmission;
  canReview: boolean;
  onSave: (review: CoachReview) => void;
}) {
  const { user } = useUser();
  const [editing, setEditing] = useState(false);
  const [rating, setRating]             = useState<number>(sub.coachReview?.rating ?? 0);
  const [overall, setOverall]           = useState(sub.coachReview?.overall ?? "");
  const [technicalNotes, setTechnical]  = useState(sub.coachReview?.technicalNotes ?? "");
  const [cueInput, setCueInput]         = useState("");
  const [cues, setCues]                 = useState<string[]>(sub.coachReview?.cues ?? []);

  const existing = sub.coachReview;

  function handleSave() {
    if (!rating || !overall.trim()) return;
    onSave({
      coachName: user.name,
      coachId: user.id,
      reviewedAt: new Date().toISOString(),
      rating: rating as 1 | 2 | 3 | 4 | 5,
      overall: overall.trim(),
      technicalNotes: technicalNotes.trim(),
      cues,
    });
    setEditing(false);
  }

  function addCue() {
    const c = cueInput.trim();
    if (!c) return;
    setCues((prev) => [...prev, c]);
    setCueInput("");
  }

  // Read-only view
  if (existing && !editing) {
    return (
      <div className="rounded-2xl border border-white/6 bg-white/[0.02] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/80" />
            <span className="text-xs font-medium text-white/70">Coach feedback</span>
          </div>
          <div className="flex items-center gap-3">
            <StarRating value={existing.rating} />
            {canReview && (
              <button
                onClick={() => setEditing(true)}
                className="text-[10px] text-white/30 hover:text-white/55 transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.12em] text-white/22 mb-1">
              {existing.coachName} · {new Date(existing.reviewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
            <p className="text-sm text-white/70 leading-relaxed">{existing.overall}</p>
          </div>

          {existing.technicalNotes && (
            <div className="pt-2 border-t border-white/[0.05]">
              <p className="text-[9px] uppercase tracking-[0.12em] text-white/22 mb-1.5">Technical notes</p>
              <p className="text-xs text-white/55 leading-relaxed">{existing.technicalNotes}</p>
            </div>
          )}

          {existing.cues.length > 0 && (
            <div className="pt-2 border-t border-white/[0.05]">
              <p className="text-[9px] uppercase tracking-[0.12em] text-white/22 mb-1.5">Coach cues</p>
              <ul className="space-y-1">
                {existing.cues.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#B48B40] shrink-0 mt-1.5" />
                    <span className="text-xs text-white/55">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Edit/add form (trainer/master only)
  if (canReview && (editing || !existing)) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
          <span className="text-xs font-medium text-white/70">
            {existing ? "Edit coach feedback" : "Add coach feedback"}
          </span>
          {existing && (
            <button
              onClick={() => setEditing(false)}
              className="text-[10px] text-white/30 hover:text-white/55 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <StarRating value={rating} onChange={setRating} />
            <span className="text-xs text-white/30">{rating > 0 ? `${rating}/5` : "Rate this submission"}</span>
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-[0.12em] text-white/25 mb-1 block">Overall feedback</label>
            <textarea
              value={overall}
              onChange={(e) => setOverall(e.target.value)}
              rows={3}
              placeholder="Your overall assessment of this submission..."
              className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 transition-all resize-none"
            />
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-[0.12em] text-white/25 mb-1 block">Technical notes</label>
            <textarea
              value={technicalNotes}
              onChange={(e) => setTechnical(e.target.value)}
              rows={2}
              placeholder="Specific technical observations..."
              className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 transition-all resize-none"
            />
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-[0.12em] text-white/25 mb-1 block">Coaching cues</label>
            <div className="flex gap-2">
              <input
                value={cueInput}
                onChange={(e) => setCueInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCue()}
                placeholder="Add a cue and press Enter..."
                className="flex-1 bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 transition-all"
              />
              <button
                onClick={addCue}
                className="px-3 py-2 rounded-xl border border-white/8 text-white/35 hover:text-white/60 hover:border-white/15 transition-all text-xs"
              >
                Add
              </button>
            </div>
            {cues.length > 0 && (
              <ul className="mt-2 space-y-1">
                {cues.map((c, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-white/[0.02]">
                    <span className="text-xs text-white/50">{c}</span>
                    <button
                      onClick={() => setCues((prev) => prev.filter((_, j) => j !== i))}
                      className="text-white/20 hover:text-white/50 transition-colors"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={!rating || !overall.trim()}
            className={cn(
              "w-full py-2 rounded-xl text-sm font-semibold transition-all",
              rating && overall.trim()
                ? "bg-[#B48B40] hover:bg-[#C9932A] text-black"
                : "bg-white/5 text-white/20 cursor-not-allowed"
            )}
          >
            Save feedback
          </button>
        </div>
      </div>
    );
  }

  // Client — no review yet
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] px-4 py-5 text-center">
      <p className="text-xs text-white/25">Coach review pending</p>
      <p className="text-[10px] text-white/15 mt-0.5">Your trainer will review this submission soon.</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FormDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useUser();

  const [submissions, setSubmissions] = useState<FormSubmission[]>(FORM_SUBMISSIONS);
  const [showAllCues, setShowAllCues] = useState(false);

  const sub = submissions.find((s) => s.id === id);

  if (!sub) {
    return (
      <div className="flex-1 min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-white/30">Submission not found</p>
          <button
            onClick={() => router.push("/form")}
            className="mt-3 text-xs text-[#B48B40] hover:text-[#C9932A] transition-colors"
          >
            Back to Form Analysis
          </button>
        </div>
      </div>
    );
  }

  const isYT = sub.source === "youtube";
  const ai = sub.aiAnalysis;
  const st = statusLabel(sub.status);
  const canReview = user.role === "master" || user.role === "trainer";
  const visibleCues = showAllCues ? (ai?.cues ?? []) : (ai?.cues ?? []).slice(0, 3);

  function handleSaveReview(review: CoachReview) {
    setSubmissions((prev) =>
      prev.map((s) =>
sub && s.id === sub.id ? { ...s, status: "coach_reviewed", coachReview: review } : s      )
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-[#0A0A0A]">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-10">

        {/* Back + header */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/form")}
            className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Form Analysis
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-white/90">{sub.exerciseName}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                <span className={cn("text-xs font-medium", st.color)}>{st.label}</span>
                <span className="text-white/15">·</span>
                <span className="text-xs text-white/30">{sub.submittedByName}</span>
                <span className="text-white/15">·</span>
                <span className="text-xs text-white/25">
                  {new Date(sub.submittedAt).toLocaleDateString("en-US", {
                    month: "long", day: "numeric", year: "numeric"
                  })}
                </span>
              </div>
            </div>

            {ai && (
              <div className="relative shrink-0 flex flex-col items-center">
                <ScoreRing score={ai.score} size={72} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn("text-xl font-bold tabular-nums leading-none", scoreColor(ai.score))}>
                    {ai.score}
                  </span>
                  <span className="text-[9px] text-white/25 mt-0.5">/100</span>
                </div>
                <span className={cn("text-[10px] font-medium mt-1", scoreColor(ai.score))}>
                  {scoreLabel(ai.score)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* Left column: video + coach review */}
          <div className="lg:col-span-5 space-y-4">

            {/* Video */}
            {isYT && sub.youtubeData ? (
              <div className="rounded-2xl overflow-hidden border border-white/8 bg-black">
                <div className="relative w-full aspect-video">
                  <iframe
                    src={youTubeEmbedUrl(sub.youtubeData.videoId)}
                    title={sub.exerciseName}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-2 border-t border-white/6">
                  <YTIcon className="w-3 h-3 text-[#FF4444] shrink-0" />
                  <span className="text-[10px] text-white/35 flex-1">YouTube submission</span>
                  <a
                    href={sub.youtubeData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/55 transition-colors"
                  >
                    Open <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            ) : (
              <MockPlayer sub={sub} />
            )}

            {/* Notes */}
            {sub.notes && (
              <div className="px-4 py-3 rounded-2xl border border-white/[0.05] bg-white/[0.01]">
                <p className="text-[9px] uppercase tracking-[0.12em] text-white/22 mb-1">Submission notes</p>
                <p className="text-sm text-white/55 leading-relaxed">{sub.notes}</p>
              </div>
            )}

            {/* Coach review */}
            <CoachReviewSection
              sub={sub}
              canReview={canReview}
              onSave={handleSaveReview}
            />
          </div>

          {/* Right column: AI analysis */}
          <div className="lg:col-span-7 space-y-4">
            {ai ? (
              <>
                {/* Summary */}
                <div className="rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5 text-[#B48B40]" />
                    <span className="text-xs font-medium text-white/65">AI Analysis</span>
                    <span className="text-[9px] text-white/20 ml-auto">
                      {new Date(ai.analyzedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm text-white/65 leading-relaxed">{ai.summary}</p>
                </div>

                {/* Strengths */}
                <div className="rounded-2xl border border-white/6 bg-white/[0.02] overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400/70" />
                    <span className="text-xs font-medium text-white/65">Strengths</span>
                    <span className="text-[10px] text-white/25 ml-auto">{ai.strengths.length}</span>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {ai.strengths.map((s) => (
                      <div key={s.id} className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 shrink-0 mt-1.5" />
                          <div>
                            <p className="text-xs font-medium text-white/75">{s.label}</p>
                            <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{s.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Improvements */}
                <div className="rounded-2xl border border-white/6 bg-white/[0.02] overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]">
                    <AlertCircle className="w-3.5 h-3.5 text-[#F87171]/70" />
                    <span className="text-xs font-medium text-white/65">Improvements</span>
                    <span className="text-[10px] text-white/25 ml-auto">{ai.improvements.length}</span>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {ai.improvements.map((imp) => (
                      <div key={imp.id} className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F87171]/60 shrink-0 mt-1.5" />
                          <div>
                            <p className="text-xs font-medium text-white/75">{imp.label}</p>
                            <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{imp.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coaching cues */}
                <div className="rounded-2xl border border-white/6 bg-white/[0.02] overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]">
                    <span className="text-[10px] font-medium text-[#B48B40]">CUES</span>
                    <span className="text-[10px] text-white/25 ml-auto">{ai.cues.length} total</span>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {visibleCues.map((cue) => (
                      <div key={cue.id} className="px-4 py-3 flex items-start gap-3">
                        <PriorityDot priority={cue.priority} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] uppercase tracking-[0.12em] text-white/22 mb-1">{cue.phase}</p>
                          <p className="text-xs text-white/65 leading-relaxed">{cue.cue}</p>
                        </div>
                        <span className={cn(
                          "text-[9px] uppercase tracking-[0.10em] shrink-0 mt-1",
                          cue.priority === "high"   ? "text-[#F87171]/50" :
                          cue.priority === "medium" ? "text-[#B48B40]/60" : "text-white/18"
                        )}>
                          {cue.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                  {ai.cues.length > 3 && (
                    <button
                      onClick={() => setShowAllCues(!showAllCues)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] text-white/30 hover:text-white/55 transition-colors border-t border-white/[0.05]"
                    >
                      {showAllCues ? (
                        <><ChevronUp className="w-3 h-3" /> Show less</>
                      ) : (
                        <><ChevronDown className="w-3 h-3" /> Show {ai.cues.length - 3} more</>
                      )}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-white/6 bg-white/[0.02] overflow-hidden">
                <div className="px-5 py-10 flex flex-col items-center text-center">
                  <div className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/6 flex items-center justify-center mb-4">
                    <Zap className="w-5 h-5 text-white/18" />
                  </div>
                  <p className="text-sm font-medium text-white/40">Awaiting coach review</p>
                  <p className="text-xs text-white/22 mt-1.5 leading-relaxed max-w-[200px]">
                    {canReview
                      ? "Watch the video and add your feedback using the coach panel."
                      : "Your trainer will watch this and leave feedback shortly."}
                  </p>
                </div>
                <div className="border-t border-white/[0.05] px-5 py-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/15 shrink-0" />
                  <span className="text-[10px] text-white/22">
                    AI analysis — available in a future update
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
