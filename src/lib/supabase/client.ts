import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client — safe to import in Client Components.
// Uses the anon key only. Never use service role key here.
//
// Note: Run `npx supabase gen types typescript --linked > src/lib/supabase/types.ts`
// to regenerate fully typed tables. Until then, tables are typed via our manual types.ts.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BrowserSupabaseClient = ReturnType<typeof createBrowserClient<any>>;

let browserClient: BrowserSupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function createClient(): BrowserSupabaseClient {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Auth callback/reset pages handle URL tokens explicitly. Leaving the
        // SDK to auto-consume them can race those pages and make valid reset
        // links look expired.
        detectSessionInUrl: false,
      },
    },
  );

  return browserClient;
}
