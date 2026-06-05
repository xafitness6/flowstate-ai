// ─── Learn / teaching content ─────────────────────────────────────────────────
// Static, authored content for the Learning tab: how to get the most out of the
// app, plus training & nutrition fundamentals. Each article is plain paragraphs
// so it renders without a markdown dependency.

export type LearnCategory = "app" | "training" | "nutrition";

export type LearnArticle = {
  id:       string;
  category: LearnCategory;
  title:    string;
  summary:  string;
  /** Paragraphs (rendered with spacing). Use "• " prefix for bullet lines. */
  body:     string[];
  /** Optional deep-link target inside the app (e.g. "/nutrition"). */
  cta?:     { label: string; href: string };
};

export const LEARN_CATEGORIES: { id: LearnCategory; label: string }[] = [
  { id: "app",       label: "Using FlowState" },
  { id: "training",  label: "Training" },
  { id: "nutrition", label: "Nutrition" },
];

export const LEARN_ARTICLES: LearnArticle[] = [
  // ── Using the app ──────────────────────────────────────────────────────────
  {
    id: "app-getting-started",
    category: "app",
    title: "Getting started — the 60-second tour",
    summary: "What FlowState is and the fastest path to value.",
    body: [
      "FlowState is your training + nutrition home base with an AI coach built in. Three things drive everything: your program (what to train), your nutrition (what to eat), and your coach (who adapts both to how you actually feel).",
      "Fastest path: finish onboarding so the app knows your stats and goal, open Program to see today's session, and log meals from the Nutrition tab or just by telling the coach. The more you log, the sharper the coaching gets.",
      "Everything connects — a meal you log shows in your day's totals, a workout you finish feeds your progress, and the coach reads all of it.",
    ],
  },
  {
    id: "app-talk-to-coach",
    category: "app",
    title: "Just talk to your coach",
    summary: "Log meals, finish workouts, and get real advice in plain language.",
    body: [
      "The Coach tab isn't only chat — it acts. Tell it \"two burgers and fries\" and it logs the meal (after you confirm it). Say \"finished my workout\" and it marks it done. Tell it why you trained light and it saves that note for you and your coach.",
      "Ask it real questions too: \"only slept 4 hours, should I train?\" It'll ask how sore and how drained you are (1–5), then give you a reasoned call — push with a lighter target, or rest with the why behind it.",
      "Set the voice to match you: a Gentle → Militant intensity slider in Profile, and an optional strong-language toggle.",
    ],
    cta: { label: "Open the coach", href: "/coach" },
  },
  {
    id: "app-nutrition-targets",
    category: "app",
    title: "Your calorie & macro targets, explained",
    summary: "Where your numbers come from — and how to change them.",
    body: [
      "Your targets are calculated from your stats: BMR (the energy you burn at rest) × your activity level = maintenance calories, then adjusted up or down for your goal and timeframe.",
      "BMR uses body composition when it can (body-fat %), which is more accurate for muscular people than height/weight alone. See the Energy card on the Nutrition tab for the full BMR → maintenance → target breakdown.",
      "Numbers off? Hit Adjust above the nutrition cards to set your own calories and macros — a Custom badge shows when you've overridden them, and you can reset to the calculated values anytime.",
    ],
    cta: { label: "Go to Nutrition", href: "/nutrition" },
  },
  {
    id: "app-log-meals",
    category: "app",
    title: "Three ways to log a meal",
    summary: "Voice/text, photo, or search — whatever's fastest.",
    body: [
      "• Text or voice: describe the meal and the AI parses it into items + macros for you to confirm. Log a whole day at once — it groups it by breakfast/lunch/dinner.",
      "• Photo scan: snap your plate for an AI portion estimate.",
      "• Food search: search a food and quick-add a serving.",
      "Everything goes through a quick review so you can fix anything before it's saved — accuracy stays in your hands.",
    ],
    cta: { label: "Log a meal", href: "/nutrition" },
  },
  {
    id: "app-workouts",
    category: "app",
    title: "Running a workout",
    summary: "Preview, start, pause, log — the whole flow.",
    body: [
      "Open a session to preview it first — focus, every exercise, sets × reps, and warm-up — before anything starts. Hit Start Workout for a 5-4-3-2-1 countdown, then the timer runs.",
      "During the session you've got a live timer with Pause/Resume and a Finish button. Log each set's reps, load, and how it felt; personal bests get celebrated.",
      "Did a session off-plan? Use Freestyle — or paste your written notes and the AI deciphers the exercises into the log for you.",
    ],
    cta: { label: "Open Program", href: "/program" },
  },

  // ── Training ────────────────────────────────────────────────────────────────
  {
    id: "train-progressive-overload",
    category: "training",
    title: "Progressive overload",
    summary: "The one rule that makes everything else work.",
    body: [
      "Muscle and strength are adaptations to a stress your body isn't used to. To keep adapting, the stress has to keep nudging upward over time — that's progressive overload.",
      "You can add it more ways than just weight: more reps, more sets, better control/tempo, shorter rest, or fuller range of motion. When weight stalls, progress one of the others.",
      "Takeaway: each week, aim to beat something from last week — even by one rep. Small, repeatable wins compound.",
    ],
  },
  {
    id: "train-rpe",
    category: "training",
    title: "RPE — training by feel, accurately",
    summary: "How hard a set actually was, on a 1–10 scale.",
    body: [
      "RPE (Rate of Perceived Exertion) rates a set 1–10 by how many reps you had left. RPE 8 means ~2 reps in reserve; RPE 10 means none. It lets you autoregulate — train to the right effort on a good day or a rough one.",
      "Most hypertrophy work lives at RPE 7–9. Leave the grinding 10s for rare tests, not every session — they cost more recovery than they're worth.",
      "Takeaway: pick a load where the last rep or two are genuinely hard but clean. That's the sweet spot.",
    ],
  },
  {
    id: "train-tempo-form",
    category: "training",
    title: "Tempo & form: time under tension",
    summary: "Why slowing down can grow more muscle than adding weight.",
    body: [
      "Muscle responds to tension over time, not just the number on the bar. Controlling the lowering phase (the eccentric) for 2–3 seconds and owning the position loads the muscle far more than bouncing through reps.",
      "Good form also keeps tension on the target muscle instead of leaking into joints and momentum — more stimulus, less injury risk.",
      "Takeaway: if a movement feels easy, slow the eccentric and add a pause before you add weight.",
    ],
  },
  {
    id: "train-recovery",
    category: "training",
    title: "Recovery is where you grow",
    summary: "Training is the stimulus; recovery is the adaptation.",
    body: [
      "You don't get stronger in the gym — you get stronger recovering from the gym. Sleep, food (especially protein), and managing total stress are the levers.",
      "Sore, wrecked, or sleep-deprived? That's not weakness to push through blindly. Use the coach's recovery check — sometimes the smartest session is a lighter one or a rest day, and the app will reason it out with you.",
      "Takeaway: protect sleep first. It's the highest-ROI recovery tool there is.",
    ],
    cta: { label: "Ask the coach", href: "/coach" },
  },
  {
    id: "train-deload",
    category: "training",
    title: "Deloads & avoiding burnout",
    summary: "Planned easy weeks make hard weeks work.",
    body: [
      "Fatigue accumulates faster than you notice. Every several weeks, a lighter \"deload\" (reduced volume and/or intensity) lets fatigue clear so the next block hits fresh.",
      "Signs you need one: stalling lifts, dread before sessions, poor sleep, nagging aches. Backing off for a week isn't lost progress — it's how you keep progressing.",
      "Takeaway: schedule the easy week before your body forces an unplanned one.",
    ],
  },

  // ── Nutrition ─────────────────────────────────────────────────────────────
  {
    id: "nut-calories",
    category: "nutrition",
    title: "Calories & energy balance",
    summary: "The thermostat behind gaining, losing, or maintaining.",
    body: [
      "Bodyweight tracks energy balance: eat more than you burn and you gain, less and you lose, roughly the same and you maintain. Everything else is detail on top of this.",
      "Your maintenance is BMR × activity. A moderate deficit (~300–500 kcal) loses fat steadily; a small surplus (~200–300 kcal) builds muscle with minimal fat. Bigger isn't better — it just adds fat or muscle loss.",
      "Takeaway: pick a target you can actually hold for months, not a crash you'll quit in two weeks.",
    ],
    cta: { label: "See your targets", href: "/nutrition" },
  },
  {
    id: "nut-protein",
    category: "nutrition",
    title: "Protein — the priority macro",
    summary: "What it does and how much you actually need.",
    body: [
      "Protein builds and preserves muscle, keeps you full, and costs the most energy to digest. In a deficit it's what protects your muscle while you lose fat.",
      "A solid target is ~1.6–2.2 g per kg of bodyweight per day (roughly 0.7–1 g per lb). Spread it across 3–4 meals for steady muscle-building signals.",
      "Takeaway: hit protein first each day; the other macros are easier to flex around it.",
    ],
  },
  {
    id: "nut-carbs",
    category: "nutrition",
    title: "Carbs — your training fuel",
    summary: "Not the enemy — the fuel that powers hard sessions.",
    body: [
      "Carbs are your body's preferred fuel for intense training. They top up muscle glycogen, so harder sessions and better pumps usually track with eating enough of them.",
      "Favor mostly whole sources — rice, potatoes, oats, fruit — and time more of them around training when you can. Carb needs scale with how active and how lean you are.",
      "Takeaway: cutting cards to zero isn't required to lose fat; total calories and protein matter more.",
    ],
  },
  {
    id: "nut-fats",
    category: "nutrition",
    title: "Fats — hormones & health",
    summary: "Essential, calorie-dense, easy to over- or under-do.",
    body: [
      "Dietary fat supports hormone production (including testosterone) and absorbs key vitamins. Going too low for too long can blunt both, so keep a floor.",
      "Aim for roughly 0.6–1 g per kg of bodyweight, leaning on quality sources — olive oil, nuts, eggs, fatty fish. At 9 kcal/g it's calorie-dense, so portions add up fast.",
      "Takeaway: set protein and fat to sensible minimums, then let carbs fill the rest of your calories.",
    ],
  },
  {
    id: "nut-hydration",
    category: "nutrition",
    title: "Hydration & the basics that compound",
    summary: "Water, fiber, and consistency beat any supplement.",
    body: [
      "Even mild dehydration drops strength, focus, and appetite control. A simple target is ~35 ml per kg of bodyweight, more on hard training days — the Nutrition tab tracks it for you.",
      "Fiber from vegetables and fruit keeps digestion and fullness in check. And nothing beats consistency: a decent plan followed daily outperforms a perfect plan you abandon.",
      "Takeaway: drink water, eat your veggies, hit protein, repeat. The fundamentals are boring and they work.",
    ],
    cta: { label: "Track hydration", href: "/nutrition" },
  },
];
