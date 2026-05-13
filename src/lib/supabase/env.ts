const SERVICE_ROLE_ENV_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SERVICE_ROLE",
] as const;

export function getSupabaseServiceRoleKey(): string | null {
  for (const name of SERVICE_ROLE_ENV_NAMES) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

export function missingServiceRoleMessage(): string {
  return "Supabase service role key is not configured on the server. Add SUPABASE_SERVICE_ROLE_KEY to Vercel Production environment variables, then redeploy.";
}
