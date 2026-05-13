// ─── Supabase service-role client ─────────────────────────────────────────────
// Uses SUPABASE_SERVICE_ROLE_KEY — bypasses RLS.
// ONLY import this in server-side code (API routes, server actions).
// NEVER expose this in client components or bundle it to the browser.

import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey } from "@/lib/supabase/env";

let _client: ReturnType<typeof createClient> | null = null;

export function createAdminClient() {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSupabaseServiceRoleKey();

  if (!url || !key) {
    throw new Error(
      "[supabase/admin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  _client = createClient(url, key, {
    auth: {
      persistSession:   false,
      autoRefreshToken: false,
    },
  });

  return _client;
}
