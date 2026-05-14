// POST /api/admin/invites  — create an invite (admin only)
// GET  /api/admin/invites  — list all invites the admin created
//
// Body (POST):
//   {
//     role: "member" | "client",
//     email?: string,           // optional — null for open links
//     firstName?: string,
//     lastName?: string,
//     trainerId?: string,       // pre-assign to a trainer
//     trainerName?: string,
//     message?: string,
//   }
//
// Returns: { invite: Invite, url: string }

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";

const EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;

function generateToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}

type Body = {
  role?:        unknown;
  email?:       unknown;
  firstName?:   unknown;
  lastName?:    unknown;
  trainerId?:   unknown;
  trainerName?: unknown;
  message?:     unknown;
};

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin, user } = auth;

  let body: Body;
  try { body = (await req.json()) as Body; } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const role = body.role === "member" ? "member" : "client";
  const email     = typeof body.email === "string"     ? body.email.trim().toLowerCase() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName  = typeof body.lastName === "string"  ? body.lastName.trim()  : "";
  const message   = typeof body.message === "string"   ? body.message.trim()   : "";
  const trainerId = typeof body.trainerId === "string"   ? body.trainerId   : "";
  const trainerName = typeof body.trainerName === "string" ? body.trainerName : "";

  const token = generateToken();
  const expires = new Date(Date.now() + EXPIRE_MS).toISOString();

  // Look up the admin's display name for `invited_by_name`
  const { data: actor } = await admin
    .from("profiles")
    .select("full_name,email")
    .eq("id", user.id)
    .maybeSingle();
  type ActorRow = { full_name: string | null; email: string | null };
  const actorRow = (actor as ActorRow | null) ?? null;
  const invitedByName = actorRow?.full_name ?? actorRow?.email ?? "Admin";

  const { data, error } = await admin
    .from("invites")
    .insert({
      invite_token:          token,
      invite_type:           email ? "direct" : "open",
      invite_role:           role,
      invite_email:          email || null,
      first_name:            firstName || null,
      last_name:             lastName  || null,
      invited_by_user_id:    user.id,
      invited_by_name:       invitedByName,
      assigned_trainer_id:   trainerId || null,
      assigned_trainer_name: trainerName || null,
      invite_status:         "pending",
      invite_message:        message || null,
      expires_at:            expires,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const url = `${origin}/invite/${token}`;

  return NextResponse.json({ invite: data, url });
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth;

  const { data, error } = await admin
    .from("invites")
    .select("*")
    .order("invited_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ invites: data ?? [] });
}
