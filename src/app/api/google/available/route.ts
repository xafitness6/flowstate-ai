// GET /api/google/available
// Returns whether Google OAuth env vars are set on the server.
// The UI uses this to hide the "Connect Google Calendar" card when the
// feature isn't configured — keeps the broken state out of the user's face.

import { NextResponse } from "next/server";

export function GET() {
  const available = !!process.env.GOOGLE_OAUTH_CLIENT_ID
    && !!process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  return NextResponse.json({ available });
}
