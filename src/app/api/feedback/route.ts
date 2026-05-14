// POST /api/feedback — submit a feedback / bug report
//
// Body: { message, category?, severity?, pageUrl?, userAgent? }
// Authenticated users only. Captures user metadata server-side from the session.
// Optionally calls GPT-4o for a quick triage / suggested fix and stores it.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const ai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

type Body = {
  message?:   unknown;
  category?:  unknown;
  severity?:  unknown;
  pageUrl?:   unknown;
  userAgent?: unknown;
};

const ALLOWED_CATEGORIES = new Set(["bug", "feature", "feedback"]);
const ALLOWED_SEVERITIES = new Set(["low", "normal", "high", "critical"]);

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let body: Body;
  try { body = (await req.json()) as Body; } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length < 5) {
    return NextResponse.json({ error: "Message must be at least 5 characters." }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "Message must be under 4000 characters." }, { status: 400 });
  }

  const category = typeof body.category === "string" && ALLOWED_CATEGORIES.has(body.category) ? body.category : "bug";
  const severity = typeof body.severity === "string" && ALLOWED_SEVERITIES.has(body.severity) ? body.severity : "normal";
  const pageUrl   = typeof body.pageUrl === "string"   ? body.pageUrl.slice(0, 500)   : null;
  const userAgent = typeof body.userAgent === "string" ? body.userAgent.slice(0, 500) : null;

  // Pull user metadata server-side (don't trust client)
  let userEmail: string | null = null;
  let userRole: string | null = null;
  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email,role")
      .eq("id", user.id)
      .maybeSingle();
    type ProfileRow = { email: string | null; role: string | null };
    const p = (profile as ProfileRow | null) ?? null;
    userEmail = p?.email ?? user.email ?? null;
    userRole  = p?.role ?? null;
  }

  // AI triage (best-effort, non-blocking on failure)
  let aiDiagnosis: string | null = null;
  if (ai && category === "bug") {
    try {
      const completion = await ai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 350,
        messages: [
          { role: "system", content: `You are a senior engineer triaging a bug report inside Flowstate (Next.js 16 App Router, TypeScript, Supabase, OpenAI gpt-4o, Stripe, Tailwind v4).
Given the user's report + URL, produce ONE concise paragraph (≤120 words) covering:
1) Most likely root cause (file/area)
2) Suggested fix or next debugging step
3) Severity assessment

Be specific. No fluff. No headings. Plain text only.` },
          { role: "user", content: `Page: ${pageUrl ?? "unknown"}\nRole: ${userRole ?? "unknown"}\n\nReport:\n${message}` },
        ],
      });
      aiDiagnosis = completion.choices[0]?.message?.content?.trim() ?? null;
    } catch (e) {
      console.warn("[feedback] AI triage failed:", e);
    }
  }

  const { data, error } = await supabase
    .from("feedback_reports")
    .insert({
      user_id:      user?.id ?? null,
      user_email:   userEmail,
      user_role:    userRole,
      category,
      severity,
      message,
      page_url:     pageUrl,
      user_agent:   userAgent,
      ai_diagnosis: aiDiagnosis,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[feedback] insert:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: (data as { id?: string } | null)?.id ?? null });
}
