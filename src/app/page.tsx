import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingState, Profile } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_EMAIL = "xavellis4@gmail.com";

function resolveOnboardingRoute(state: OnboardingState | null): string | null {
  if (!state) return "/onboarding/walkthrough";
  if (!state.walkthrough_seen && !state.onboarding_complete) return "/onboarding/walkthrough";
  if (!state.onboarding_complete) return "/onboarding/calibration";
  if (!state.body_focus_complete) return "/onboarding/body-focus";
  if (!state.planning_conversation_complete) return "/onboarding/coach-planning";
  if (!state.program_generated) return "/onboarding/program-generation";
  if (!state.tutorial_complete) return "/onboarding/tutorial";
  if (!state.profile_complete) return "/onboarding/profile-setup";
  return null;
}

function finalRoute(profile: Pick<Profile, "role"> | null): string {
  if (profile?.role === "trainer") return "/trainers";
  if (profile?.role === "master") return "/admin";
  return "/dashboard";
}

// Root entry point. This must be server-side, not a static client loading page:
// after OAuth/password login the browser often lands on `/`, and relying on a
// hydrated client effect here can strand users on "Signing you in..." forever.
export default async function Root() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (user.email?.trim().toLowerCase() === ADMIN_EMAIL) {
    redirect("/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_admin || profile?.role === "master") {
    redirect("/admin");
  }

  const { data: onboarding } = await supabase
    .from("onboarding_state")
    .select(
      "walkthrough_seen,onboarding_complete,body_focus_complete,planning_conversation_complete,program_generated,tutorial_complete,profile_complete",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const blocker = resolveOnboardingRoute(onboarding as OnboardingState | null);
  redirect(blocker ?? finalRoute(profile as Pick<Profile, "role"> | null));
}
