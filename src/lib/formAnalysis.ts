// ─── Types ────────────────────────────────────────────────────────────────────

export type FormStatus =
  | "pending"       // just uploaded, not yet analysed
  | "analyzing"     // AI in progress (UI shimmer state)
  | "ai_reviewed"   // AI complete, coach not yet reviewed
  | "coach_reviewed"; // coach has left feedback

export type FormPoint = {
  id: string;
  label: string;
  detail: string;
};

export type FormCue = {
  id: string;
  phase: string;       // "Setup", "Eccentric", "Concentric", "Lockout", etc.
  cue: string;
  priority: "high" | "medium" | "low";
};

export type AIFormAnalysis = {
  score: number;       // 0–100 — overall form score
  summary: string;
  strengths: FormPoint[];
  improvements: FormPoint[];
  cues: FormCue[];
  analyzedAt: string;
};

export type CoachReview = {
  coachName: string;
  coachId: string;
  reviewedAt: string;
  rating: 1 | 2 | 3 | 4 | 5;
  overall: string;
  technicalNotes: string;
  cues: string[];
};

export type VideoSource = "upload" | "youtube";

export type FormSubmission = {
  id: string;
  exerciseName: string;
  source: VideoSource;
  youtubeData?: { videoId: string; url: string; channelName?: string };
  thumbnailColor: string;
  submittedAt: string;
  submittedById: string;
  submittedByName: string;
  status: FormStatus;
  aiAnalysis?: AIFormAnalysis;
  coachReview?: CoachReview;
  notes: string;
};

// ─── AI Analysis Presets ──────────────────────────────────────────────────────

type AnalysisPreset = Omit<AIFormAnalysis, "analyzedAt" | "score"> & { baseScore: number };

function uid() { return Math.random().toString(36).slice(2, 8); }

