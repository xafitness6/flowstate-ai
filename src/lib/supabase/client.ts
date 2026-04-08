import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client — safe to import in Client Components.
// Uses the anon key only. Never use service role key here.
//
// Note: Run `npx supabase gen types typescript --linked > src/lib/supabase/types.ts`
// to regenerate fully typed tables. Until then, tables are typed via our manual types.ts.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): ReturnType<typeof createBrowserClient<any>> {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
