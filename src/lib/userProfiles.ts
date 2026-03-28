import type { Role } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserSnapshot = {
  id: string;
  adherence: number;          // 0–100 %
  currentGoal: string;
  currentStatus: string;      // short descriptive phrase
  streak: number;             // training streak in days
  metrics: { label: string; value: string }[];
};

export type SnapshotUser = {
  id: string;
  name: string;
  email?: string;
  role: "member" | "client" | "trainer" | "master";
  plan?: "free" | "pro" | "elite";
  status?: string;
};

// ─── Trainer → client assignments ────────────────────────────────────────────

// Keys are trainer names; values are user IDs of their assigned clients.
export const TRAINER_ASSIGNMENTS: Record<string, string[]> = {
  "Jordan Lee":  ["u1", "u2", "u7", "u11"],
  "Marcus Webb": ["u5", "u9"],
};

// ─── Snapshot data (system-controlled, not user-editable) ────────────────────

export const USER_SNAPSHOTS: Record<string, UserSnapshot> = {
  u1: {
    id: "u1",
    adherence: 91,
    currentGoal: "Body recomposition",
    currentStatus: "On track",
    streak: 12,
    metrics: [
      { label: "Workouts",    value: "4 / wk" },
      { label: "Avg steps",   value: "9.2k"   },
      { label: "Sleep avg",   value: "7.4 h"  },
      { label: "Consistency", value: "91%"    },
    ],
  },
  u2: {
    id: "u2",
    adherence: 83,
    currentGoal: "Strength phase",
    currentStatus: "On track",
    streak: 8,
    metrics: [
      { label: "Workouts",    value: "3 / wk" },
      { label: "Avg steps",   value: "8.1k"   },
      { label: "Sleep avg",   value: "7.1 h"  },
      { label: "Consistency", value: "83%"    },
    ],
  },
  u3: {
    id: "u3",
    adherence: 78,
    currentGoal: "Maintain + coaching",
    currentStatus: "Active",
    streak: 21,
    metrics: [
      { label: "Clients",     value: "2"      },
      { label: "Avg steps",   value: "7.8k"   },
      { label: "Sleep avg",   value: "6.9 h"  },
      { label: "Consistency", value: "78%"    },
    ],
  },
  u4: {
    id: "u4",
    adherence: 86,
    currentGoal: "Lean bulk",
    currentStatus: "Strong week",
    streak: 15,
    metrics: [
      { label: "Clients",     value: "4"      },
      { label: "Avg steps",   value: "8.5k"   },
      { label: "Sleep avg",   value: "7.6 h"  },
      { label: "Consistency", value: "86%"    },
    ],
  },
  u5: {
    id: "u5",
    adherence: 44,
    currentGoal: "Weight loss",
    currentStatus: "Falling off",
    streak: 0,
    metrics: [
      { label: "Workouts",    value: "1 / wk" },
      { label: "Avg steps",   value: "4.2k"   },
      { label: "Sleep avg",   value: "6.1 h"  },
      { label: "Consistency", value: "44%"    },
    ],
  },
  u6: {
    id: "u6",
    adherence: 72,
    currentGoal: "General fitness",
    currentStatus: "Steady",
    streak: 5,
    metrics: [
      { label: "Workouts",    value: "3 / wk" },
      { label: "Avg steps",   value: "7.5k"   },
      { label: "Sleep avg",   value: "7.0 h"  },
      { label: "Consistency", value: "72%"    },
    ],
  },
  u7: {
    id: "u7",
    adherence: 88,
    currentGoal: "Performance",
    currentStatus: "On track",
    streak: 9,
    metrics: [
      { label: "Workouts",    value: "4 / wk" },
      { label: "Avg steps",   value: "8.8k"   },
      { label: "Sleep avg",   value: "7.8 h"  },
      { label: "Consistency", value: "88%"    },
    ],
  },
  u8: {
    id: "u8",
    adherence: 58,
    currentGoal: "Explore platform",
    currentStatus: "Trial user",
    streak: 2,
    metrics: [
      { label: "Workouts",    value: "2 / wk" },
      { label: "Avg steps",   value: "6.1k"   },
      { label: "Sleep avg",   value: "6.5 h"  },
      { label: "Consistency", value: "58%"    },
    ],
  },
  u9: {
    id: "u9",
    adherence: 31,
    currentGoal: "Injury recovery",
    currentStatus: "Paused",
    streak: 0,
    metrics: [
      { label: "Workouts",    value: "0 / wk" },
      { label: "Avg steps",   value: "2.8k"   },
      { label: "Sleep avg",   value: "7.2 h"  },
      { label: "Consistency", value: "31%"    },
    ],
  },
  u10: {
    id: "u10",
    adherence: 65,
    currentGoal: "Build habits",
    currentStatus: "Progressing",
    streak: 4,
    metrics: [
      { label: "Workouts",    value: "2 / wk" },
      { label: "Avg steps",   value: "7.0k"   },
      { label: "Sleep avg",   value: "6.8 h"  },
      { label: "Consistency", value: "65%"    },
    ],
  },
  u11: {
    id: "u11",
    adherence: 42,
    currentGoal: "Fat loss",
    currentStatus: "At risk",
    streak: 0,
    metrics: [
      { label: "Workouts",    value: "1 / wk" },
      { label: "Avg steps",   value: "4.5k"   },
      { label: "Sleep avg",   value: "5.9 h"  },
      { label: "Consistency", value: "42%"    },
    ],
  },
  u12: {
    id: "u12",
    adherence: 12,
    currentGoal: "Get started",
    currentStatus: "Churned",
    streak: 0,
    metrics: [
      { label: "Workouts",    value: "0 / wk" },
      { label: "Avg steps",   value: "3.1k"   },
      { label: "Sleep avg",   value: "—"       },
      { label: "Consistency", value: "12%"    },
    ],
  },
};

// ─── Access helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if the viewer is allowed to see a progress snapshot for targetId.
 * - master: always
 * - trainer: only their assigned clients
 * - client / member: never for other users
 */
export function canViewSnapshot(
  viewerRole: Role,
  viewerName: string,
  targetId: string,
): boolean {
  if (viewerRole === "master") return true;
  if (viewerRole === "trainer") {
    const assigned = TRAINER_ASSIGNMENTS[viewerName] ?? [];
    return assigned.includes(targetId);
  }
  return false;
}

/**
 * Returns true if the viewer may open the full profile page for targetId.
 * Same rules as snapshot access for now.
 */
export function canViewProfile(
  viewerRole: Role,
  viewerName: string,
  targetId: string,
  viewerId: string,
): boolean {
  if (viewerId === targetId) return true; // always see own profile
  return canViewSnapshot(viewerRole, viewerName, targetId);
}

/** Adherence colour class */
export function adherenceColor(pct: number): string {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 60) return "text-[#B48B40]";
  return "text-[#F87171]/80";
}
