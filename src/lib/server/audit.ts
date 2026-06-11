// ─── Audit log helper ────────────────────────────────────────────────────────
// Append-only writes to public.audit_logs. Call from any server route that
// performs a sensitive admin or self-service action so we have an immutable
// record of who did what.
//
// Best-effort: never throws. A failure to log shouldn't block the action.

import { createAdminClient } from "@/lib/supabase/server";
import { log } from "@/lib/server/log";

export type AuditEvent = {
  actorId?:     string | null;
  actorEmail?:  string | null;
  actorRole?:   "master" | "trainer" | "client" | "member" | "self" | "system";
  action:       string;          // machine slug, e.g. "assign_trainer"
  targetKind?:  string | null;
  targetId?:    string | null;
  summary?:     string | null;
  details?:     Record<string, unknown> | null;
};

export async function audit(event: AuditEvent): Promise<void> {
  try {
    const admin = await createAdminClient();
    await admin.from("audit_logs").insert({
      actor_id:    event.actorId    ?? null,
      actor_email: event.actorEmail ?? null,
      actor_role:  event.actorRole  ?? null,
      action:      event.action,
      target_kind: event.targetKind ?? null,
      target_id:   event.targetId   ?? null,
      summary:     event.summary    ?? null,
      details:     event.details    ?? null,
    });
  } catch (err: unknown) {
    // Don't block the calling action. Surface in logs only.
    log.warn("[audit] insert failed", err as Error);
  }
}
