import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getPasswordResetCode,
  markPasswordTokenUsed,
  normalizeResetEmail,
  updateAuthPassword,
  validatePasswordToken,
} from "@/lib/server/passwordResetTokens";

type Body = {
  email?: unknown;
  code?: unknown;
  password?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? normalizeResetEmail(body.email) : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Enter the email for this reset code." }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit reset code from your email." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const admin = await createAdminClient();
    const row = await getPasswordResetCode({ admin, email, code });
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
      { error: "Could not update the password. Request a fresh code and try again." },
      { status: 500 },
    );
  }
}
