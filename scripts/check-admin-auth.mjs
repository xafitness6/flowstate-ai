// ─── Admin auth audit ──────────────────────────────────────────────────────────
// Checks the Supabase Auth user, profile row, onboarding row, and optionally
// verifies the admin password if ADMIN_PASSWORD is provided.
//
// Usage:
//   node scripts/check-admin-auth.mjs
//   node scripts/check-admin-auth.mjs --repair
//   ADMIN_PASSWORD='your-password-here' node scripts/check-admin-auth.mjs

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "xavellis4@gmail.com";
const SHOULD_REPAIR = process.argv.includes("--repair");

function readEnv() {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
  const get = (key) => {
    const m = env.match(new RegExp(`^${key}=(.+)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  };
  return {
    url: get("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: get("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceKey: get("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

async function findUser(admin, email) {
  let page = 1;
  while (page < 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page++;
  }
  return null;
}

const { url, anonKey, serviceKey } = readEnv();
if (!url || !anonKey || !serviceKey) {
  console.error("ERROR: missing Supabase URL, anon key, or service role key in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("Flowstate admin auth audit");
console.log("Project:", new URL(url).hostname);
console.log("Admin email:", ADMIN_EMAIL);

const user = await findUser(admin, ADMIN_EMAIL);
if (!user) {
  console.log("\nAuth user: MISSING");
  console.log("Fix: ADMIN_PASSWORD='your-password' node scripts/setup-admin.mjs");
  process.exit(2);
}

console.log("\nAuth user: FOUND");
console.log({
  id: user.id,
  email: user.email,
  email_confirmed_at: user.email_confirmed_at ?? null,
  last_sign_in_at: user.last_sign_in_at ?? null,
  providers: user.app_metadata?.providers ?? [],
});

const { data: profile, error: profileError } = await admin
  .from("profiles")
  .select("id,email,role,is_admin,plan,default_dashboard,subscription_status")
  .eq("id", user.id)
  .maybeSingle();

if (profileError) {
  console.log("\nProfile lookup error:", profileError.message);
} else if (!profile) {
  console.log("\nProfile: MISSING");
  console.log("Fix: ADMIN_PASSWORD='your-password' node scripts/setup-admin.mjs");
} else {
  console.log("\nProfile:", profile);
  if (profile.role !== "master" || profile.is_admin !== true) {
    console.log("Profile needs repair: role must be master and is_admin must be true.");
  }
}

if (SHOULD_REPAIR && (!profile || profile.role !== "master" || profile.is_admin !== true)) {
  const now = new Date().toISOString();
  const { data: repairedProfile, error: repairError } = await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: ADMIN_EMAIL,
        first_name: "Xavier",
        last_name: "Ellis",
        full_name: "Xavier Ellis",
        role: "master",
        is_admin: true,
        plan: "coaching",
        default_dashboard: "overview",
        push_level: 6,
        subscription_status: "active",
        updated_at: now,
      },
      { onConflict: "id" },
    )
    .select("id,email,role,is_admin,plan,default_dashboard,subscription_status")
    .single();

  if (repairError) {
    console.log("\nRepair failed:", repairError.message);
    process.exit(1);
  }

  console.log("\nProfile repaired:", repairedProfile);
}

const { data: onboarding, error: onboardingError } = await admin
  .from("onboarding_state")
  .select("user_id,walkthrough_seen,onboarding_complete,profile_complete")
  .eq("user_id", user.id)
  .maybeSingle();

if (onboardingError) {
  console.log("\nOnboarding lookup error:", onboardingError.message);
} else {
  console.log("\nOnboarding:", onboarding ?? "no row");
}

if (process.env.ADMIN_PASSWORD) {
  const browser = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await browser.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  console.log("\nPassword login:", error ? `FAILED - ${error.message}` : "OK");
  if (data.session) await browser.auth.signOut();
} else {
  console.log("\nPassword login: skipped (set ADMIN_PASSWORD to verify it)");
}

console.log("\nExpected app route after login: /admin");
