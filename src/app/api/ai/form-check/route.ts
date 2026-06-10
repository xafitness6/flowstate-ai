// ─── AI form check ──────────────────────────────────────────────────────────
// The user records or uploads a set; the client extracts ~8 frames from the
// video using <video> + canvas (no server ffmpeg dep) and POSTs them here.
// We hand the frames to GPT-4o vision with an exercise-specific prompt and
// return structured cues the workout player can render inline.

import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Severity = "ok" | "watch" | "fix";

type FormCheckResult = {
  overall:      Severity;
  headline:     string;
  cues: Array<{
    phase:    "setup" | "descent" | "bottom" | "ascent" | "lockout" | "global";
    severity: Severity;
    message:  string;
  }>;
  oneThingToFix: string | null;
  encouragement: string;
};

const SYSTEM = `You are an elite strength coach reviewing a single set of an exercise from a stack of 6–10 video frames the athlete just recorded. Your job is to give a tight, useful form read — not a textbook.

OUTPUT JSON ONLY, matching this exact shape:
{
  "overall":     "ok" | "watch" | "fix",
  "headline":    "<≤8 word verdict>",
  "cues": [
    { "phase": "setup"|"descent"|"bottom"|"ascent"|"lockout"|"global", "severity": "ok"|"watch"|"fix", "message": "<one concrete cue>" }
  ],
  "oneThingToFix": "<single most important next-set fix, or null if everything was clean>",
  "encouragement": "<one short line of real-coach validation>"
}

RULES
- Coach to the rep that's actually on screen. Don't invent issues you can't see.
- Use lift-specific phases (e.g. squat: setup/descent/bottom/ascent/lockout). For exercises without distinct phases, use "global".
- 3–5 cues max. If the lift looks clean, return 1–2 'ok' cues and oneThingToFix = null.
- Severity meaning: "ok" = clean, "watch" = small drift, "fix" = it's costing reps or risking injury.
- No medical advice. No "consult a professional." Just coach.
- Plain language, no emojis, no markdown. Output JSON ONLY (no code fences).`;

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured." }, { status: 503 });
    }

    const body = await req.json() as {
      exerciseName?: string;
      exerciseId?:   string;
      frames?:       string[];  // data URLs (data:image/jpeg;base64,…) or https URLs
      note?:         string;    // optional user note (e.g. "left shoulder bugged me")
    };

    const exerciseName = (body.exerciseName ?? "").trim();
    const frames       = Array.isArray(body.frames) ? body.frames.filter((f) => typeof f === "string") : [];
    if (!exerciseName) {
      return NextResponse.json({ error: "Missing exerciseName" }, { status: 400 });
    }
    if (frames.length < 2) {
      return NextResponse.json({ error: "Need at least 2 frames." }, { status: 400 });
    }
    if (frames.length > 12) {
      // Keep the request size reasonable and the cost predictable.
      frames.length = 12;
    }

    const userText =
      `Exercise: ${exerciseName}` +
      (body.note?.trim() ? `\nAthlete note: ${body.note.trim()}` : "") +
      `\nFrames are sampled in chronological order across one set. Read the rep and respond with the JSON schema above.`;

    const completion = await client.chat.completions.create({
      model:       "gpt-4o",
      max_tokens:  700,
      // gpt-4o reliably honors JSON when we ask + provide a schema in the system prompt.
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            ...frames.map((url) => ({
              type:      "image_url" as const,
              image_url: { url, detail: "low" as const },
            })),
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: FormCheckResult | null = null;
    try { parsed = JSON.parse(raw) as FormCheckResult; } catch { /* fallthrough */ }

    if (!parsed || !parsed.cues) {
      return NextResponse.json({ error: "Couldn't parse coach response." }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[form-check]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
