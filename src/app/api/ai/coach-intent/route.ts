// ─── Coach Intent Router ──────────────────────────────────────────────────────
// Classifies a free-text coach message into an actionable intent so the chat can
// log it to the right place (meal / workout-complete / reflection / recovery) or
// fall through to normal conversation. Extracts PHRASES only — never computes
// macros or training decisions (those stay in /api/ai/nutrition and the coach).
//
// Input:  { input: string }
// Output: CoachIntentOutput

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { validateCoachIntent, parseAiJson } from "@/lib/ai/validate";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `You are the intent router for Flowstate's AI coach. The athlete is
TALKING to their coach. Classify the message into ONE intent and extract a minimal
payload. You never compute calories/macros or training plans — you only route.

INTENTS:
- "log_meal" — they're telling you what they ate/drank ("two burgers and fries",
  "3 eggs, coffee and 100g oats", "had a protein shake"). payload.mealTranscript =
  the food phrase, cleaned (no "I had").
- "log_workout_complete" — they finished/did a training session ("done with my
  workout", "smashed legs today", "completed today's session"). payload.workoutHint
  = "today" or a named workout if given; payload.feel = "easy"|"good"|"hard" if
  stated; payload.note = any extra detail.
- "log_reflection" — ONLY when they clearly want a post-session note recorded
  ABOUT A SESSION THEY DID ("log this: trained light because my back was tight",
  "note for my coach: kept it easy, felt off today"). This silently SAVES and
  shares with their coach, so be conservative.
  Do NOT use it for venting, excuses, resistance, mood, or "I don't feel like
  training / being lazy / on vacation" — those are conversational and must be
  "chat" so the coach can actually talk it through. When in doubt → "chat".
- "recovery_check" — they mention sleep/soreness/fatigue/energy and/or ask whether
  they should train ("only slept 4 hours, should I train?", "I'm really sore"). Pull
  any numbers: payload.sleepHours, payload.soreness (1-5), payload.energy (1-5).
- "chat" — questions, education, plan talk, motivation, anything else. Also the
  fallback when unsure.

RULES:
- A message can mention food AND a workout — pick the PRIMARY action; if truly
  both and clearly separable, prefer the one they emphasize.
- If the message is vague ("I had a big day", "did some stuff", "feeling it") set
  intent "chat", needsClarification true, and give a short clarifyingQuestion.
- confidence is 0-1 about the INTENT. Be honest; sub-0.6 means you're unsure.
- "should I still train?" with recovery info → "recovery_check", not "chat".
- DEFAULT TO "chat". Only pick a logging intent when the user is clearly logging.
  Venting, excuses, resistance, jokes, swearing, "I don't want to train" → "chat".
  A reply the coach should TALK BACK to is "chat", never a silent log.

- "message_coach" — they explicitly want their HUMAN coach told something or to
  change their plan ("tell my coach…", "let my coach know…", "can you ask my
  coach to change my workout", "let her know I'm travelling"). payload.coachMessage
  = a clear one-line relay of what to tell the coach. Still answer them warmly too.

OUTPUT SCHEMA (JSON only):
{
  "intent": "log_meal" | "log_workout_complete" | "log_reflection" | "recovery_check" | "message_coach" | "chat",
  "confidence": 0.0,
  "needsClarification": false,
  "clarifyingQuestion": null,
  "reason": "one line",
  "payload": {
    "mealTranscript": null,
    "workoutHint": null,
    "feel": null,
    "note": null,
    "reflectionText": null,
    "coachMessage": null,
    "sleepHours": null,
    "soreness": null,
    "energy": null
  }
}

Output ONLY valid JSON.`;

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Coach not configured" }, { status: 503 });
  }
  try {
    const body = await req.json() as { input?: string };
    const input = body.input;

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const completion = await client.chat.completions.create({
      model:           "gpt-4o",
      max_tokens:      256,
      temperature:     0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: `Route this message: "${input.trim()}"` },
      ],
    });

    const text   = completion.choices[0]?.message?.content ?? "";
    const result = validateCoachIntent(parseAiJson(text));

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[coach-intent]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
