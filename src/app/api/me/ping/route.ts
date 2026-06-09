// POST /api/me/ping — records that the signed-in user opened the app today.
// Upserts today's row in app_activity (distinct active days = "how often they
// log in") and stamps profiles.last_seen_at. Fire-and-forget; never errors loud.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { missingQuestions } from "@/lib/intake/backfill";

const NUDGE_LINK = "/profile?finish=1";
const NUDGE_THROTTLE_MS = 3 * 24 * 60 * 60 * 1000; // re-nudge at most every 3 days

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let tz: string | null = null;
  try { const b = await req.json(); if (typeof b?.tz === "string" && b.tz.includes("/")) tz = b.tz; } catch { /* no body */ }

  try {
    const admin = await createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    await admin.from("app_activity").upsert({ user_id: user.id, day: today }, { onConflict: "user_id,day" });
    await admin.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
    // Auto-detect timezone on first open; never clobber a manual choice.
    if (tz) {
      const { data: prof } = await admin.from("profiles").select("timezone").eq("id", user.id).maybeSingle();
      if (!prof?.timezone) await admin.from("profiles").update({ timezone: tz }).eq("id", user.id);
    }

    // Nudge them to complete onboarding. Two cases:
    //  • No intake at all (admins bypass onboarding, so this is effectively them):
    //    send them through the FULL detailed onboarding.
    //  • Has an intake but is missing newer questions: send them to finish those.
    // Deduped per link — skip while one is unread, and re-nudge at most every few days.
    try {
      const { data: onb } = await admin.from("onboarding_state").select("raw_answers").eq("user_id", user.id).maybeSingle();
      const raw = (onb?.raw_answers && typeof onb.raw_answers === "object") ? onb.raw_answers as Record<string, unknown> : null;
      const hasIntake = !!raw && Object.keys(raw).length > 0;

      let nudge: { link: string; title: string; body: string } | null = null;
      if (!hasIntake) {
        nudge = {
          link: "/onboarding",
          title: "Complete your onboarding",
          body: "Run through the full setup so your program, nutrition and coaching are tailored to you.",
        };
      } else {
        const missing = missingQuestions(raw);
        if (missing.length > 0) {
          const n = missing.length;
          nudge = {
            link: NUDGE_LINK,
            title: "Finish setting up your profile",
            body: `You have ${n} quick question${n > 1 ? "s" : ""} left from onboarding — answer ${n > 1 ? "them" : "it"} so your coaching gets sharper.`,
          };
        }
      }

      if (nudge) {
        const { data: last } = await admin
          .from("notifications")
          .select("read_at,created_at")
          .eq("user_id", user.id).eq("link", nudge.link)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        const unread = last && !last.read_at;
        const recent = last && (Date.now() - new Date(last.created_at as string).getTime()) < NUDGE_THROTTLE_MS;
        if (!unread && !recent) {
          await admin.from("notifications").insert({
            user_id: user.id, type: "onboarding",
            title: nudge.title, body: nudge.body, link: nudge.link,
          });
        }
      }

      // Accountability cadence → turn the chosen check-in style into real nudges.
      //   daily  → once per day  · weekly → once per 7 days · hands off → nothing.
      const cadence = typeof raw?.checkInCadence === "string" ? raw.checkInCadence : null;
      if (cadence === "daily" || cadence === "weekly") {
        const link = cadence === "daily" ? "/accountability?checkin=daily" : "/nutrition?checkin=weekly";
        const { data: lastC } = await admin
          .from("notifications").select("created_at")
          .eq("user_id", user.id).eq("link", link)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        const lastAt = lastC ? new Date(lastC.created_at as string) : null;
        const due = cadence === "daily"
          ? !(lastAt && lastAt.toISOString().slice(0, 10) === today)               // not yet today
          : !(lastAt && Date.now() - lastAt.getTime() < 7 * 24 * 60 * 60 * 1000);  // not in last 7 days
        if (due) {
          const notif = cadence === "daily"
            ? { title: "Daily check-in", body: "Did you train, hit your protein, and move today? Tick off your commitments." }
            : { title: "Weekly check-in", body: "Log your weight and review your week — see how your 7-day averages are tracking." };
          await admin.from("notifications").insert({ user_id: user.id, type: "general", title: notif.title, body: notif.body, link });
        }
      }
    } catch { /* nudge is best-effort */ }
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}
