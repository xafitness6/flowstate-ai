import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  createPasswordResetCode,
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

function allowDebugResetCode() {
  return process.env.NODE_ENV !== "production";
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

    const { code } = await createPasswordResetCode({
      admin,
      userId: user.id,
      email: user.email,
      purpose: "reset",
    });
    const resetUrl = `${appOrigin(req)}/reset-password?email=${encodeURIComponent(user.email)}`;
    const emailResult = await sendPasswordResetEmail({ to: user.email, code, resetUrl });

    if (!emailResult.ok) {
      console.error("[password-reset/request] email send failed:", emailResult.error);
    }
    if (!emailResult.sent) {
      console.info("[password-reset/request] reset code generated; email sending not configured.");
      console.info(`Reset code for ${user.email}: ${code}`);
      console.info(resetUrl);
    }

    return NextResponse.json({
      ok: true,
      ...(allowDebugResetCode()
        ? {
            emailSent: emailResult.sent,
            resetCode: emailResult.sent ? undefined : code,
            resetUrl,
          }
        : {}),
    });
  } catch (error) {
    console.error("[password-reset/request] failed:", error);
    return NextResponse.json({ ok: true });
  }
}
