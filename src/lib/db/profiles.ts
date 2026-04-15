// ─── Profile data layer ───────────────────────────────────────────────────────
// Always import createClient from the browser client in Client Components.
// Pass a supabase instance from the server when calling from Server Components.

import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

export type ProfileUpdate = Partial<
  Pick<Profile, "first_name" | "last_name" | "full_name" | "avatar_url" | "bio" | "role" | "plan" | "push_level" | "default_dashboard" | "assigned_trainer_id">
>;

/** Get the currently authenticated user's profile. */
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) { console.error("[profiles] getMyProfile:", error.message); return null; }
  return data as Profile;
}

/** Get any profile by user ID — must have RLS permission. */
export async function getProfileById(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data as Profile;
}

/** Update the current user's profile. */
export async function updateProfile(updates: ProfileUpdate): Promise<Profile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select()
    .single();

  if (error) { console.error("[profiles] updateProfile:", error.message); return null; }
  return data as Profile;
}

/** Get all clients assigned to a trainer. */
export async function getMyClients(): Promise<Profile[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("assigned_trainer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) { console.error("[profiles] getMyClients:", error.message); return []; }
  return (data ?? []) as Profile[];
}

/** Admin: get all profiles. */
export async function getAllProfiles(): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as Profile[];
}

/** Convert a Supabase Profile to the MockUser shape used throughout the app. */
export function profileToMockUser(profile: Profile) {
  return {
    id:                 profile.id,
    name:               profile.full_name ?? (`${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email),
    role:               profile.role,
    status:             "active" as const,
    pushLevel:          profile.push_level,
    plan:               profile.plan,
    defaultDashboard:   profile.default_dashboard,
    subscriptionStatus:   profile.subscription_status,
    stripeCustomerId:     profile.stripe_customer_id,
    stripeSubscriptionId: profile.stripe_subscription_id,
    subscriptionPeriodEnd: profile.subscription_current_period_end,
  };
}
