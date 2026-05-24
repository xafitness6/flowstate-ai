// POST /api/clients/[id]/prefill-intake
// Admin/trainer only. Extracts structured onboarding fields from free-form
// notes via GPT-4o. DOES NOT write — returns the parsed result for the trainer
// to review/edit, then they confirm via PATCH /api/clients/[id]/intake.

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { buildExtractionPrompt, validateExtraction } from "@/lib/intake/prefillSchema";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let payload: { notes?: unknown };
  try { payload = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
  if (!notes) return NextResponse.json({ error: "Notes are required." }, { status: 400 });
  if (notes.length > 8000) return NextResponse.json({ error: "Notes are too long (max 8000 chars)." }, { status: 400 });

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildExtractionPrompt() },
        { role: "user", content: notes },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = {}; }

    const { extracted, uncertain } = validateExtraction(parsed);
    return NextResponse.json({ extracted, uncertain });
  } catch (e) {
    console.error("[prefill-intake] extraction failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Extraction failed. Try again." }, { status: 500 });
  }
}
