// ─── Types ────────────────────────────────────────────────────────────────────

export type VideoSource = "upload" | "youtube";

export type YouTubeData = {
  videoId: string;
  originalUrl: string;
  channelName?: string;
};

export type MuscleGroup =
  | "chest" | "back" | "shoulders" | "biceps" | "triceps"
  | "quads" | "hamstrings" | "glutes" | "calves" | "core" | "full_body";

export type MovementType =
  | "push" | "pull" | "hinge" | "squat" | "carry" | "rotation" | "isometric" | "plyometric";

export type Equipment =
  | "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight" | "kettlebell" | "bands" | "smith";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type VideoStatus = "active" | "processing" | "draft";

export type ExerciseVideo = {
  id: string;
  source: VideoSource;
  youtubeData?: YouTubeData;    // only when source === "youtube"
  thumbnailUrl?: string;        // YouTube: img.youtube.com URL; uploads: optional custom thumb
  title: string;
  description: string;
  thumbnailColor: string;       // gradient fallback for all videos
  duration: number;             // seconds (0 = unknown, e.g. YouTube before metadata fetch)
  uploadedBy: string;
  uploadedAt: string;
  muscleGroups: MuscleGroup[];
  movementType: MovementType;
  equipment: Equipment[];
  difficulty: Difficulty;
  cues: string[];
  notes: string;                // coaching notes (text alongside video)
  trimStart: number;
  trimEnd: number;
  loop: boolean;
  status: VideoStatus;
  viewCount: number;
  linkedExercises: string[];
};

export type VideoFilter = {
  query: string;
  muscleGroup: MuscleGroup | "all";
  movementType: MovementType | "all";
  equipment: Equipment | "all";
  difficulty: Difficulty | "all";
  source: VideoSource | "all";
};

// ─── YouTube Helpers ──────────────────────────────────────────────────────────

export function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function youTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function youTubeEmbedUrl(
  videoId: string,
  opts: { loop?: boolean; start?: number; mute?: boolean } = {}
): string {
  const p = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
  });
  if (opts.loop) { p.set("loop", "1"); p.set("playlist", videoId); }
  if (opts.start) p.set("start", String(Math.round(opts.start)));
  if (opts.mute) p.set("mute", "1");
  return `https://www.youtube.com/embed/${videoId}?${p.toString()}`;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

