# Vox

Simulate how diverse user personas experience your product. Paste a PRD, run it against realistic archetypes, and get a structured report showing where users get stuck, what confuses them, and what regresses.

## Quick Start

```bash
npm install
npm run db:migrate
npm run dev
```

Dashboard opens at `http://localhost:3000`. It's read-only -- simulations are run via the `/vox` Claude Code skill or programmatically.

## How It Works

Vox runs a three-phase simulation pipeline:

```
PRD + Current State
       |
       v
  [1] EXTRACT ---- Claude decomposes text into ordered touchpoints
       |
       v
  [2] TRAVERSE --- Each persona walks through each touchpoint
       |           Claude responds AS the persona, scoring comprehension,
       |           trust, and deciding whether to proceed or abandon
       v
  [3] REPORT ----- Analyzer computes dropout funnel, comprehension heatmap,
                   and objection rankings. Claude writes the comparison report.
```

Every simulation compares **current state** vs **proposed state** against the same persona cohort. The report flags regressions -- places where the proposed experience is worse.

## Running a Simulation

### Via Claude Code Skill

```
/vox
```

This walks you through: paste PRD, describe current state, review extracted touchpoints, select or generate personas, run, and view results.

### Programmatically

```typescript
import { createSimulation, runSimulation } from "@/engine/orchestrator";
import { syncPersonasToDb } from "@/personas/manager";

// Sync persona YAML files to the database first
syncPersonasToDb("personas", db);

const simId = await createSimulation({
  name: "Checkout Redesign v2",
  prdText: "## Proposed: single-page checkout with...",
  currentStateDescription: "Current checkout is a 5-step wizard...",
  currentStateMetrics: { conversion: "12%", support_tickets: "~50/week" },
  targetMetrics: ["conversion", "support_tickets"],
});

await runSimulation(simId);
// -> status: extracting -> running -> completed
// -> report saved to `reports` table
// -> view at http://localhost:3000/simulation/{simId}
```

## Personas

Personas are YAML files in `personas/`. They are the source of truth -- SQLite is a derived index.

```yaml
# personas/defi/crypto-novice-marcus.yaml
id: crypto-novice-marcus
name: Marcus Chen
version: 1
domain: defi

domain_literacy: low
mental_model: >
  Thinks USDC is the same everywhere. Doesn't understand that
  "USDC on Arbitrum" is different from "USDC on Ethereum."
misconceptions:
  - "Bridging is like sending to another wallet"
  - "Gas fees are the same on every chain"
task: "Bridge 100 USDC from Ethereum to Arbitrum"
entry_context: "Clicked a link from a friend who said Arbitrum is cheaper"

patience: low
risk_tolerance: low
reads_tooltips: true
abandons_when: "Sees unfamiliar terminology or unexpected fees"

age: 28
profession: "Graphic designer"
tech_comfort: medium

history:
  - date: "2026-04-01"
    change: "Initial creation from DeFi cohort generation"
```

**Key fields that drive simulation behavior:**

| Field | What it does |
|-------|-------------|
| `mental_model` | How the persona thinks the product works. Drives realistic misunderstandings. |
| `misconceptions` | Specific wrong beliefs. Claude uses these to generate confusion signals. |
| `abandons_when` | Trigger for dropout. When this condition is met, `wouldProceed` becomes false. |
| `domain_literacy` | low/medium/high. Affects how the persona interprets jargon. |
| `patience` | low/medium/high. Low-patience personas abandon faster. |

### Creating Personas

Use the `/vox` skill and select "Work on personas":

- **Generate cohort** -- describe your domain, get 4-6 spanning the literacy spectrum
- **Import from research** -- paste transcripts, tickets, or feedback
- **Interview** -- Claude asks questions one at a time to build a single persona
- **Refine** -- share new observations, Claude proposes field updates, version increments

## Dashboard

The dashboard is strictly read-only. No simulation execution or persona editing.

### Pages

| Page | URL | Shows |
|------|-----|-------|
| Simulation List | `/` | All simulations with status, persona count, completion rate |
| Simulation Detail | `/simulation/[id]` | Report, dropout funnel chart, comprehension heatmap, comparison table |
| Compare | `/compare` | Select two simulations, see side-by-side delta table |
| Persona Library | `/personas` | Browse personas grouped by domain |

### Charts

- **Dropout funnel** -- horizontal bar chart showing how many personas are still active at each touchpoint
- **Comprehension heatmap** -- color grid (red 1 to green 5) of comprehension scores per touchpoint per persona
- **Comparison table** -- current vs proposed scores with delta indicators

## Project Structure

```
src/
  engine/           # Core simulation logic (zero web framework deps)
    extractor.ts    # PRD text -> ordered touchpoints (via Claude)
    traversal.ts    # Persona x touchpoint -> events (via Claude)
    analyzer.ts     # Events -> dropout funnel, heatmap, objections
    reporter.ts     # Analyzer results -> markdown report (via Claude)
    orchestrator.ts # Ties it all together: extract -> traverse -> report
  personas/
    schema.ts       # Zod validation schema for persona YAML
    manager.ts      # Load, save, version, sync to SQLite
  db/
    schema.ts       # Drizzle table definitions (6 tables)
    index.ts        # SQLite connection
  app/              # Next.js dashboard (read-only)
    api/            # REST endpoints
personas/           # YAML persona files (source of truth, git-tracked)
skills/             # Claude Code skill definitions
data/               # Runtime SQLite database (gitignored)
```

**Engine isolation:** `src/engine/` imports only Anthropic SDK, Drizzle, and Node standard library. No Next.js, no React. This means the engine is testable in isolation and callable from both API routes and Claude Code skills.

## Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server (port 3000) |
| `npm run build` | Production build |
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run test` | Run test suite (60 tests) |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | Biome linter |
| `npm run check` | Lint + auto-fix |

## Tech Stack

- **Runtime:** TypeScript, Node.js
- **Framework:** Next.js 15 (App Router, React Server Components)
- **Database:** SQLite via Drizzle ORM + better-sqlite3
- **LLM:** Anthropic SDK (Claude)
- **UI:** Tailwind CSS, shadcn/ui, Recharts
- **Validation:** Zod
- **Testing:** Vitest
- **Linting:** Biome (strict, no `any` types)

## Data Flow

```
Persona YAML files (source of truth)
       |
       | syncPersonasToDb()
       v
SQLite personas table (derived index)
       |
       | runSimulation()
       v
SQLite events table (one row per persona x touchpoint interaction)
       |
       | analyzer functions
       v
Dropout funnel, comprehension heatmap, objection rankings
       |
       | generateReport()
       v
SQLite reports table (markdown)
       |
       | dashboard
       v
Browser: charts, tables, rendered report
```

## Requirements

- Node.js 22+
- Anthropic API key (set `ANTHROPIC_API_KEY` or use Claude Code session)
