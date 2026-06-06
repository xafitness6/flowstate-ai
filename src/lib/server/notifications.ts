// Server-only notification helper. Creates an in-app notification (service role,
// bypasses RLS) and — for program/nutrition/workout events only — also sends an
// email. Designed to NEVER throw into its caller: a failed notification (e.g.
// the table not yet migrated) must not break the coach action that triggered it.

import { createAdminClient } from "@/lib/supabase/server";
import { sendNotificationEmail } from "@/lib/server/email";

export type NotificationType =
  | "general" | "onboarding" | "program_assigned" | "program_changed"
  | "nutrition_added" | "workout_added" | "note" | "task";

// Only these events email the client (per product decision). "onboarding" is
// included so a coach sending a client through setup also reaches them by email.
const EMAIL_TYPES: ReadonlySet<NotificationType> = new Set([
  "program_assigned", "program_changed", "nutrition_added", "workout_added",
  "onboarding",
]);

export async function notifyClient(args: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  actorName?: string | null;
  email?: string | null;     // recipient email — required only to send mail
  appUrl?: string | null;    // base URL for the email CTA link
}): Promise<void> {
  try {
    const admin = await createAdminClient();
    await admin.from("notifications").insert({
      user_id:    args.userId,
      type:       args.type,
      title:      args.title,
      body:       args.body ?? null,
      link:       args.link ?? null,
      actor_name: args.actorName ?? null,
    });
  } catch (e) {
    console.error("[notifications] insert failed (non-fatal):", e instanceof Error ? e.message : e);
  }

  if (EMAIL_TYPES.has(args.type) && args.email) {
    try {
      const base = (args.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
      await sendNotificationEmail({
        to:      args.email,
        subject: args.title,
        heading: args.title,
        body:    args.body ?? "",
        ctaText: args.link ? "Open Flowstate" : undefined,
        ctaUrl:  args.link && base ? `${base}${args.link}` : undefined,
      });
    } catch (e) {
      console.error("[notifications] email failed (non-fatal):", e instanceof Error ? e.message : e);
    }
  }
}