export const VIDEO_LIBRARY: ExerciseVideo[] = [
  // ── Uploaded videos ────────────────────────────────────────────────────────
  {
    id: "vid_001",
    source: "upload",
    title: "Barbell Back Squat",
    description: "Full depth back squat with proper bar positioning and bracing cues.",
    thumbnailColor: "from-[#1a1a2e] to-[#16213e]",
    duration: 47,
    uploadedBy: "Coach Marcus",
    uploadedAt: "2026-02-14",
    muscleGroups: ["quads", "glutes", "hamstrings"],
    movementType: "squat",
    equipment: ["barbell"],
    difficulty: "intermediate",
    cues: ["Brace your core", "Chest up", "Drive through the floor", "Knees track toes"],
    notes: "",
    trimStart: 0,
    trimEnd: 0,
    loop: true,
    status: "active",
    viewCount: 312,
    linkedExercises: ["Back Squat", "High Bar Squat"],
  },
  {
    id: "vid_002",
    source: "upload",
    title: "Romanian Deadlift",
    description: "Hinge pattern focusing on hamstring stretch and hip position.",
    thumbnailColor: "from-[#1a2a1a] to-[#0d1f0d]",
    duration: 38,
    uploadedBy: "Coach Marcus",
    uploadedAt: "2026-02-18",
    muscleGroups: ["hamstrings", "glutes", "back"],
    movementType: "hinge",
    equipment: ["barbell"],
    difficulty: "intermediate",
    cues: ["Push hips back first", "Bar stays close", "Soft knee bend", "Feel the stretch"],
    notes: "Emphasise the hip hinge before showing foot setup.",
    trimStart: 2,
    trimEnd: 0,
    loop: true,
    status: "active",
    viewCount: 218,
    linkedExercises: ["Romanian Deadlift", "RDL", "Stiff Leg Deadlift"],
  },
  {
    id: "vid_003",
    source: "upload",
    title: "Dumbbell Bench Press",
    description: "Full range of motion chest press with neutral wrist alignment.",
    thumbnailColor: "from-[#2a1a1a] to-[#1f0d0d]",
    duration: 31,
    uploadedBy: "Coach Sarah",
    uploadedAt: "2026-02-20",
    muscleGroups: ["chest", "shoulders", "triceps"],
    movementType: "push",
    equipment: ["dumbbell"],
    difficulty: "beginner",
    cues: ["Retract scapula", "Elbows at 45°", "Full stretch at bottom", "Squeeze at top"],
    notes: "",
    trimStart: 0,
    trimEnd: 0,
    loop: false,
    status: "active",
    viewCount: 445,
    linkedExercises: ["DB Bench Press", "Dumbbell Press"],
  },
  {
    id: "vid_004",
    source: "upload",
    title: "Cable Lat Pulldown",
    description: "Wide-grip lat pulldown with full scapular depression.",
    thumbnailColor: "from-[#1a1a2a] to-[#0d0d1f]",
    duration: 29,
    uploadedBy: "Coach Marcus",
    uploadedAt: "2026-02-22",
    muscleGroups: ["back", "biceps"],
    movementType: "pull",
    equipment: ["cable"],
    difficulty: "beginner",
    cues: ["Lead with elbows", "Depress shoulder blades", "Control the negative", "Slight lean back"],
    notes: "",
    trimStart: 0,
    trimEnd: 0,
    loop: true,
    status: "active",
    viewCount: 389,
    linkedExercises: ["Lat Pulldown", "Wide Grip Pulldown"],
  },
  {
    id: "vid_005",
    source: "upload",
    title: "Bulgarian Split Squat",
    description: "Rear-foot elevated split squat for unilateral leg development.",
    thumbnailColor: "from-[#1f1a2a] to-[#130d1f]",
    duration: 52,
    uploadedBy: "Coach Sarah",
    uploadedAt: "2026-03-01",
    muscleGroups: ["quads", "glutes"],
    movementType: "squat",
    equipment: ["dumbbell", "bodyweight"],
    difficulty: "intermediate",
    cues: ["Torso upright", "Front shin vertical", "Don't let knee cave", "Full depth"],
    notes: "",
    trimStart: 3,
    trimEnd: 0,
    loop: true,
    status: "active",
    viewCount: 267,
    linkedExercises: ["Bulgarian Split Squat", "RFESS"],
  },
  {
    id: "vid_006",
    source: "upload",
    title: "Overhead Press",
    description: "Strict barbell press from rack with proper lockout mechanics.",
    thumbnailColor: "from-[#2a1f1a] to-[#1f1309]",
    duration: 34,
    uploadedBy: "Coach Marcus",
    uploadedAt: "2026-03-03",
    muscleGroups: ["shoulders", "triceps", "core"],
    movementType: "push",
    equipment: ["barbell"],
    difficulty: "intermediate",
    cues: ["Stack joints at lockout", "Squeeze glutes", "Bar path back over head", "Full elbow extension"],
    notes: "",
    trimStart: 0,
    trimEnd: 0,
    loop: true,
    status: "active",
    viewCount: 198,
    linkedExercises: ["Overhead Press", "OHP", "Military Press"],
  },
  {
    id: "vid_007",
    source: "upload",
    title: "Bent-Over Row",
    description: "Bilateral barbell row with elbow path and torso angle cues.",
    thumbnailColor: "from-[#0d1f1a] to-[#071a14]",
    duration: 41,
    uploadedBy: "Coach Sarah",
    uploadedAt: "2026-03-05",
    muscleGroups: ["back", "biceps", "core"],
    movementType: "pull",
    equipment: ["barbell"],
    difficulty: "intermediate",
    cues: ["Hinge to 45°", "Drive elbows to ceiling", "Control the descent", "Don't shrug"],
    notes: "",
    trimStart: 0,
    trimEnd: 0,
    loop: false,
    status: "active",
    viewCount: 234,
    linkedExercises: ["Bent Over Row", "Barbell Row"],
  },
  {
    id: "vid_008",
    source: "upload",
    title: "Kettlebell Swing",
    description: "Hip hinge power drill — not a squat. Snap at the top.",
    thumbnailColor: "from-[#1a1f0d] to-[#141a07]",
    duration: 23,
    uploadedBy: "Coach Marcus",
    uploadedAt: "2026-03-08",
    muscleGroups: ["glutes", "hamstrings", "core"],
    movementType: "hinge",
    equipment: ["kettlebell"],
    difficulty: "intermediate",
    cues: ["It's a hinge, not a squat", "Snap the hips", "Float at the top", "Brace on impact"],
    notes: "",
    trimStart: 0,
    trimEnd: 0,
    loop: true,
    status: "active",
    viewCount: 156,
    linkedExercises: ["KB Swing", "Kettlebell Swing"],
  },
  {
    id: "vid_009",
    source: "upload",
    title: "Plank Hold",
    description: "Isometric core hold with posterior pelvic tilt cue.",
    thumbnailColor: "from-[#1f1f1f] to-[#111111]",
    duration: 18,
    uploadedBy: "Coach Sarah",
    uploadedAt: "2026-03-10",
    muscleGroups: ["core"],
    movementType: "isometric",
    equipment: ["bodyweight"],
    difficulty: "beginner",
    cues: ["Posterior pelvic tilt", "Drive elbows toward feet", "Pack the neck", "Breathe"],
    notes: "",
    trimStart: 0,
    trimEnd: 0,
    loop: true,
    status: "active",
    viewCount: 89,
    linkedExercises: ["Plank", "Plank Hold", "Forearm Plank"],
  },
  {
    id: "vid_010",
    source: "upload",
    title: "Box Jump",
    description: "Plyometric box jump with proper landing mechanics.",
    thumbnailColor: "from-[#2a1a0d] to-[#1a0d07]",
    duration: 15,
    uploadedBy: "Coach Marcus",
    uploadedAt: "2026-03-12",
    muscleGroups: ["quads", "glutes", "calves"],
    movementType: "plyometric",
    equipment: ["bodyweight"],
    difficulty: "intermediate",
    cues: ["Load the hips", "Arm swing", "Soft landing", "Full hip extension"],
    notes: "",
    trimStart: 0,
    trimEnd: 0,
    loop: false,
    status: "active",
    viewCount: 142,
    linkedExercises: ["Box Jump", "Box Jump (24\")"],
  },
  {
    id: "vid_011",
    source: "upload",
    title: "Face Pull",
    description: "Cable face pull for rear delt and external rotation health.",
    thumbnailColor: "from-[#1a1a2a] to-[#0d0d20]",
    duration: 27,
    uploadedBy: "Coach Sarah",
    uploadedAt: "2026-03-15",
    muscleGroups: ["shoulders", "back"],
    movementType: "pull",
    equipment: ["cable", "bands"],
    difficulty: "beginner",
    cues: ["Pull to forehead", "External rotate at end", "Elbows high", "Control the return"],
    notes: "",
    trimStart: 0,
    trimEnd: 0,
    loop: true,
    status: "active",
    viewCount: 201,
    linkedExercises: ["Face Pull", "Band Face Pull"],
  },
  {
    id: "vid_012",
    source: "upload",
    title: "Hip Thrust",
    description: "Barbell hip thrust for glute isolation and drive.",
    thumbnailColor: "from-[#2a1a1f] to-[#1f0d14]",
    duration: 36,
    uploadedBy: "Coach Marcus",
    uploadedAt: "2026-03-18",
    muscleGroups: ["glutes", "hamstrings"],
    movementType: "hinge",
    equipment: ["barbell"],
    difficulty: "beginner",
    cues: ["Chin tuck", "Drive through heels", "Full hip extension", "Squeeze at top"],
    notes: "",
    trimStart: 1,
    trimEnd: 0,
    loop: true,
    status: "active",
    viewCount: 318,
    linkedExercises: ["Hip Thrust", "Barbell Hip Thrust", "Glute Bridge"],
  },

  // ── YouTube videos ─────────────────────────────────────────────────────────
  {
    id: "vid_yt_001",
    source: "youtube",
    youtubeData: {
      videoId: "ultYSBnFPUY",
      originalUrl: "https://www.youtube.com/watch?v=ultYSBnFPUY",
      channelName: "Jeff Nippard",
    },
    thumbnailUrl: "https://img.youtube.com/vi/ultYSBnFPUY/hqdefault.jpg",
    title: "Squat Depth — Science Explained",
    description: "Evidence-based breakdown of squat mechanics, depth, and common form mistakes.",
    thumbnailColor: "from-[#1a1a2e] to-[#0d0d20]",
    duration: 0,
    uploadedBy: "Coach Marcus",
    uploadedAt: "2026-03-20",
    muscleGroups: ["quads", "glutes", "hamstrings"],
    movementType: "squat",
    equipment: ["barbell", "bodyweight"],
    difficulty: "intermediate",
    cues: ["Hit depth", "Bar over mid-foot", "Knees out"],
    notes: "Good reference for clients who struggle to understand why depth matters. Share before squat sessions.",
    trimStart: 0,
    trimEnd: 0,
    loop: false,
    status: "active",
    viewCount: 0,
    linkedExercises: ["Back Squat", "Goblet Squat"],
  },
  {
    id: "vid_yt_002",
    source: "youtube",
    youtubeData: {
      videoId: "op9kVnSso6Q",
      originalUrl: "https://www.youtube.com/watch?v=op9kVnSso6Q",
      channelName: "Alan Thrall",
    },
    thumbnailUrl: "https://img.youtube.com/vi/op9kVnSso6Q/hqdefault.jpg",
    title: "How to Deadlift — Starting Strength",
    description: "Classic starting strength deadlift tutorial covering setup, bracing, and bar path.",
    thumbnailColor: "from-[#1a2a1a] to-[#0d1a0d]",
    duration: 0,
    uploadedBy: "Coach Marcus",
    uploadedAt: "2026-03-21",
    muscleGroups: ["back", "glutes", "hamstrings"],
    movementType: "hinge",
    equipment: ["barbell"],
    difficulty: "beginner",
    cues: ["Bar over mid-foot", "Hips hinge first", "Push the floor away", "Lockout hips and knees together"],
    notes: "Best intro deadlift video for new clients. Use this before their first session.",
    trimStart: 0,
    trimEnd: 0,
    loop: false,
    status: "active",
    viewCount: 0,
    linkedExercises: ["Conventional Deadlift", "Sumo Deadlift"],
  },
  {
    id: "vid_yt_003",
    source: "youtube",
    youtubeData: {
      videoId: "3ZFMnFMwakU",
      originalUrl: "https://www.youtube.com/watch?v=3ZFMnFMwakU",
      channelName: "Calisthenics Movement",
    },
    thumbnailUrl: "https://img.youtube.com/vi/3ZFMnFMwakU/hqdefault.jpg",
    title: "Pull-up Progression for Beginners",
    description: "Step-by-step pull-up progression from dead hang to full bodyweight pull-ups.",
    thumbnailColor: "from-[#1a1a2a] to-[#0d0d1f]",
    duration: 0,
    uploadedBy: "Coach Sarah",
    uploadedAt: "2026-03-22",
    muscleGroups: ["back", "biceps"],
    movementType: "pull",
    equipment: ["bodyweight", "bands"],
    difficulty: "beginner",
    cues: ["Dead hang first", "Scapula retraction", "Pull elbows to hips", "Full extension at bottom"],
    notes: "Assign to clients who can't yet do a pull-up. Follow the progression order.",
    trimStart: 0,
    trimEnd: 0,
    loop: false,
    status: "active",
    viewCount: 0,
    linkedExercises: ["Pull-up", "Assisted Pull-up", "Dead Hang"],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function filterVideos(videos: ExerciseVideo[], filter: VideoFilter): ExerciseVideo[] {
  return videos.filter((v) => {
    if (filter.query) {
      const q = filter.query.toLowerCase();
      const match =
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.linkedExercises.some((e) => e.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (filter.source !== "all" && v.source !== filter.source) return false;
    if (filter.muscleGroup !== "all" && !v.muscleGroups.includes(filter.muscleGroup)) return false;
    if (filter.movementType !== "all" && v.movementType !== filter.movementType) return false;
    if (filter.equipment !== "all" && !v.equipment.includes(filter.equipment)) return false;
    if (filter.difficulty !== "all" && v.difficulty !== filter.difficulty) return false;
    return true;
  });
}

export function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
}

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest", back: "Back", shoulders: "Shoulders", biceps: "Biceps",
  triceps: "Triceps", quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes",
  calves: "Calves", core: "Core", full_body: "Full Body",
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  push: "Push", pull: "Pull", hinge: "Hinge", squat: "Squat",
  carry: "Carry", rotation: "Rotation", isometric: "Isometric", plyometric: "Plyometric",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: "Barbell", dumbbell: "Dumbbell", cable: "Cable", machine: "Machine",
  bodyweight: "Bodyweight", kettlebell: "Kettlebell", bands: "Bands", smith: "Smith Machine",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced",
};
