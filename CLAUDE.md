# Flowstate AI — Claude Instructions

## Context Navigation

Before reading any file in this project, follow this order:

1. **Start here:** Read `brain-graph.md` in the project root — it's a compact map of every doc, route, key file, and rule. Read this instead of individual files whenever possible.
2. **Then check memory:** Review `~/.claude/projects/-Users-xavierellis-Projects-flowstate-ai/memory/MEMORY.md` for decisions and patterns not in the code.
3. **Only read raw files** when the task requires actual implementation details, or the user explicitly says "read the file."
4. **Keep the graph updated:** After adding or changing a doc, update `brain-graph.md` to reflect it. This is the Obsidian brain — it must stay current.

## Project Overview

Flowstate AI is a fitness coaching platform. Key concepts to always keep in mind:

- **Dual-mode app:** runs in demo mode (localStorage) OR with real Supabase — always handle both
- **Role hierarchy:** `member < client < trainer < master` — use `hasAccess()` from `src/lib/roles.ts`
- **Plan tiers:** `foundation < training < performance < coaching` — use `planHasAccess()` from `src/lib/plans.ts`
- **Post-login routing:** always goes through `resolvePostLoginRoute()` in `src/lib/routing.ts` — never add redirects outside this
- **UUID guard:** `UUID_RE.test(userId) && process.env.NEXT_PUBLIC_SUPABASE_URL` — always check before Supabase calls

## Stack

Next.js 16 App Router · TypeScript 5 · React 19 · Supabase · OpenAI gpt-4o · Stripe · Tailwind v4 · shadcn/ui

## What to Save to Memory

After each session, if you learned something that would save re-reading time next session, save it:
- Architectural decisions and why they were made
- Constraints or requirements the user mentioned
- Non-obvious patterns or workarounds
- Features in progress or planned

Do NOT save: code snippets, file contents, anything already in the code itself.
