// GET /api/clients/[id]/ai-conversations — coach reads the client's AI-coach
// conversations (read-only). No id → list (id, preview, updatedAt); ?id=… →
// that conversation's transcript. Admin: any client. Trainer: assigned only.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";

type Msg = { role: string; text: string };

function preview(transcript: unknown): string {
  if (!Array.isArray(transcript)) return "Conversation";
  const firstUser = (transcript as Msg[]).find((m) => m?.role === "user" && m.text?.trim());
  return (firstUser?.text ?? (transcript as Msg[]).find((m) => m?.text)?.text ?? "Conversation").slice(0, 80);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;
  if (!auth.isAdmin) {
    const { data: profile } = await auth.admin
      .from("profiles")
      .select("coach_chat_visible")
      .eq("id", id)
      .maybeSingle();
    if ((profile as { coach_chat_visible?: boolean } | null)?.coach_chat_visible !== true) {
      return NextResponse.json({ error: "AI coach history is not shared by this client." }, { status: 403 });
    }
  }
  const cid = new URL(req.url).searchParams.get("id");

  if (cid) {
    const { data } = await auth.admin.from("coach_conversations").select("transcript").eq("id", cid).eq("user_id", id).maybeSingle();
    return NextResponse.json({ transcript: Array.isArray(data?.transcript) ? data!.transcript : [] });
  }

  const { data, error } = await auth.admin
    .from("coach_conversations")
    .select("id,transcript,updated_at")
    .eq("user_id", id)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) return NextResponse.json({ conversations: [] });
  return NextResponse.json({
    conversations: (data ?? []).map((c) => ({ id: c.id as string, updatedAt: c.updated_at as string, preview: preview(c.transcript) })),
  });
}
