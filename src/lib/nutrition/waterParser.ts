// ─── Water / hydration extractor ─────────────────────────────────────────────
//
// Extracts plain water mentions from a transcript or text string.
// Used as a client-side fallback if the AI API is unavailable,
// and to cross-check / augment AI-returned hydrationMl.
//
// Rules:
// - Plain water → counted toward hydration (ml)
// - Coffee, juice, shakes, etc. → food items (handled by nutrition parser)
// - Confidence reflects how specific the amount was

export interface WaterExtractResult {
  amountMl:   number;
  confidence: number;  // 0–1
  matched:    string;  // the matched phrase, for debugging/display
}

// ─── Unit normalisation ───────────────────────────────────────────────────────

const UNIT_TO_ML: Array<{ re: RegExp; multiplier: number }> = [
  // Explicit ml / cl
  { re: /\bml\b/i,                                                multiplier: 1    },
  { re: /\bcl\b/i,                                                multiplier: 10   },
  // Litres
  { re: /\bl(?:itr?e?s?|s)?\b/i,                                  multiplier: 1000 },
  // Cups (standard 240 ml)
  { re: /\bcups?\b/i,                                              multiplier: 240  },
  // Glasses (250 ml default)
  { re: /\bglasse?s?\b/i,                                          multiplier: 250  },
  // Bottles (500 ml default — single-serve)
  { re: /\bbottles?\b/i,                                           multiplier: 500  },
  // fl oz (30 ml each)
  { re: /\bfl\.?\s?oz\b/i,                                         multiplier: 30   },
  // oz (weight oz treated as ~30 ml)
  { re: /\boz\b/i,                                                 multiplier: 30   },
];

function normaliseMl(qty: number, unitFragment: string): number {
  const frag = unitFragment.trim();
  for (const { re, multiplier } of UNIT_TO_ML) {
    if (re.test(frag)) return Math.round(qty * multiplier);
  }
  return Math.round(qty * 250); // unknown unit → treat as glass
}

// ─── Water keyword guard ──────────────────────────────────────────────────────

const WATER_RE = /\bwater\b/i;

// Reject phrases that almost certainly aren't plain water
const NOT_WATER_RE = /\b(?:sparkling|mineral|tonic|soda|flavou?red|infused|coconut|vitamin)\b/i;

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Extract plain-water mentions from a text string.
 * Returns an array because a transcript may mention water more than once.
 * Call sumWater() to get the total ml.
 */
export function extractWater(text: string): WaterExtractResult[] {
  const t       = text.toLowerCase();
  const results: WaterExtractResult[] = [];

  // Pattern A: "500 ml of water" / "1 litre water" / "2 glasses of water"
  const patA =
    /(\d+(?:\.\d+)?)\s*(ml|cl|litres?|liters?|l\b|cups?|glasses?|bottles?|fl\.?\s?oz|oz)\s+(?:of\s+)?water/gi;

  let m: RegExpExecArray | null;
  while ((m = patA.exec(text)) !== null) {
    const phrase = m[0];
    if (NOT_WATER_RE.test(phrase)) continue;
    const qty = parseFloat(m[1]);
    const ml  = normaliseMl(qty, m[2]);
    results.push({ amountMl: ml, confidence: 0.95, matched: phrase });
  }

  // Pattern B: "water (500 ml)" or "water 500ml"
  const patB =
    /water\s+\(?(\d+(?:\.\d+)?)\s*(ml|cl|litres?|liters?|l\b|cups?|glasses?|bottles?|fl\.?\s?oz|oz)\)?/gi;
  while ((m = patB.exec(text)) !== null) {
    const phrase = m[0];
    if (NOT_WATER_RE.test(phrase)) continue;
    const qty = parseFloat(m[1]);
    const ml  = normaliseMl(qty, m[2]);
    // Only add if not already captured by pattern A
    if (!results.some((r) => r.matched === phrase)) {
      results.push({ amountMl: ml, confidence: 0.9, matched: phrase });
    }
  }

  // Pattern C: "a glass of water" / "a bottle of water" (no explicit number → assume 1)
  const patC =
    /\ba\s+(glass|cup|bottle)\s+of\s+water\b/gi;
  while ((m = patC.exec(text)) !== null) {
    const phrase = m[0];
    if (NOT_WATER_RE.test(phrase)) continue;
    const ml = normaliseMl(1, m[1]);
    results.push({ amountMl: ml, confidence: 0.75, matched: phrase });
  }

  // Pattern D: "drank water" / "had some water" — vague, assume 250 ml
  if (results.length === 0 && WATER_RE.test(t)) {
    const vague = /(?:drank|had|drunk|drink)\s+(?:some\s+)?water\b/i.exec(text);
    if (vague && !NOT_WATER_RE.test(vague[0])) {
      results.push({ amountMl: 250, confidence: 0.4, matched: vague[0] });
    }
  }

  return results;
}

/** Sum all extracted water amounts in ml. */
export function sumWater(results: WaterExtractResult[]): number {
  return results.reduce((s, r) => s + r.amountMl, 0);
}

/** Convenience: total ml + average confidence for a single transcript. */
export function parseWaterFromTranscript(text: string): {
  amountMl:   number;
  confidence: number;
} {
  const items = extractWater(text);
  if (items.length === 0) return { amountMl: 0, confidence: 0 };
  const total = sumWater(items);
  const avgConf = items.reduce((s, i) => s + i.confidence, 0) / items.length;
  return { amountMl: total, confidence: avgConf };
}
