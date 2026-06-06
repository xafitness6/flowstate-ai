// GET  /api/clients/[id]/ai-breakdown — cached AI read of the client's onboarding.
// POST /api/clients/[id]/ai-breakdown — (re)generate it with GPT-4o and cache.
// A coach-facing summary: how to coach THIS person, injury cautions, focus, and
// whether a human should review before auto-programming. Admin/assigned trainer.

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { summarizeIntakeForCoach } from "@/lib/intake/format";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SCHEMA = `Return ONLY JSON (no markdown):
{
  "summary": "2-3 sentences: who this client is, their goal, and the headline of how to coach them",
  "coachingApproach": ["how to coach THIS person — tone, structure, what motivates/derails them", "..."],
  "focusAreas": ["what to prioritize in their training & nutrition", "..."],
  "injuryCautions": ["per stated injury: what to AVOID and how to train around it safely; [] if none", "..."],
  "redFlags": ["anything a human coach must review before programming — severe/unclear injury, meds or conditions that affect training or weight loss, contradictions; [] if none"],
  "needsReview": true,
  "generatedAt": ""
}
needsReview = true when redFlags is non-empty or an injury sounds beyond a simple modification (e.g. can't bear weight, recent surgery, cast, undiagnosed pain).`;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;
  const { data } = await auth.admin.from("onboarding_state").select("ai_breakdown").eq("user_id", id).maybeSingle();
  return NextResponse.json({ breakdown: data?.ai_breakdown ?? null });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI is not configured." }, { status: 500 });

  const { data: onb } = await auth.admin.from("onboarding_state").select("raw_answers").eq("user_id", id).maybeSingle();
  const summary = summarizeIntakeForCoach((onb?.raw_answers ?? null) as Record<string, unknown> | null);
  if (!summary) return NextResponse.json({ error: "No onboarding answers to analyze yet." }, { status: 400 });

  let breakdown: Record<string, unknown>;
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `You are an elite strength & conditioning coach and physio-aware trainer briefing a human coach on a new client. Be specific and practical. Take injuries and medications seriously. ${SCHEMA}` },
        { role: "user", content: `Client onboarding:\n${summary}` },
      ],
    });
    breakdown = JSON.parse(res.choices[0]?.message?.content ?? "{}");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Generation failed." }, { status: 500 });
  }
  breakdown.generatedAt = new Date().toISOString();

  await auth.admin.from("onboarding_state").upsert(
    { user_id: id, ai_breakdown: breakdown, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );

  return NextResponse.json({ breakdown });
}
