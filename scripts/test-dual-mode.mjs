// ─── Dual-mode intent + education test ───────────────────────────────────────
// Tests the detect + educate routes with 6 inputs:
//   4 education questions, 2 performance inputs

import { readFileSync } from "fs";
import OpenAI from "openai";

const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const apiKeyMatch = envFile.match(/OPENAI_API_KEY=(.+)/);
const OPENAI_API_KEY = apiKeyMatch[1].trim();
const client = new OpenAI({ apiKey: OPENAI_API_KEY });

const DETECT_SYSTEM = `You are the intent router for Flowstate, an AI training and coaching system.

Your job is to classify user input into one of two modes:

"education" — user is asking a question about fitness, nutrition, training science, or health
"performance" — anything else (personal data entry, check-in, no clear question)

EDUCATION signals (any of these = education):
- Contains a question mark
- Starts with: what, how, why, when, does, do, is, are, can, should, explain, tell me, help me understand
- Asks about concepts: macros, protein, carbs, fat, calories, RPE, progressive overload, periodization,
  hypertrophy, fatigue, recovery, sleep, HRV, VO2max, creatine, supplements, cutting, bulking, recomposition,
  TDEE, BMR, deload, supercompensation, cortisol, adaptation, training frequency, volume, intensity

PERFORMANCE signals:
- Logging data ("I slept 7 hours", "I did my session")
- No question present
- Vague input like "run analysis" or "check my status"

OUTPUT SCHEMA:
{
  "mode": "education" | "performance",
  "reason": "one-line explanation"
}

Output ONLY valid JSON.`;

const EDUCATE_SYSTEM = `You are the education layer for Flowstate, an elite AI coaching system.

Your role is to answer questions about training, nutrition, and health with clarity and precision.
You speak like a knowledgeable coach who respects the athlete's intelligence.

TONE:
- Authoritative. You know what you're talking about.
- Direct. Lead with the answer, not the setup.
- No filler. No "great question", no "it depends" without immediately explaining what it depends on.
- No over-explaining. Dense and accurate beats long and padded.

TOPIC COVERAGE:
- Macros: calculation (TDEE, BMR, macro splits), adjustment, tracking
- Nutrition: cutting, bulking, body recomposition, recovery nutrition, meal timing
- Training principles: progressive overload, periodization, fatigue management, deload, supercompensation
- Biometrics: HRV, sleep, readiness, recovery markers
- Supplementation: evidence-based only (creatine, caffeine, protein, etc.)
- General health: sleep optimization, stress, cortisol, adaptation

RULES:
- Output ONLY valid JSON
- topic: the subject of the question, named precisely
- explanation: 2–4 sentences. Lead with the mechanism or core principle. Be specific.
    Good: "Progressive overload is the systematic increase of training stress over time to force adaptation. This can be applied via load, volume, density, or range of motion — not just adding weight. The minimum effective dose is a 2–5% increase per week on a given lift before the nervous system adapts."
    Bad:  "Progressive overload is important for muscle growth. It means doing more over time."
- takeaway: 1 sentence. What the athlete should actually do or understand from this.
    Must be concrete and actionable, not abstract.
- example: optional. Only include if a concrete number or scenario makes the concept significantly clearer.
    Omit if the explanation already covers it clearly.

OUTPUT SCHEMA:
{
  "topic": "...",
  "explanation": "...",
  "takeaway": "...",
  "example": "..."
}

If no example is needed, omit the field entirely.`;

const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";
const CYAN  = "\x1b[36m";
const GOLD  = "\x1b[33m";
const GREEN = "\x1b[32m";
const RED   = "\x1b[31m";
const RESET = "\x1b[0m";

const TEST_INPUTS = [
  { input: "How do I calculate my macros for a cut?",            expect: "education" },
  { input: "What is progressive overload?",                      expect: "education" },
  { input: "Should I do a deload this week?",                    expect: "education" },
  { input: "How does HRV actually work?",                        expect: "education" },
  { input: "run analysis",                                       expect: "performance" },
  { input: "I trained 4 times this week at RPE 8",              expect: "performance" },
];

async function detect(input) {
  const c = await client.chat.completions.create({
    model: "gpt-4o", max_tokens: 128,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: DETECT_SYSTEM },
      { role: "user",   content: `Classify this input: "${input}"` },
    ],
  });
  return JSON.parse(c.choices[0]?.message?.content ?? "{}");
}

async function educate(question) {
  const c = await client.chat.completions.create({
    model: "gpt-4o", max_tokens: 768,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EDUCATE_SYSTEM },
      { role: "user",   content: question },
    ],
  });
  return JSON.parse(c.choices[0]?.message?.content ?? "{}");
}

console.log(`\n${BOLD}${CYAN}═══ INTENT DETECTION TESTS ═══${RESET}\n`);

let passed = 0;
for (const t of TEST_INPUTS) {
  const result = await detect(t.input);
  const ok = result.mode === t.expect;
  if (ok) passed++;
  const icon = ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  console.log(`  ${icon}  [${result.mode.padEnd(11)}]  "${t.input.slice(0,50)}"`);
  if (!ok) console.log(`      ${RED}Expected: ${t.expect}${RESET}`);
  console.log(`      ${DIM}${result.reason}${RESET}`);
}
console.log(`\n  ${passed}/${TEST_INPUTS.length} correct\n`);

console.log(`${BOLD}${CYAN}═══ EDUCATION MODE TESTS ═══${RESET}\n`);

const EDUCATION_QUESTIONS = [
  "How do I calculate my macros for a cut?",
  "What is progressive overload and how do I apply it?",
  "Should I do a deload week and how often?",
  "How does HRV relate to training readiness?",
];

for (const q of EDUCATION_QUESTIONS) {
  console.log(`${GOLD}Q: ${q}${RESET}`);
  const result = await educate(q);
  console.log(`${DIM}Topic:       ${RESET}${result.topic}`);
  console.log(`${DIM}Explanation: ${RESET}${result.explanation}`);
  if (result.example) {
    console.log(`${DIM}Example:     ${RESET}${result.example}`);
  }
  console.log(`${DIM}Takeaway:    ${RESET}${BOLD}${result.takeaway}${RESET}`);
  console.log();
}

console.log(`${BOLD}${GREEN}Done.${RESET}\n`);