const ANALYSIS_PRESETS: Record<string, AnalysisPreset> = {
  squat: {
    baseScore: 78,
    summary:
      "Solid overall pattern with good depth. The main thing holding you back is knee tracking — your knees cave inward on the concentric, especially when fatigue sets in. Address this and your squat will be significantly safer and stronger.",
    strengths: [
      { id: uid(), label: "Depth consistent",        detail: "You're hitting parallel or below on every rep — no quarter squatting." },
      { id: uid(), label: "Neutral spine maintained", detail: "Lower back position stays clean through the eccentric phase." },
      { id: uid(), label: "Bar position stable",      detail: "Bar doesn't shift or roll during the set — good tension through the upper back." },
    ],
    improvements: [
      { id: uid(), label: "Knee valgus on drive up",    detail: "Knees are collapsing inward off the bottom. This is a glute and adductor recruitment issue, not a flexibility one." },
      { id: uid(), label: "Forward torso lean building", detail: "As fatigue accumulates, your chest drops and torso angle becomes more horizontal — puts extra load on the lower back." },
    ],
    cues: [
      { id: uid(), phase: "Setup",      cue: "Spread the floor with your feet — externally rotate before you descend.", priority: "high" },
      { id: uid(), phase: "Descent",    cue: "Keep your chest proud the entire way down. Where your eyes go, your torso follows.", priority: "medium" },
      { id: uid(), phase: "Drive",      cue: "Push your knees out hard off the bottom — think about driving them toward your pinky toes.", priority: "high" },
      { id: uid(), phase: "Lockout",    cue: "Full hip extension at the top — don't short the rep. Squeeze glutes.", priority: "medium" },
    ],
  },

  deadlift: {
    baseScore: 82,
    summary:
      "Strong setup and hip mechanics. You're losing the bar on the way up — it drifts forward off the floor, which robs you of leg drive and stresses the lower back. Get the bar dragging up your shins and this becomes a completely different lift.",
    strengths: [
      { id: uid(), label: "Bar over mid-foot at setup", detail: "Correct starting position — bar is 1 inch from the shin, directly over the mid-foot." },
      { id: uid(), label: "Hinge pattern clean",        detail: "You're not squatting the deadlift — the hip hinge is real and your lats are engaged." },
      { id: uid(), label: "Grip and tension solid",     detail: "No early slack in the bar. You create tension before the pull." },
    ],
    improvements: [
      { id: uid(), label: "Bar drifts forward off the floor", detail: "In the first 6 inches of the pull, the bar moves out instead of straight up. This is a lat engagement issue — you're not protecting the bar path." },
      { id: uid(), label: "Lockout incomplete on later reps",  detail: "Hips aren't fully extending on reps 4 and 5. You're leaving the last 5% of the rep unfinished." },
    ],
    cues: [
      { id: uid(), phase: "Setup",   cue: "Before you pull, think: 'protect the bar path.' Pull your lats into your back pockets.", priority: "high" },
      { id: uid(), phase: "Pull",    cue: "Drag the bar up your shins — not out in front. The skin contact is the cue.", priority: "high" },
      { id: uid(), phase: "Mid-pull", cue: "Keep the bar close at the knee — don't let it swing away from you.", priority: "medium" },
      { id: uid(), phase: "Lockout", cue: "Drive hips through. Glutes and hamstrings all the way — stand tall at the top.", priority: "medium" },
    ],
  },

  bench: {
    baseScore: 74,
    summary:
      "Your setup is solid — good arch, foot drive, and the bar reaches your chest. The issue is elbow angle and bar path. Elbows are flaring too wide on the way down, which puts the shoulders in a compromised position and makes the press less efficient.",
    strengths: [
      { id: uid(), label: "Arch and leg drive consistent", detail: "Setup is repeatable. Arch is there, leg drive is active — good foundation." },
      { id: uid(), label: "Bar touches chest on every rep", detail: "Full range of motion maintained throughout the set — no ghost reps." },
      { id: uid(), label: "Scapula retracted and depressed", detail: "You're creating the shelf before the unrack. Shoulder position is safe at the start." },
    ],
    improvements: [
      { id: uid(), label: "Elbows flaring — shoulder risk",   detail: "Elbows are at 90° to the torso. Aim for 45–75°. Wide flare is the most common cause of shoulder impingement on bench." },
      { id: uid(), label: "Bar path slightly curved",         detail: "Bar is drifting toward your face on the press instead of moving in a slight arc back toward the rack." },
      { id: uid(), label: "Descent too fast — losing tension", detail: "You're dropping the bar rather than lowering it. Eccentric should be 2–3 seconds." },
    ],
    cues: [
      { id: uid(), phase: "Setup",   cue: "Retract and depress your scapula — create the shelf, then get tight before you unrack.", priority: "medium" },
      { id: uid(), phase: "Descent", cue: "Tuck elbows to 45–75° from your torso. Think: 'lead with the elbows, not the wrists.'", priority: "high" },
      { id: uid(), phase: "Press",   cue: "Drive through your back, not your arms. Push yourself away from the bar.", priority: "high" },
      { id: uid(), phase: "Control", cue: "Slow the descent to 2–3 seconds. The stretch reflex at the bottom is power — use it.", priority: "medium" },
    ],
  },

  pullup: {
    baseScore: 71,
    summary:
      "Full range of motion and controlled descent — both things most people skip. The issue is initiation. You're not depressing your scapula before the pull, so your lats never properly load. Fix the first inch of the movement and the rest of the rep gets much stronger.",
    strengths: [
      { id: uid(), label: "Full range of motion",     detail: "Dead hang at the bottom, chin clear over the bar at the top. No half reps." },
      { id: uid(), label: "Controlled descent",       detail: "You're not dropping — the eccentric is slow and deliberate. This builds real strength." },
      { id: uid(), label: "Grip consistent",          detail: "Grip width stays the same rep-to-rep. No shifting." },
    ],
    improvements: [
      { id: uid(), label: "Scapula not depressed at initiation", detail: "You're starting the pull before your shoulder blades have set. The lats can't properly engage until the scapula is depressed and retracted." },
      { id: uid(), label: "Kipping on reps 5–6",               detail: "Minor momentum creeping in toward the end of the set. These reps don't count the same as the clean ones." },
    ],
    cues: [
      { id: uid(), phase: "Start",       cue: "Dead hang first — let the scapula fully elevate.", priority: "medium" },
      { id: uid(), phase: "Initiation",  cue: "Before you pull, depress and retract the scapula. That's the lat activation you need.", priority: "high" },
      { id: uid(), phase: "Pull",        cue: "Drive elbows down and back into your pockets. Think: pull the bar to your chest, not your chin to the bar.", priority: "high" },
      { id: uid(), phase: "Top",         cue: "Chin clearly over the bar — don't short it. Full ROM or it doesn't count.", priority: "medium" },
    ],
  },

  ohp: {
    baseScore: 80,
    summary:
      "Good lockout and wrist stack. The issue is the bar path — you're pressing straight up instead of back, which means the bar stays in front of your center of mass instead of over it. This limits how much you can press and creates lower back stress.",
    strengths: [
      { id: uid(), label: "Wrists stacked over elbows", detail: "Clean mechanical position at setup — no forward wrist break." },
      { id: uid(), label: "Full lockout achieved",       detail: "Arms fully extend at the top. No short pressing." },
      { id: uid(), label: "Leg drive stable",            detail: "No excessive lean-back compensating during the press. Glutes are engaged." },
    ],
    improvements: [
      { id: uid(), label: "Bar path forward — not back over the head", detail: "At lockout, the bar should be directly above your shoulders, hips, and feet. Right now it finishes 3–4 inches in front of that line." },
      { id: uid(), label: "Lower back hyperextending under load",       detail: "Hips are pushing forward and lumbar is arching — the body is compensating for the forward bar path. Fix the bar path and this fixes itself." },
    ],
    cues: [
      { id: uid(), phase: "Setup",   cue: "Glutes and abs braced — create a rigid torso before the press.", priority: "high" },
      { id: uid(), phase: "Press",   cue: "Move your head back as the bar passes your forehead — create the path for the bar to go over your head.", priority: "high" },
      { id: uid(), phase: "Lockout", cue: "Bar over shoulders, over hips — vertical. Shrug up slightly at the top to pack the shoulder.", priority: "medium" },
      { id: uid(), phase: "Return",  cue: "Control the descent. Don't crash the bar into your shoulders — lower it with tension.", priority: "low" },
    ],
  },

  generic: {
    baseScore: 76,
    summary:
      "Overall movement pattern is functional. A few technical details to clean up — mostly around consistency through the full set as fatigue builds. The first few reps look good; the later reps start to drift.",
    strengths: [
      { id: uid(), label: "Range of motion maintained",   detail: "You're completing full reps — no cut ROM as the set gets harder." },
      { id: uid(), label: "Breathing pattern consistent", detail: "Proper bracing on the exertion phase and breath reset between reps." },
    ],
    improvements: [
      { id: uid(), label: "Form degrading on final reps",    detail: "Reps 4–5 show significant technique drop-off compared to reps 1–2. This is a sign the load is too high for your current capacity on this exercise." },
      { id: uid(), label: "Setup variability rep-to-rep",    detail: "Your starting position isn't identical each rep. A consistent setup is the foundation of a consistent lift." },
    ],
    cues: [
      { id: uid(), phase: "Setup",    cue: "Reset fully between every rep. Same position, every single time.", priority: "high" },
      { id: uid(), phase: "Execution", cue: "If form starts to go, stop the set. Training bad reps is training bad movement.", priority: "high" },
      { id: uid(), phase: "Focus",    cue: "Pick one cue per session and drill it — don't try to fix everything at once.", priority: "medium" },
    ],
  },
};

