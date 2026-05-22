import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const envPath = path.join(repoRoot, ".env.local");
const migrationFiles = [
  "supabase/migrations/016_db_first_admin_auth.sql",
  "supabase/migrations/017_fix_profiles_rls_recursion.sql",
];

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function runSql({ ref, token, query, label, readOnly = false }) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      read_only: readOnly,
    }),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const detail =
      typeof payload === "string"
        ? payload
        : payload?.message || payload?.error || JSON.stringify(payload);
    throw new Error(`${label} failed with HTTP ${response.status}: ${detail}`);
  }

  return payload;
}

async function main() {
  const envText = await fs.readFile(envPath, "utf8").catch(() => "");
  const env = { ...parseEnv(envText), ...process.env };
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const token = env.SUPABASE_ACCESS_TOKEN;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing.");
  }
  if (!token) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is missing. Add a Supabase access token with database write permission to .env.local, then rerun this script.",
    );
  }

  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  console.log(`Applying auth DB migrations to Supabase project ${ref}...`);

  for (const file of migrationFiles) {
    const sql = await fs.readFile(path.join(repoRoot, file), "utf8");
    await runSql({ ref, token, query: sql, label: file });
    console.log(`Applied ${file}`);
  }

  const verificationSql = `
    select
      exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'current_user_is_admin'
      ) as has_current_user_is_admin,
      exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'current_user_role'
      ) as has_current_user_role,
      exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'profiles'
          and policyname = 'profiles_select_admin'
          and qual like '%current_user_is_admin%'
      ) as has_admin_policy;
  `;
  const result = await runSql({
    ref,
    token,
    query: verificationSql,
    label: "verification",
    readOnly: true,
  });

  console.log("Verification result:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
