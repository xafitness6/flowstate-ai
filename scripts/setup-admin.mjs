// ─── Admin user setup ─────────────────────────────────────────────────────────
// Creates or resets the xavellis4@gmail.com admin account in Supabase Auth.
// Usage:
//   ADMIN_PASSWORD='your-password-here' node scripts/setup-admin.mjs
//
// Safe to re-run — updates the password if the user already exists.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "xavellis4@gmail.com";

const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 8) {
  console.error("ERROR: set ADMIN_PASSWORD env var (min 8 chars).");
  console.error("Example: ADMIN_PASSWORD='mySecret123' node scripts/setup-admin.mjs");
  process.exit(1);
}

// Read service role + URL from .env.local
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
};
const url = get("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = get("SUPABASE_SERVICE_ROLE_KEY");

if (!url || !serviceKey) {
  console.error("ERROR: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Find existing user by email ─────────────────────────────────────────────
async function findUser(email) {
  let page = 1;
  while (page < 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page++;
  }
  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────
const existing = await findUser(ADMIN_EMAIL);

let userId;
if (existing) {
  console.log(`Found existing user: ${existing.id}`);
  const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (error) {
    console.error("Failed to update password:", error.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log("Password updated.");
} else {
  console.log("No user found — creating new one.");
  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password,
    email_confirm: true,
  });
  if (error) {
    console.error("Failed to create user:", error.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log(`Created user: ${userId}`);
}

// Ensure the profile row exists and has admin/master flags. The handle_new_user
// trigger should create this on auth insert, but production can drift if the
// trigger was added after the user or failed during an earlier setup.
const now = new Date().toISOString();
const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .upsert(
    {
      id: userId,
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

if (profileError) {
  console.warn("Profile upsert warning:", profileError.message);
} else {
  console.log("Profile repaired:", {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    is_admin: profile.is_admin,
    plan: profile.plan,
    default_dashboard: profile.default_dashboard,
    subscription_status: profile.subscription_status,
  });
}

console.log(`\nDone. Sign in at /login with:`);
console.log(`  email:    ${ADMIN_EMAIL}`);
console.log(`  password: (the one you passed via ADMIN_PASSWORD)`);