export function getAnalysisPreset(exerciseName: string): AnalysisPreset {
  const name = exerciseName.toLowerCase();
  if (/squat|goblet|front squat|box squat/.test(name))       return ANALYSIS_PRESETS.squat;
  if (/deadlift|rdl|romanian|sumo|trap bar/.test(name))      return ANALYSIS_PRESETS.deadlift;
  if (/bench|chest press|push/.test(name))                   return ANALYSIS_PRESETS.bench;
  if (/pull.?up|chin.?up/.test(name))                        return ANALYSIS_PRESETS.pullup;
  if (/overhead|ohp|shoulder press|military/.test(name))     return ANALYSIS_PRESETS.ohp;
  return ANALYSIS_PRESETS.generic;
}

export function generateAIAnalysis(exerciseName: string): AIFormAnalysis {
  const preset = getAnalysisPreset(exerciseName);
  // ±5 variance on score so repeated submits feel natural
  const variance = Math.floor(Math.random() * 11) - 5;
  return {
    ...preset,
    score: Math.max(40, Math.min(99, preset.baseScore + variance)),
    analyzedAt: new Date().toISOString(),
  };
}

// ─── Mock Submissions ─────────────────────────────────────────────────────────

export const FORM_SUBMISSIONS: FormSubmission[] = [
  {
    id: "fs_001",
    exerciseName: "Barbell Back Squat",
    source: "upload",
    thumbnailColor: "from-[#1a1a2e] to-[#16213e]",
    submittedAt: "2026-03-25T09:14:00Z",
    submittedById: "u1",
    submittedByName: "Kai Nakamura",
    status: "coach_reviewed",
    notes: "Third set of my work sets. Felt my knees drifting in.",
    aiAnalysis: {
      score: 78,
      summary:
        "Solid overall pattern with good depth. The main thing holding you back is knee tracking — your knees cave inward on the concentric, especially when fatigue sets in.",
      strengths: [
        { id: "s1", label: "Depth consistent",         detail: "You're hitting parallel or below on every rep." },
        { id: "s2", label: "Neutral spine maintained",  detail: "Lower back position stays clean through the eccentric." },
        { id: "s3", label: "Bar position stable",       detail: "Bar doesn't shift during the set — good upper back tension." },
      ],
      improvements: [
        { id: "i1", label: "Knee valgus on drive up",     detail: "Knees collapsing inward off the bottom — glute and adductor recruitment issue." },
        { id: "i2", label: "Forward torso lean building",  detail: "Chest drops as fatigue accumulates, increasing lower back load." },
      ],
      cues: [
        { id: "c1", phase: "Setup",   cue: "Spread the floor with your feet — externally rotate before you descend.", priority: "high"   },
        { id: "c2", phase: "Descent", cue: "Keep your chest proud the whole way down.", priority: "medium" },
        { id: "c3", phase: "Drive",   cue: "Push knees out hard off the bottom — toward your pinky toes.", priority: "high"   },
        { id: "c4", phase: "Lockout", cue: "Full hip extension at the top. Squeeze glutes.", priority: "medium" },
      ],
      analyzedAt: "2026-03-25T09:14:45Z",
    },
    coachReview: {
      coachName: "Alex Rivera",
      coachId: "u4",
      reviewedAt: "2026-03-25T14:32:00Z",
      rating: 4,
      overall:
        "AI nailed the knee valgus issue — that's the priority. I'd also add: your walkout is wasting energy. Get the bar set faster and reduce the steps. Three steps max: one big step back each foot, feet set.",
      technicalNotes:
        "Watch reps 3 and 4 specifically. On rep 3 the left knee caves first — this suggests your left glute is the weaker side. I want you doing single-leg glute work before every squat session: 3×10 banded clam shells or single-leg hip thrusts.",
      cues: [
        "Left glute activation before every squat session",
        "3-step walkout maximum",
        "Belt one notch tighter for your next top set",
      ],
    },
  },

  {
    id: "fs_002",
    exerciseName: "Romanian Deadlift",
    source: "upload",
    thumbnailColor: "from-[#1a2a1a] to-[#0d1f0d]",
    submittedAt: "2026-03-22T11:05:00Z",
    submittedById: "u2",
    submittedByName: "Priya Sharma",
    status: "ai_reviewed",
    notes: "Working on hip hinge pattern. Using 60kg.",
    aiAnalysis: {
      score: 84,
      summary:
        "Very clean hip hinge. Bar path is good and the hamstring stretch is real. The only thing to address is bar control on the return — you're resetting too fast and losing tension at the top.",
      strengths: [
        { id: "s1", label: "Hip hinge pattern solid",     detail: "You're driving hips back correctly — not squatting the RDL." },
        { id: "s2", label: "Bar stays close to body",     detail: "Bar is dragging up the legs, not swinging out." },
        { id: "s3", label: "Hamstring stretch achieved",  detail: "Real end-range stretch on every rep — you're getting the full benefit." },
      ],
      improvements: [
        { id: "i1", label: "Return too fast — losing tension", detail: "You're standing up quickly and the bar goes slack at the top. Keep tension throughout." },
      ],
      cues: [
        { id: "c1", phase: "Setup",    cue: "Soft knee bend locked in — don't let the knee angle change.", priority: "medium" },
        { id: "c2", phase: "Descent",  cue: "Push hips back to the wall behind you. Bar stays in contact with legs.",  priority: "high"   },
        { id: "c3", phase: "Stretch",  cue: "Go until you feel the hamstrings load — that's your end range.", priority: "medium" },
        { id: "c4", phase: "Return",   cue: "Drive hips forward with control. Don't flop back up.", priority: "high"   },
      ],
      analyzedAt: "2026-03-22T11:05:50Z",
    },
  },

  {
    id: "fs_003",
    exerciseName: "Overhead Press",
    source: "youtube",
    youtubeData: {
      videoId: "F3QY5vMz_6I",
      url: "https://www.youtube.com/watch?v=F3QY5vMz_6I",
    },
    thumbnailColor: "from-[#2a1f1a] to-[#1f1309]",
    submittedAt: "2026-03-20T16:45:00Z",
    submittedById: "u1",
    submittedByName: "Kai Nakamura",
    status: "ai_reviewed",
    notes: "Overhead press — 50kg. Feel like I'm hyperextending my lower back.",
    aiAnalysis: {
      score: 80,
      summary:
        "Good lockout and wrist stack. The bar path issue is causing the lower back hyperextension you're feeling — you're pressing straight up instead of back over your head.",
      strengths: [
        { id: "s1", label: "Wrists stacked over elbows", detail: "Clean mechanical position at setup." },
        { id: "s2", label: "Full lockout achieved",       detail: "Arms fully extend at the top — no soft elbows." },
      ],
      improvements: [
        { id: "i1", label: "Bar path forward at lockout",      detail: "Bar finishes in front of shoulders instead of directly above them." },
        { id: "i2", label: "Lower back hyperextending",         detail: "Body compensating for the forward bar path by leaning back." },
      ],
      cues: [
        { id: "c1", phase: "Setup",   cue: "Glutes and abs tight — rigid torso before you press.", priority: "high"   },
        { id: "c2", phase: "Press",   cue: "Move your head back as the bar passes your forehead.", priority: "high"   },
        { id: "c3", phase: "Lockout", cue: "Bar should be directly over your ears, shoulders, and hips.", priority: "medium" },
        { id: "c4", phase: "Return",  cue: "Control the descent — don't crash the bar into your shoulders.", priority: "low"    },
      ],
      analyzedAt: "2026-03-20T16:45:55Z",
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-[#B48B40]";
  return "text-[#F87171]";
}

export function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 70) return "Needs work";
  return "Major issues";
}

export function statusLabel(status: FormStatus): { label: string; color: string; dot: string } {
  switch (status) {
    case "pending":        return { label: "Pending",        color: "text-white/40",      dot: "bg-white/20"     };
    case "analyzing":      return { label: "Analyzing…",     color: "text-[#93C5FD]/70",  dot: "bg-[#93C5FD]/60" };
    case "ai_reviewed":    return { label: "AI reviewed",    color: "text-[#B48B40]",     dot: "bg-[#B48B40]"    };
    case "coach_reviewed": return { label: "Coach reviewed", color: "text-emerald-400/80", dot: "bg-emerald-400"  };
  }
}

/** Returns which submissions a given viewer is allowed to see */
export function visibleSubmissions(
  submissions: FormSubmission[],
  viewerId: string,
  viewerRole: string,
  viewerName: string,
  trainerAssignments: Record<string, string[]>,
): FormSubmission[] {
  if (viewerRole === "master") return submissions;
  if (viewerRole === "trainer") {
    const myClients = trainerAssignments[viewerName] ?? [];
    return submissions.filter(
      (s) => s.submittedById === viewerId || myClients.includes(s.submittedById)
    );
  }
  // client / member — only own
  return submissions.filter((s) => s.submittedById === viewerId);
}
