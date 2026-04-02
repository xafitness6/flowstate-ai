// ─── Unified Coach ────────────────────────────────────────────────────────────
// Single endpoint. Handles all intents: educational questions, performance
// queries, follow-ups. Intent routing is invisible to the user.
//
// Input:  { message, history, context, tone, style, profanity }
// Output: { content }  — plain text, paragraphs separated by \n\n

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Tone fragments ────────────────────────────────────────────────────────────

const TONE_INSTRUCTIONS: Record<string, string> = {
  direct: `TONE: Direct, confident, no filler. Lead with the answer. Use short sentences. Never say "great question" or "absolutely" or "sure." Cut every word that doesn't carry information.`,

  supportive: `TONE: Warm but substantive. Acknowledge the situation briefly, then give the real answer. Encourage without being sycophantic. Don't pad with empty positivity.`,

  analytical: `TONE: Precise and data-driven. Lead with the mechanism or principle. Use specific numbers and reasoning. Avoid emotional framing. Think like a sports scientist, not a cheerleader.`,
};

const STYLE_INSTRUCTIONS: Record<string, string> = {
  lite: `LENGTH: Be concise. Maximum 2 short paragraphs. One clear idea per paragraph. If it can be said in one line, use one line.`,
  pro:  `LENGTH: Full detail when needed — up to 3 paragraphs. Don't pad, but don't shortchange complex topics. Give the athlete everything they need to act.`,
};

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystem(params: {
  tone:      string;
  style:     string;
  profanity: string;
  context:   { goal: string; phase: string; week: string; status: string };
}): string {
  const { tone, style, profanity, context } = params;

  return `You are the AI coach inside Flowstate, an elite training system.

ATHLETE CONTEXT:
- Goal: ${context.goal}
- Phase: ${context.phase}
- Week: ${context.week}
- Status: ${context.status}

YOU ARE ONE COACH. You handle everything the athlete asks without switching modes or labeling response types. The user never sees routing logic — they only see your response.

HOW YOU RESPOND:
- If they ask a question about training science, nutrition, or concepts → explain precisely, lead with the mechanism, give one concrete takeaway
- If they ask about their plan, readiness, or performance → be directive and specific to their current context
- If it's a follow-up → adapt naturally, reference what was just said, don't restart the conversation

${TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.direct}

${STYLE_INSTRUCTIONS[style] ?? STYLE_INSTRUCTIONS.pro}

${profanity === "mild" ? `LANGUAGE: Natural, unfiltered. Mild language is fine if it fits the context. Don't force it — only where it reads naturally.` : `LANGUAGE: Keep it clean.`}

FORMAT:
- Separate distinct thoughts with a blank line (two newlines)
- Never use headers, bullet points, or markdown — prose only
- Never mention "education mode", "performance mode", or any system internals
- Never start a response with "I", "Sure", "Great", "Of course", "Absolutely", or filler
- Maximum ${style === "lite" ? "2 paragraphs" : "3 paragraphs"}`;
}

// ── Route ─────────────────────────────────────────────────────────────────────

type HistoryMessage = {
  role:    "user" | "coach";
  content: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      message:   string;
      history:   HistoryMessage[];
      context:   { goal: string; phase: string; week: string; status: string };
      tone:      string;
      style:     string;
      profanity: string;
    };

    const { message, history = [], context, tone = "direct", style = "pro", profanity = "off" } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    // Build conversation history — last 10 messages (5 exchanges) for context
    const historyMessages = history
      .slice(-10)
      .map((m) => ({
        role:    m.role === "coach" ? "assistant" : "user",
        content: m.content,
      } as { role: "user" | "assistant"; content: string }));

    const completion = await client.chat.completions.create({
      model:      "gpt-4o",
      max_tokens: style === "lite" ? 400 : 700,
      messages:   [
        { role: "system", content: buildSystem({ tone, style, profanity, context }) },
        ...historyMessages,
        { role: "user",   content: message.trim() },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";

    if (!content) {
      return NextResponse.json({ error: "Empty response from model" }, { status: 500 });
    }

    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[coach]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
