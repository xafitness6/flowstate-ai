import { createHmac, randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient<any>;

export type PasswordTokenPurpose = "reset" | "invite" | "temp";

export type PasswordTokenRow = {
  id: string;
  user_id: string;
  email: string;
  token_hash: string;
  purpose: PasswordTokenPurpose;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

type ProfileLookupRow = {
  id: string;
  email: string;
  archived_at?: string | null;
};

const RESET_CODE_TTL_MS = 10 * 60 * 1000;

export function normalizeResetEmail(email: string): string {
  return email.trim().toLowerCase();
}

function resetCodeSecret(): string {
  return (
    process.env.PASSWORD_RESET_CODE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "flowstate-dev-reset-code-secret"
  );
}

export function generatePasswordResetCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashPasswordResetCode(email: string, code: string): string {
  return createHmac("sha256", resetCodeSecret())
    .update(`${normalizeResetEmail(email)}:${code.trim()}`, "utf8")
    .digest("hex");
}

export function passwordTokenExpiresAt(ttlMs = RESET_CODE_TTL_MS): string {
  return new Date(Date.now() + ttlMs).toISOString();
}

export async function findPasswordResetUser(admin: AdminClient, email: string) {
  const normalized = normalizeResetEmail(email);
  const { data, error } = await admin
    .from("profiles")
    .select("id,email,archived_at")
    .ilike("email", normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const row = data as ProfileLookupRow | null;
  if (!row || row.archived_at) return null;
  return row;
}

export async function createPasswordResetCode(args: {
  admin: AdminClient;
  userId: string;
  email: string;
  purpose?: PasswordTokenPurpose;
}) {
  const code = generatePasswordResetCode();
  const tokenHash = hashPasswordResetCode(args.email, code);
  const expiresAt = passwordTokenExpiresAt();

  const { data, error } = await args.admin
    .from("auth_password_tokens")
    .insert({
      user_id: args.userId,
      email: normalizeResetEmail(args.email),
      token_hash: tokenHash,
      purpose: args.purpose ?? "reset",
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return { code, row: data as PasswordTokenRow };
}

export async function getPasswordResetCode(args: {
  admin: AdminClient;
  email: string;
  code: string;
}) {
  const { data, error } = await args.admin
    .from("auth_password_tokens")
    .select("*")
    .eq("token_hash", hashPasswordResetCode(args.email, args.code))
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as PasswordTokenRow | null;
}

export function validatePasswordToken(row: PasswordTokenRow | null): string | null {
  if (!row) return "This reset code is invalid or has expired.";
  if (row.used_at) return "This reset code has already been used. Request a fresh code.";
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return "This reset code has expired. Request a fresh code.";
  }
  return null;
}

export async function markPasswordTokenUsed(admin: AdminClient, tokenRowId: string) {
  const { error } = await admin
    .from("auth_password_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenRowId);
  if (error) throw new Error(error.message);
}

export async function updateAuthPassword(args: {
  admin: AdminClient;
  userId: string;
  password: string;
}) {
  const { error } = await args.admin.auth.admin.updateUserById(args.userId, {
    password: args.password,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
}
