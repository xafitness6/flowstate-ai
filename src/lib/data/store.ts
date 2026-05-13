// ─── Platform Data Store ──────────────────────────────────────────────────────
// Single source of truth for all platform users, trainer metrics, client
// training data, and programs.
//
// localStorage-backed with seed data on first load.
// All functions must be called client-side only.
//
// Access helpers enforce role + ownership — throw PermissionError on violation.
// API routes mirror these checks server-side for double enforcement.

import type { Plan } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = "member" | "client" | "trainer" | "master";
export type UserStatus = "active" | "at-risk" | "churned" | "trial" | "paused";

export type PlatformUser = {
  id:         string;
  name:       string;
  email:      string;
  role:       UserRole;
  plan:       Plan;
  status:     UserStatus;
  lastActive: string;
  joinDate:   string;
  trainerId?: string;   // clients only: their assigned trainer's user id
};

// Stored performance stats for a trainer — everything that can't be derived.
export type TrainerStoredMetrics = {
  avgResponseTime: string;
  responseMinutes: number;
  messageCount:    number;
  feedbackScore:   number;
  upgradeCount:    number;
  revenueGenerated: number;
  overdueReviews:  number;
  adherenceTrend:  number[];
  retentionTrend:  number[];
};

// Full trainer metrics — stored fields + derived counts.
export type TrainerMetrics = TrainerStoredMetrics & {
  totalClients:         number;
  activeClients:        number;
  pausedClients:        number;
  churnedClients:       number;
  atRiskClients:        number;
  retentionRate:        number;
  avgAdherence:         number;
  avgExecutionScore:    number;
  avgCheckInCompletion: number;
  programAssignments:   number;
  activeProgramCount:   number;
};

// Training-specific data stored per client (not derivable from PlatformUser).
export type ClientTrainingData = {
  program:           string;
  adherence:         number;
  executionScore:    number;
  checkInCompletion: number;
};

export type PlatformProgram = {
  id:          string;
  name:        string;
  phase:       string;
  weeks:       number;
  daysPerWeek: number;
  goal:        "strength" | "hypertrophy" | "fat_loss";
  exercises:   number;
  description: string;
  lastUsed?:   string;
};

export class PermissionError extends Error {
  status = 403;
  constructor(msg = "Unauthorized") { super(msg); this.name = "PermissionError"; }
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEY_USERS   = "flowstate-platform-users";
const KEY_SEEDED  = "flowstate-platform-seeded-v2";

function demoSeedEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ENABLE_DEMO_SEED === "true") return true;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

// ─── Seed data ────────────────────────────────────────────────────────────────
// Canonical user list. "foundation" = the free/entry tier.
// trainerId links clients to their trainer.

const SEED_USERS: PlatformUser[] = [
  { id: "u1",  name: "Kai Nakamura",  email: "kai@domain.com",    role: "client",  plan: "performance", status: "active",   lastActive: "2m ago",   trainerId: "u4", joinDate: "Jan 2025" },
  { id: "u2",  name: "Priya Sharma",  email: "priya@domain.com",  role: "client",  plan: "performance", status: "active",   lastActive: "14m ago",  trainerId: "u4", joinDate: "Feb 2025" },
  { id: "u3",  name: "Marcus Webb",   email: "marcus@domain.com", role: "trainer", plan: "training",    status: "active",   lastActive: "1h ago",                   joinDate: "Nov 2024" },
  { id: "u4",  name: "Alex Rivera",   email: "alex@domain.com",   role: "trainer", plan: "coaching",    status: "active",   lastActive: "3h ago",                   joinDate: "Oct 2024" },
  { id: "u5",  name: "Anya Patel",    email: "anya@domain.com",   role: "client",  plan: "training",    status: "at-risk",  lastActive: "4d ago",   trainerId: "u3", joinDate: "Mar 2025" },
  { id: "u6",  name: "Luca Ferretti", email: "luca@domain.com",   role: "member",  plan: "training",    status: "active",   lastActive: "6h ago",                   joinDate: "Dec 2024" },
  { id: "u7",  name: "Sofia Reyes",   email: "sofia@domain.com",  role: "client",  plan: "performance", status: "active",   lastActive: "22h ago",  trainerId: "u4", joinDate: "Feb 2025" },
  { id: "u8",  name: "Dmitri Volkov", email: "dmitri@domain.com", role: "member",  plan: "foundation",  status: "trial",    lastActive: "1d ago",                   joinDate: "Mar 2025" },
  { id: "u9",  name: "Hana Suzuki",   email: "hana@domain.com",   role: "client",  plan: "training",    status: "paused",   lastActive: "8d ago",   trainerId: "u3", joinDate: "Jan 2025" },
  { id: "u10", name: "Omar Hassan",   email: "omar@domain.com",   role: "member",  plan: "training",    status: "active",   lastActive: "2d ago",                   joinDate: "Feb 2025" },
  { id: "u11", name: "Claire Dubois", email: "claire@domain.com", role: "client",  plan: "performance", status: "at-risk",  lastActive: "5d ago",   trainerId: "u4",      joinDate: "Dec 2024" },
  { id: "u12", name: "Ravi Menon",    email: "ravi@domain.com",   role: "member",  plan: "foundation",  status: "churned",  lastActive: "21d ago",                        joinDate: "Nov 2024" },
  // Master's personally assigned clients (trainerId === master's user id)
  { id: "u13", name: "Jordan Blake",  email: "jordan@domain.com", role: "client",  plan: "coaching",    status: "active",   lastActive: "1h ago",   trainerId: "usr_001", joinDate: "Jan 2026" },
  { id: "u14", name: "Mia Chen",      email: "mia@domain.com",    role: "client",  plan: "training",    status: "at-risk",  lastActive: "3d ago",   trainerId: "usr_001", joinDate: "Feb 2026" },
  { id: "u15", name: "Tyler Ross",    email: "tyler@domain.com",  role: "client",  plan: "performance", status: "active",   lastActive: "5h ago",   trainerId: "usr_001", joinDate: "Mar 2026" },
];

