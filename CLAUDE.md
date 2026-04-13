# Vox — Claude Code Instructions

## What This Is

Product experience simulation tool that tests how diverse user personas experience product touchpoints. TypeScript, Next.js 15 (App Router), SQLite via Drizzle ORM, Anthropic SDK. Local-only.

## Project Structure

- `src/app/` — Next.js App Router (dashboard UI, read-only)
- `src/engine/` — Core simulation logic (zero web framework deps)
- `src/personas/` — Persona Zod schema and manager
- `src/db/` — Drizzle schema and SQLite connection
- `personas/` — Default persona YAML files (source of truth, git-tracked)
- `data/` — Runtime SQLite database (gitignored)
- `skills/` — Claude Code skill definitions
- `specs/` — Design specs

## Commands

| Task | Command |
|------|---------|
| Install | `npm install` |
| Dev | `npm run dev` |
| Build | `npm run build` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Format | `npm run format` |
| Auto-fix | `npm run check` |
| DB generate | `npm run db:generate` |
| DB migrate | `npm run db:migrate` |

### Verification Checklist

Before reporting any task as complete, all must pass:

```bash
npm run typecheck
npm run lint
```

## Constraints

- MUST use TypeScript strict mode — NEVER weaken tsconfig flags.
- MUST NOT use `any` type. Use `unknown` + narrowing or generics.
- MUST NOT disable or weaken Biome rules. `noExplicitAny` is an error.
- MUST run the verification checklist before reporting any task as complete.
- MUST keep `src/engine/` free of web framework dependencies. Only imports: Anthropic SDK, Drizzle, standard library.
- MUST treat persona YAML files as source of truth. SQLite `personas` table is a derived index. If they conflict, YAML wins.
- MUST NOT modify persona YAML files during simulation runs.
- MUST NOT add simulation execution or persona editing to the dashboard UI. Dashboard is read-only.
- MUST use `@/*` path alias for imports from `src/`.
- MUST NOT run `git commit` directly — stage files and provide the commit command for the user to run.
