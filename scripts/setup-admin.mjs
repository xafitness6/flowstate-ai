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

// Ensure profile row has admin/master flags. The handle_new_user trigger
// should have done this on insert, but force it here in case the row
// pre-dates the trigger or the email check.
const { error: profileError } = await supabase
  .from("profiles")
  .update({ role: "master", is_admin: true })
  .eq("id", userId);

if (profileError) {
  console.warn("Profile update warning:", profileError.message);
} else {
  console.log("Profile set to role=master, is_admin=true.");
}

console.log(`\nDone. Sign in at /login with:`);
console.log(`  email:    ${ADMIN_EMAIL}`);
console.log(`  password: (the one you passed via ADMIN_PASSWORD)`);
