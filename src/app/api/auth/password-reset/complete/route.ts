import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getPasswordToken,
  markPasswordTokenUsed,
  updateAuthPassword,
  validatePasswordToken,
} from "@/lib/server/passwordResetTokens";

type Body = {
  token?: unknown;
  password?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!token) {
    return NextResponse.json({ error: "Reset token is missing." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const admin = await createAdminClient();
    const row = await getPasswordToken(admin, token);
    const tokenError = validatePasswordToken(row);
    if (tokenError || !row) {
      return NextResponse.json({ error: tokenError ?? "This reset link is invalid." }, { status: 400 });
    }

    await updateAuthPassword({ admin, userId: row.user_id, password });
    await markPasswordTokenUsed(admin, row.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[password-reset/complete] failed:", error);
    return NextResponse.json(
      { error: "Could not update the password. Request a fresh link and try again." },
      { status: 500 },
    );
  }
}
