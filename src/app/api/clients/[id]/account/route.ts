// POST /api/clients/[id]/account — coach/admin account actions for a client:
//   { action: "resend_confirmation" } → re-send the email-confirmation mail
//   { action: "reset_password" }      → set a fresh temp password, return it
// Gated by requireClientAccess (admin = any client, trainer = assigned only).

import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";

// Readable temp password (no ambiguous chars).
function tempPassword(): string {
  const cs = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const block = () => Array.from({ length: 4 }, () => cs[randomInt(cs.length)]).join("");
  return `Flow-${block()}-${block()}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let body: { action?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = body.action;

  const { data: prof } = await auth.admin.from("profiles").select("email").eq("id", id).maybeSingle();
  const email = (prof?.email as string | null) ?? null;
  if (!email) return NextResponse.json({ error: "This client has no email on file." }, { status: 400 });

  if (action === "resend_confirmation") {
    // Supabase Auth's own confirmation mail (separate from the app's Resend setup).
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const res = await fetch(`${url}/auth/v1/resend`, {
      method: "POST",
      headers: { apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "signup", email }),
    });
    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ error: `Couldn't resend (${res.status}). ${t.slice(0, 140)}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, email });
  }

  if (action === "reset_password") {
    const password = tempPassword();
    const { error } = await auth.admin.auth.admin.updateUserById(id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, password, email });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