// Stored metrics per trainer — performance data that has no computable source.
const SEED_TRAINER_METRICS: Record<string, TrainerStoredMetrics> = {
  u4: {
    avgResponseTime:  "< 1h",
    responseMinutes:  45,
    messageCount:     142,
    feedbackScore:    4.8,
    upgradeCount:     2,
    revenueGenerated: 4200,
    overdueReviews:   0,
    adherenceTrend:   [78, 80, 82, 84, 85, 86, 87],
    retentionTrend:   [75, 78, 80, 80, 82, 83, 83],
  },
  u3: {
    avgResponseTime:  "3–5h",
    responseMinutes:  240,
    messageCount:     67,
    feedbackScore:    3.9,
    upgradeCount:     0,
    revenueGenerated: 1800,
    overdueReviews:   2,
    adherenceTrend:   [80, 77, 75, 72, 74, 73, 74],
    retentionTrend:   [82, 80, 78, 74, 72, 71, 71],
  },
};

// Training-specific data per client (adherence, program, etc.).
const SEED_CLIENT_DATA: Record<string, ClientTrainingData> = {
  u1:  { program: "Hypertrophy Block 3",  adherence: 91, executionScore: 88, checkInCompletion: 95 },
  u2:  { program: "Strength Foundation",  adherence: 88, executionScore: 84, checkInCompletion: 92 },
  u5:  { program: "General Fitness Block", adherence: 61, executionScore: 60, checkInCompletion: 70 },
  u7:  { program: "Athletic Performance", adherence: 85, executionScore: 80, checkInCompletion: 90 },
  u9:  { program: "Unassigned",           adherence: 0,  executionScore: 0,  checkInCompletion: 55 },
  u11: { program: "Strength Foundation",  adherence: 62, executionScore: 58, checkInCompletion: 68 },
  u13: { program: "Strength Phase 2",     adherence: 90, executionScore: 87, checkInCompletion: 93 },
  u14: { program: "Fat Loss Circuit",     adherence: 58, executionScore: 55, checkInCompletion: 65 },
  u15: { program: "Athletic Performance", adherence: 83, executionScore: 79, checkInCompletion: 88 },
};

