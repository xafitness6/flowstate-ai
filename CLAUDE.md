# Flowstate AI — Claude Instructions

## Context Navigation

Before reading any file in this project, check memory first:

1. **Start here:** Review the memory index at `~/.claude/projects/-Users-xavierellis-Projects-flowstate-ai/memory/MEMORY.md`
2. **Load relevant memories** before exploring the codebase — architecture, patterns, auth, and data models are all documented
3. **Only read raw files** when the task requires seeing actual implementation details, or when the user explicitly says "read the file"
4. **After learning something non-obvious** (a decision, a pattern, a constraint), save it to memory so future sessions benefit

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
