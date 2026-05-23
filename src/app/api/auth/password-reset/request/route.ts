import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  createPasswordResetToken,
  findPasswordResetUser,
  normalizeResetEmail,
} from "@/lib/server/passwordResetTokens";
import { sendPasswordResetEmail } from "@/lib/server/email";

type Body = { email?: unknown };

function appOrigin(req: NextRequest): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (configured) {
    return configured.startsWith("http") ? configured : `https://${configured}`;
  }
  return req.headers.get("origin") ?? new URL(req.url).origin;
}

function allowDebugResetUrl() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_ROUTE === "true";
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const email = typeof body.email === "string" ? normalizeResetEmail(body.email) : "";
  if (!email.includes("@")) {
    return NextResponse.json({ ok: true });
  }

  try {
    const admin = await createAdminClient();
    const user = await findPasswordResetUser(admin, email);
    if (!user) return NextResponse.json({ ok: true });

    const { token } = await createPasswordResetToken({
      admin,
      userId: user.id,
      email: user.email,
      purpose: "reset",
    });
    const resetUrl = `${appOrigin(req)}/reset-password?token=${encodeURIComponent(token)}`;
    const emailResult = await sendPasswordResetEmail({ to: user.email, resetUrl });

    if (!emailResult.ok) {
      console.error("[password-reset/request] email send failed:", emailResult.error);
    }
    if (!emailResult.sent) {
      console.info("[password-reset/request] reset link generated; email sending not configured.");
      console.info(resetUrl);
    }

    return NextResponse.json({
      ok: true,
      emailSent: emailResult.sent,
      ...(allowDebugResetUrl() ? { resetUrl } : {}),
    });
  } catch (error) {
    console.error("[password-reset/request] failed:", error);
    return NextResponse.json({ ok: true });
  }
}
