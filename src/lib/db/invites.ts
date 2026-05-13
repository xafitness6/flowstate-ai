// ─── Invites — Supabase-backed ────────────────────────────────────────────────

import { createClient } from "@/lib/supabase/client";
import type { Invite } from "@/lib/supabase/types";

const EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;

function generateToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

export async function createInviteInDB(input: {
  firstName:           string;
  lastName:            string;
  inviteEmail:         string;
  message:             string;
  invitedByUserId:     string;
  invitedByName:       string;
  assignedTrainerId:   string;
  assignedTrainerName: string;
  inviteType?:         "direct" | "open";
  inviteToken?:        string;
}): Promise<Invite | null> {
  const supabase = createClient();
  const expires  = new Date(Date.now() + EXPIRE_MS).toISOString();

  const { data, error } = await supabase
    .from("invites")
    .insert({
      invite_token:          input.inviteToken ?? generateToken(),
      invite_type:           input.inviteType ?? "direct",
      invite_email:          input.inviteEmail.trim().toLowerCase() || null,
      first_name:            input.firstName.trim() || null,
      last_name:             input.lastName.trim() || null,
      invited_by_user_id:    input.invitedByUserId,
      invited_by_name:       input.invitedByName,
      assigned_trainer_id:   input.assignedTrainerId || null,
      assigned_trainer_name: input.assignedTrainerName || null,
      invite_status:         "pending",
      invite_message:        input.message.trim() || null,
      expires_at:            expires,
    })
    .select()
    .single();

  if (error) { console.error("[invites] create:", error.message); return null; }
  return data as Invite;
}

export async function getInvitesByTrainerFromDB(trainerId: string): Promise<Invite[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invites")
    .select("*")
    .or(`assigned_trainer_id.eq.${trainerId},invited_by_user_id.eq.${trainerId}`)
    .order("invited_at", { ascending: false });
  if (error) { console.error("[invites] getByTrainer:", error.message); return []; }
  return (data ?? []) as Invite[];
}

export async function getInviteByTokenFromDB(token: string): Promise<Invite | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invites")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();
  if (error) return null;
  return data as Invite | null;
}

export async function updateInviteStatusInDB(
  token: string,
  status: Invite["invite_status"],
  acceptedByUserId?: string,
): Promise<void> {
  const supabase = createClient();
  const update: Partial<Invite> = { invite_status: status };
  if (status === "accepted") {
    update.accepted_at = new Date().toISOString();
    if (acceptedByUserId) update.accepted_by_user_id = acceptedByUserId;
  }
  const { error } = await supabase
    .from("invites")
    .update(update)
    .eq("invite_token", token);
  if (error) console.error("[invites] updateStatus:", error.message);
}

export async function getOpenLeadsFromDB(trainerId: string): Promise<Invite[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invites")
    .select("*")
    .eq("assigned_trainer_id", trainerId)
    .eq("invite_type", "open")
    .order("invited_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as Invite[];
}
