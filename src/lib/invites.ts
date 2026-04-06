// ─── Invite system ────────────────────────────────────────────────────────────
// localStorage adapter — replace with POST /api/invites in production.
// Tokens are non-guessable (crypto.randomUUID). Invites expire after 7 days.

const INVITES_KEY  = "flowstate-invites";
const EXPIRE_MS    = 7 * 24 * 60 * 60 * 1000; // 7 days

export type InviteStatus = "pending" | "sent" | "accepted" | "expired" | "revoked";

export type Invite = {
  inviteId:          string;
  inviteToken:       string;
  inviteEmail:       string;
  firstName:         string;
  lastName:          string;
  message:           string;
  invitedByUserId:   string;
  invitedByName:     string;
  assignedTrainerId: string;
  assignedTrainerName: string;
  inviteStatus:      InviteStatus;
  invitedAt:         string;   // ISO
  acceptedAt:        string | null;
  expiresAt:         string;   // ISO
};

export type CreateInviteInput = {
  firstName:         string;
  lastName:          string;
  inviteEmail:       string;
  message:           string;
  invitedByUserId:   string;
  invitedByName:     string;
  assignedTrainerId: string;
  assignedTrainerName: string;
};

// ── Storage helpers ───────────────────────────────────────────────────────────

function loadInvites(): Invite[] {
  try {
    const raw = localStorage.getItem(INVITES_KEY);
    return raw ? (JSON.parse(raw) as Invite[]) : [];
  } catch { return []; }
}

function saveInvites(invites: Invite[]): void {
  try { localStorage.setItem(INVITES_KEY, JSON.stringify(invites)); } catch { /* ignore */ }
}

// ── Token generation ──────────────────────────────────────────────────────────

function generateToken(): string {
  // crypto.randomUUID is available in all modern browsers and Node 18+
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  // Fallback for older environments
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createInvite(input: CreateInviteInput): Invite {
  const now     = new Date();
  const expires = new Date(now.getTime() + EXPIRE_MS);
  const invite: Invite = {
    inviteId:           `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    inviteToken:        generateToken(),
    inviteEmail:        input.inviteEmail.trim().toLowerCase(),
    firstName:          input.firstName.trim(),
    lastName:           input.lastName.trim(),
    message:            input.message.trim(),
    invitedByUserId:    input.invitedByUserId,
    invitedByName:      input.invitedByName,
    assignedTrainerId:  input.assignedTrainerId,
    assignedTrainerName: input.assignedTrainerName,
    inviteStatus:       "pending",
    invitedAt:          now.toISOString(),
    acceptedAt:         null,
    expiresAt:          expires.toISOString(),
  };
  const invites = loadInvites();
  invites.push(invite);
  saveInvites(invites);
  return invite;
}

export function getAllInvites(): Invite[] {
  return loadInvites();
}

export function getInvitesByTrainer(trainerId: string): Invite[] {
  return loadInvites().filter((i) => i.assignedTrainerId === trainerId || i.invitedByUserId === trainerId);
}

export function getInviteByToken(token: string): Invite | null {
  return loadInvites().find((i) => i.inviteToken === token) ?? null;
}

/** Check if an invite token is valid for acceptance. */
export function isInviteValid(invite: Invite): { valid: boolean; reason?: string } {
  if (invite.inviteStatus === "accepted") return { valid: false, reason: "This invite has already been used." };
  if (invite.inviteStatus === "revoked")  return { valid: false, reason: "This invite has been revoked." };
  if (new Date() > new Date(invite.expiresAt)) {
    // Auto-mark expired
    updateInviteStatus(invite.inviteToken, "expired");
    return { valid: false, reason: "This invite has expired." };
  }
  return { valid: true };
}

export function updateInviteStatus(token: string, status: InviteStatus, acceptedAt?: string): void {
  const invites = loadInvites();
  const idx = invites.findIndex((i) => i.inviteToken === token);
  if (idx === -1) return;
  invites[idx] = {
    ...invites[idx],
    inviteStatus: status,
    acceptedAt: acceptedAt ?? invites[idx].acceptedAt,
  };
  saveInvites(invites);
}

export function acceptInvite(token: string): void {
  updateInviteStatus(token, "accepted", new Date().toISOString());
}

export function revokeInvite(inviteId: string): void {
  const invites = loadInvites();
  const invite  = invites.find((i) => i.inviteId === inviteId);
  if (!invite) return;
  updateInviteStatus(invite.inviteToken, "revoked");
}

/** Generates the invite URL for sharing */
export function getInviteUrl(token: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/invite/${token}`;
  }
  return `/invite/${token}`;
}