const SEED_PROGRAMS: PlatformProgram[] = [
  {
    id: "p1", name: "Upper / Lower Split", phase: "Phase 1 — Foundation",
    weeks: 8, daysPerWeek: 4, goal: "hypertrophy", exercises: 6,
    description: "4-day upper/lower structure focused on progressive overload. Best for intermediate lifters building volume base.",
    lastUsed: "2 days ago",
  },
  {
    id: "p2", name: "Push / Pull / Legs", phase: "Phase 2 — Volume",
    weeks: 6, daysPerWeek: 6, goal: "hypertrophy", exercises: 7,
    description: "High-frequency 6-day PPL designed for advanced clients with strong recovery capacity.",
    lastUsed: "1 week ago",
  },
  {
    id: "p3", name: "5/3/1 Strength Block", phase: "Phase 1 — Strength",
    weeks: 4, daysPerWeek: 4, goal: "strength", exercises: 4,
    description: "Wendler 5/3/1 periodization. Four main lifts, minimal accessories. Best for strength-focused athletes.",
    lastUsed: "3 days ago",
  },
  {
    id: "p4", name: "Fat Loss Circuit", phase: "Phase 1 — Conditioning",
    weeks: 8, daysPerWeek: 3, goal: "fat_loss", exercises: 8,
    description: "Metabolic conditioning circuit with supersets. High work density, moderate load.",
  },
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

export function loadUsers(): PlatformUser[] {
  if (!demoSeedEnabled()) return [];
  try {
    const raw = localStorage.getItem(KEY_USERS);
    if (raw) return JSON.parse(raw) as PlatformUser[];
  } catch { /* ignore */ }
  return [];
}

function saveUsers(users: PlatformUser[]): void {
  if (!demoSeedEnabled()) return;
  try { localStorage.setItem(KEY_USERS, JSON.stringify(users)); } catch { /* ignore */ }
}

// ─── Initialise ───────────────────────────────────────────────────────────────

/**
 * Seed the store with default data on first load.
 * Call this once from a client component on mount.
 */
export function initStore(): void {
  try {
    if (!demoSeedEnabled()) {
      if (localStorage.getItem(KEY_SEEDED)) {
        localStorage.removeItem(KEY_USERS);
        localStorage.removeItem(KEY_SEEDED);
      }
      return;
    }
    if (localStorage.getItem(KEY_SEEDED)) return;
    saveUsers(SEED_USERS);
    localStorage.setItem(KEY_SEEDED, "1");
  } catch { /* ignore */ }
}

/**
 * Wipe all platform data and re-seed. Used by the dev reset tool.
 */
export function resetStore(): void {
  try {
    localStorage.removeItem(KEY_USERS);
    localStorage.removeItem(KEY_SEEDED);
    initStore();
  } catch { /* ignore */ }
}

// ─── Read queries ─────────────────────────────────────────────────────────────

/**
 * All users — master only.
 */
export function getUsers(actorRole: string): PlatformUser[] {
  if (actorRole !== "master") throw new PermissionError("getUsers requires master role");
  return loadUsers();
}

/**
 * All trainers.
 * master → all trainers
 * trainer → only themselves (their own record)
 */
export function getTrainers(actorRole: string, actorId: string): PlatformUser[] {
  const users = loadUsers();
  const trainers = users.filter((u) => u.role === "trainer");
  if (actorRole === "master") return trainers;
  if (actorRole === "trainer") return trainers.filter((t) => t.id === actorId);
  throw new PermissionError("getTrainers: insufficient role");
}

/**
 * All clients visible to the actor.
 * master → all clients
 * trainer → only their assigned clients (trainerId === actorId)
 */
export function getClients(actorRole: string, actorId: string): PlatformUser[] {
  const users = loadUsers();
  const clients = users.filter((u) => u.role === "client");
  if (actorRole === "master") return clients;
  if (actorRole === "trainer") return clients.filter((c) => c.trainerId === actorId);
  throw new PermissionError("getClients: insufficient role");
}

/**
 * Clients personally assigned to the actor (trainerId === actorId).
 * Works the same for both trainer and master — master's "My Clients" view
 * is separate from the platform-wide all-clients view.
 */
export function getMyClients(actorRole: string, actorId: string): PlatformUser[] {
  if (actorRole !== "trainer" && actorRole !== "master") {
    throw new PermissionError("getMyClients: insufficient role");
  }
  const users = loadUsers();
  return users.filter((u) => u.role === "client" && u.trainerId === actorId);
}

/**
 * Get training-specific data for a client.
 * Falls back to defaults if not seeded.
 */
export function getClientTrainingData(clientId: string): ClientTrainingData {
  if (!demoSeedEnabled()) {
    return {
      program: "Unassigned",
      adherence: 0,
      executionScore: 0,
      checkInCompletion: 0,
    };
  }
  return SEED_CLIENT_DATA[clientId] ?? {
    program: "Unassigned",
    adherence: 0,
    executionScore: 0,
    checkInCompletion: 0,
  };
}

/**
 * Compute full trainer metrics by deriving counts from user list
 * and merging stored performance data.
 */
export function getTrainerMetrics(trainerId: string): TrainerMetrics | null {
  const users    = loadUsers();
  const stored   = SEED_TRAINER_METRICS[trainerId];
  if (!stored) return null;

  const clients  = users.filter((u) => u.role === "client" && u.trainerId === trainerId);
  const active   = clients.filter((c) => c.status === "active").length;
  const paused   = clients.filter((c) => c.status === "paused").length;
  const churned  = clients.filter((c) => c.status === "churned").length;
  const atRisk   = clients.filter((c) => c.status === "at-risk").length;
  const total    = clients.length;

  // Retention = active / (active + churned), avoid div-by-zero
  const retention = total > 0 ? Math.round((active / (active + churned || 1)) * 100) : 0;

  // Averages derived from client training data
  const activeClients = clients.filter((c) => c.status === "active" || c.status === "at-risk");
  const avgAdherence = activeClients.length > 0
    ? Math.round(activeClients.reduce((s, c) => s + (getClientTrainingData(c.id).adherence), 0) / activeClients.length)
    : 0;
  const avgExecution = activeClients.length > 0
    ? Math.round(activeClients.reduce((s, c) => s + (getClientTrainingData(c.id).executionScore), 0) / activeClients.length)
    : 0;
  const avgCheckIn = activeClients.length > 0
    ? Math.round(activeClients.reduce((s, c) => s + (getClientTrainingData(c.id).checkInCompletion), 0) / activeClients.length)
    : 0;

  return {
    ...stored,
    totalClients:         total,
    activeClients:        active,
    pausedClients:        paused,
    churnedClients:       churned,
    atRiskClients:        atRisk,
    retentionRate:        retention,
    avgAdherence,
    avgExecutionScore:    avgExecution,
    avgCheckInCompletion: avgCheckIn,
    programAssignments:   clients.filter((c) => getClientTrainingData(c.id).program !== "Unassigned").length,
    activeProgramCount:   active,
  };
}

/**
 * All programs — any authenticated user.
 */
export function getPrograms(): PlatformProgram[] {
  if (!demoSeedEnabled()) return [];
  return SEED_PROGRAMS;
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Delete a user.
 *
 * master  → can delete any non-master user
 * trainer → can delete only their own assigned clients
 * others  → PermissionError
 *
 * NOTE: In production, actorRole and actorId come from a verified JWT session,
 * not from the request body. The API route mirrors this validation server-side.
 */
export function deleteUser(
  targetId:  string,
  actorRole: string,
  actorId:   string,
): void {
  const users  = loadUsers();
  const target = users.find((u) => u.id === targetId);
  if (!target) return; // already gone — idempotent

  if (actorRole === "master") {
    if (target.role === "master") throw new PermissionError("Cannot delete a master account");
    saveUsers(users.filter((u) => u.id !== targetId));
    return;
  }

  if (actorRole === "trainer") {
    if (target.role !== "client") throw new PermissionError("Trainers can only delete clients");
    if (target.trainerId !== actorId) throw new PermissionError("Trainer can only delete their own clients");
    saveUsers(users.filter((u) => u.id !== targetId));
    return;
  }

  throw new PermissionError("Insufficient role to delete users");
}

/**
 * Create a trainer. Master only.
 */
export function createTrainer(
  data: Omit<PlatformUser, "role">,
  actorRole: string,
): PlatformUser {
  if (actorRole !== "master") throw new PermissionError("Only master can create trainers");
  const users = loadUsers();
  const trainer: PlatformUser = { ...data, role: "trainer" };
  saveUsers([...users, trainer]);
  return trainer;
}

/**
 * Delete a trainer. Master only.
 * Also unassigns all of their clients (sets trainerId = undefined).
 */
export function deleteTrainer(
  trainerId: string,
  actorRole: string,
): void {
  if (actorRole !== "master") throw new PermissionError("Only master can delete trainers");
  const users = loadUsers();
  const target = users.find((u) => u.id === trainerId);
  if (!target) return;
  if (target.role !== "trainer") throw new PermissionError("Target is not a trainer");

  // Unassign clients
  const updated = users
    .filter((u) => u.id !== trainerId)
    .map((u) => u.trainerId === trainerId ? { ...u, trainerId: undefined } : u);
  saveUsers(updated);
}
