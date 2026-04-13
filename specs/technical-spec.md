# Vox (formerly known as Pufferfish V2) — Design Spec

**Date:** 2026-04-12
**Status:** Draft
**Goal:** Rebuild vox from scratch as a lean product experience simulation tool.

---

## Problem

Before shipping a feature, product teams need to know where users will get stuck. Real user testing is slow and expensive. Prompting Claude ad-hoc gives narrative opinions, not structured, repeatable, diffable results.

vox simulates how diverse user personas experience product touchpoints and reports friction, comprehension gaps, regressions, and metric impact — structured for action.

## Non-Goals

- Hosted/multi-tenant deployment (v1 is local-only)
- Social media simulation (the OASIS/MiroFish use case is dropped)
- Supporting non-Claude LLM providers

---

## Architecture

### Stack

- **Language:** TypeScript
- **Framework:** Next.js (App Router)
- **Database:** SQLite via Drizzle ORM
- **LLM:** Anthropic SDK (Claude only)
- **Distribution:** `npx vox` (dashboard), Claude Code skills (simulation)

### Project Structure

```
vox/
├── src/
│   ├── app/                  # Next.js App Router (dashboard UI)
│   │   ├── page.tsx                  # Simulation list / home
│   │   ├── simulation/[id]/          # Simulation detail + report
│   │   ├── compare/                  # Side-by-side comparison view
│   │   ├── personas/                 # Persona library browser
│   │   └── api/                      # Read-only API routes for dashboard
│   ├── engine/               # Core simulation logic (no web deps)
│   │   ├── extractor.ts              # Product artifact -> touchpoints
│   │   ├── traversal.ts              # Persona x touchpoint -> events
│   │   ├── analyzer.ts              # Aggregation functions
│   │   └── reporter.ts              # Report generation via Claude
│   ├── personas/             # Persona schema, validation, versioning
│   │   ├── schema.ts                # Zod schema for persona files
│   │   └── manager.ts               # Load, save, version, diff
│   └── db/                   # SQLite persistence
│       ├── schema.ts                 # Drizzle table definitions
│       └── index.ts                  # Connection + migrations
├── personas/                 # Default persona libraries (YAML, git-tracked)
│   └── defi/
│       ├── crypto-novice-marcus.yaml
│       ├── intermediate-sofia.yaml
│       ├── crypto-native-alex.yaml
│       └── enterprise-priya.yaml
├── data/                     # Runtime data (gitignored)
│   └── vox.db
├── skills/                   # Claude Code skill definitions
│   ├── vox.md
│   └── vox-dashboard.md
└── package.json
```

### Key Constraint: Engine Independence

`src/engine/` has zero web framework dependencies. It imports only the Anthropic SDK, Drizzle (for persistence), and standard library. This means:

- Testable in isolation
- Callable from Claude Code skills directly
- Callable from API routes
- No coupling to Next.js

---

## Data Models

### Persona (YAML file + SQLite index)

Personas are the first-class, reusable, refinable artifacts. They live as YAML files on disk (human-readable, git-trackable) and are indexed in SQLite for dashboard queries.

```yaml
id: crypto-novice-marcus
name: Marcus Chen
version: 3
domain: defi

# Core behavioral fields
domain_literacy: low              # low | medium | high
mental_model: >
  Thinks USDC is the same everywhere. Doesn't understand that
  "USDC on Arbitrum" is different from "USDC on Ethereum."
  Confuses gas fees with bridge fees.
misconceptions:
  - "Bridging is like sending to another wallet"
  - "Gas fees are the same on every chain"
task: "Bridge 100 USDC from Ethereum to Arbitrum"
entry_context: "Clicked a link from a friend who said Arbitrum is cheaper"

# Behavioral traits
patience: low                     # low | medium | high
risk_tolerance: low
reads_tooltips: true
abandons_when: "Sees unfamiliar terminology or unexpected fees"

# Demographics (optional)
age: 28
profession: "Graphic designer"
tech_comfort: medium

# Refinement log
history:
  - date: 2026-04-01
    change: "Initial creation from DeFi cohort generation"
  - date: 2026-04-10
    change: "Updated mental_model: added gas vs bridge fee confusion from user research"
```

**Structured fields matter.** `mental_model` and `misconceptions` are what drive realistic failures during simulation. `abandons_when` tells the engine when to trigger dropout. These aren't freeform prompt text — they're surgical fields Claude can update individually during refinement.

### Touchpoint

The unit of user interaction. Replaces the concept of "screen" — a touchpoint is any moment a user encounters the product: a UI screen, API endpoint, CLI command, docs page, error message, MCP tool, pricing tier, onboarding step.

```yaml
id: route-selection
type: screen                      # screen | endpoint | command | tool | error | docs | message
name: "Route Selection"
order: 2
content: >
  User sees 3 bridging routes: Fast (2min, $4.50),
  Standard (10min, $1.20), Economy (30min, $0.40).
  Each shows estimated time and fee.
available_actions:
  - select_route
  - go_back
  - read_tooltip
requires_prior_knowledge:
  - "What a bridge route is"
  - "Relationship between speed and cost"
critical_path_metrics:            # which metrics this touchpoint affects
  - conversion
```

### Traversal Event

One per persona x touchpoint interaction. The atomic unit of simulation data.

```typescript
interface TraversalEvent {
  simulationId: string
  personaId: string
  personaVersion: number
  touchpointId: string
  touchpointOrder: number
  comprehensionScore: number      // 1-5
  trustScore: number              // 1-5
  wouldProceed: boolean
  confusionSignal: string | null
  actionTaken: string
  reasoning: string               // Claude's chain-of-thought as the persona
  timeOnScreen: "quick" | "normal" | "long" | "very_long"
  metricImpacts: MetricImpact[]
  timestamp: Date
}

interface MetricImpact {
  metric: string                  // "conversion", "activation", etc.
  impact: "none" | "low" | "medium" | "high"
  reasoning: string               // "User abandons before reaching payment"
}
```

### Simulation

A simulation always contains two runs: current state and proposed state, against the same persona cohort.

```typescript
interface Simulation {
  id: string
  name: string                    // user-provided or derived from PRD
  prdText: string
  currentStateDescription: string
  currentStateMetrics: Record<string, string>  // e.g. { conversion: "12%", support_tickets: "~50/week" }
  targetMetrics: string[]         // what the PRD is optimizing for
  status: "extracting" | "ready" | "running" | "completed" | "failed"
  createdAt: Date
}
```

---

## SQLite Schema

```
simulations
  id TEXT PRIMARY KEY
  name TEXT
  prd_text TEXT
  current_state_description TEXT
  current_state_metrics TEXT          -- JSON
  target_metrics TEXT                 -- JSON array
  status TEXT
  created_at DATETIME

touchpoints
  id TEXT PRIMARY KEY
  simulation_id TEXT REFERENCES simulations
  run_type TEXT                       -- "current" | "proposed"
  type TEXT                           -- screen, endpoint, command, etc.
  name TEXT
  order INTEGER
  content TEXT
  available_actions TEXT              -- JSON array
  requires_prior_knowledge TEXT       -- JSON array
  critical_path_metrics TEXT          -- JSON array

simulation_personas
  simulation_id TEXT REFERENCES simulations
  persona_id TEXT
  persona_version INTEGER
  PRIMARY KEY (simulation_id, persona_id)

events
  id TEXT PRIMARY KEY
  simulation_id TEXT REFERENCES simulations
  run_type TEXT                       -- "current" | "proposed"
  persona_id TEXT
  touchpoint_id TEXT REFERENCES touchpoints
  touchpoint_order INTEGER
  comprehension_score INTEGER
  trust_score INTEGER
  would_proceed BOOLEAN
  confusion_signal TEXT
  action_taken TEXT
  reasoning TEXT
  time_on_screen TEXT
  metric_impacts TEXT                 -- JSON array
  timestamp DATETIME

reports
  id TEXT PRIMARY KEY
  simulation_id TEXT REFERENCES simulations
  markdown TEXT
  generated_at DATETIME

personas
  id TEXT PRIMARY KEY
  name TEXT
  domain TEXT
  version INTEGER
  file_path TEXT
  literacy TEXT
  created_at DATETIME
  updated_at DATETIME
```

---

## Engine Design

### extractor.ts — Product Artifact to Touchpoints

Takes any text description of a product experience (PRD, API docs, CLI help, onboarding flow) and calls Claude to decompose it into an ordered sequence of touchpoints.

Called twice per simulation: once for the current state description, once for the proposed state from the PRD. Both produce touchpoint sequences with stable IDs so they can be matched for comparison.

**Input:** text description + target metrics
**Output:** ordered list of touchpoints, each tagged with type and critical-path metrics

### traversal.ts — The Core Simulation Loop

Runs each persona through each touchpoint sequentially. This is where context isolation is enforced.

```
for each persona in cohort:
  memory = []                              // fresh per persona, per run
  for each touchpoint in sequence:
    event = await claude.call({
      system: persona system prompt,       // mental_model, misconceptions, task, etc.
      context: memory,                     // only THIS persona's prior events
      touchpoint: touchpoint content + available actions,
      metrics: target metrics
    })
    memory.push(event)
    await db.saveEvent(event)
    if (!event.wouldProceed) break         // persona abandoned
```

**Isolation guarantees:**
- Each persona gets its own `memory` array, initialized empty at the start of each run.
- No shared state between personas within a run.
- No state carries over between simulation runs.
- The Claude call for persona A never sees persona B's events.
- Persona definitions are read-only during simulation — the YAML file is not modified.

### analyzer.ts — Aggregation Functions

Three pure functions that query the events table:

- **`getDropoutFunnel(simulationId, runType)`** — touchpoint-by-touchpoint dropout rate. How many personas were still active at each step.
- **`getComprehensionHeatmap(simulationId, runType)`** — average comprehension and trust scores per touchpoint per persona. Grid of touchpoints x personas.
- **`getObjectionsByCohort(simulationId, runType)`** — confusion signals grouped by persona, ranked by frequency. What confused whom, and how often.

All three accept an optional `runType` filter ("current" | "proposed") and work across both runs for comparison.

### reporter.ts — Report Generation

Calls the three analyzer functions for both current and proposed runs, feeds results to Claude with a report template. Output is structured markdown.

**Report structure:**

```markdown
## Executive Summary
One paragraph: what the PRD changes, how it performs vs current state.

## Target Metrics
What success looks like, as defined by the user.

## Current State Baseline
Task completion rates, key friction points, dropout funnel.

## Proposed State Results  
Task completion rates, key friction points, dropout funnel.

## Comparison: Current vs Proposed
Delta table: touchpoint x persona, scores + change direction.
Regressions flagged with warnings.

## Top Friction Points (Proposed)
Ranked by metric impact, not just comprehension score.

## Regressions Introduced
Anything that got WORSE in the proposed state. Flagged prominently.

## Recommendations
Specific, actionable fixes tied to findings.
```

---

## Persona Management

### Creation Flows

All flows produce the same structured YAML file + SQLite index entry.

**1. Generate cohort from context**
User says "I'm building a DeFi bridge." Claude proposes 4-6 personas spanning the literacy spectrum, each with domain-specific mental models and misconceptions. User reviews, adjusts, approves. Files are written.

**2. Interview-based creation**
Claude asks questions one at a time to define a single persona:
- What domain is this for?
- What's their technical background?
- What are they trying to accomplish?
- What misconceptions might they have?
- When do they give up?

Each answer populates a specific field in the persona schema.

**3. Import from research data**
User pastes interview transcripts, support tickets, analytics segments, or user feedback. Claude extracts personas with real mental models and misconceptions grounded in actual user behavior.

**4. Persona suggestion during simulation setup**
When a user pastes a PRD, Claude analyzes the domain and suggests a cohort. User can accept, modify, import existing personas, or create new ones.

### Refinement

User shares what they've learned about a persona — observations, data, updated understanding. Claude proposes specific field updates (e.g., "update `misconceptions` to remove the gas fee item, add slippage confusion"). User approves. Version increments, change is logged in the `history` array.

### Versioning

- Persona YAML files contain a `version` field and `history` array.
- Each simulation records which persona version was used (`simulation_personas.persona_version`).
- Old versions are not deleted — the history log tracks what changed and when.
- YAML files on disk always reflect the latest version. SQLite `personas.version` mirrors this.
- **YAML is the source of truth.** SQLite is a derived index. On startup and after any persona write, the manager syncs YAML to SQLite. If they conflict, YAML wins.

---

## Comparison System

### Run-Level Comparison (Current vs Proposed)

Every simulation automatically compares current state against proposed state. The report includes a delta table:

```
Touchpoint: Route Selection
                    Current    Proposed    Delta
Marcus (novice)     1/5 ABANDON  3/5 PROCEED  +2, unblocked
Sofia (mid)         3/5 PROCEED  4/5 PROCEED  +1
Alex (expert)       5/5 PROCEED  5/5 PROCEED  no change
Priya (enterprise)  4/5 PROCEED  2/5 ABANDON  -2, REGRESSION
```

### Cross-Simulation Comparison (v1 vs v2 of a PRD)

When the user runs a second simulation after revising their PRD, the dashboard can compare the proposed states across simulations. Touchpoints are matched by content similarity (Claude identifies which touchpoints correspond between versions).

### Trend Tracking

All simulation results accumulate in SQLite. The dashboard can query:
- All simulations grouped by PRD name
- Comprehension and dropout trends over time per persona segment
- Metric impact trends (are we getting closer to target metrics?)

---

## Skill Design

### `/vox` — Primary Skill

Single entry point for all conversational interaction.

```
/vox

1. "What would you like to do?"
   ├── Test a PRD
   ├── Work on personas
   └── Open dashboard

2. [Test a PRD]
   a. User pastes or imports PRD
   b. Claude scans PRD for metrics/goals
      → If found: confirms ("I see you're optimizing for X — correct?")
      → If missing: prompts ("What metrics matter for this?")
   c. Claude prompts for current state:
      → "Describe the current experience/flow"
      → "Share any current metrics (conversion rate, drop-off %, etc.)"
      → "Any known pain points or user feedback?"
      → Accepts text, data, screenshots — whatever the user has
   d. Claude extracts touchpoints for current AND proposed states
   e. User reviews touchpoints → adjust, reorder, add, remove, approve
   f. Claude suggests persona cohort based on domain analysis
      → Accept suggestions as-is
      → Modify individual personas
      → Import existing personas from library
      → Create new personas via interview
   g. Confirm and run simulation (both current + proposed)
   h. Report generated: baseline → proposed → delta → regressions
   i. Offer to open dashboard for full visualization

3. [Work on personas]
   a. Generate cohort from context ("I'm building X for Y audience")
   b. Import from research (transcripts, tickets, analytics, feedback)
   c. Create single persona via interview
   d. Refine existing persona with new observations/data
   e. Browse/list persona library

4. [Open dashboard]
   → Starts server if not running
   → Opens browser to localhost:3000
```

### `/vox-dashboard` — Dashboard Lifecycle

Starts or stops the dashboard web server.

```
/vox-dashboard
  → Start: runs `next start`, opens browser
  → Stop: kills the server process
  → Status: shows if server is running + URL
```

---

## Dashboard UI

Read-only Next.js application. No simulation execution, no persona editing — purely visualization.

### Pages

**Home — Simulation List**
- Table: simulation name, date, persona count, touchpoint count, completion rate
- Badge: improvement/regression vs previous run of same PRD
- Quick filters by domain, date range

**Simulation Detail**
- Full report (rendered markdown)
- Dropout funnel chart (bar: touchpoint x dropout %)
- Comprehension heatmap (color grid: touchpoints x personas, 1-5 scale)
- Metric impact summary (which frictions threaten which metrics)
- Current vs proposed comparison table

**Comparison View**
- Select two simulations to compare
- Side-by-side delta table (touchpoint x persona, score changes)
- "Improved / Regressed / Unchanged / New" summary
- Overlay charts (funnel comparison, heatmap diff)

**Persona Library**
- Browse personas by domain
- Click into persona: current definition, version history, simulation usage
- No editing — editing happens via `/vox` skill

### Charts

- **Dropout funnel:** horizontal bar chart, one bar per touchpoint, length = % still active
- **Comprehension heatmap:** grid, rows = touchpoints, columns = personas, cells color-coded green (5) to red (1)
- **Trend line:** comprehension/dropout over time for a given PRD + persona combination

---

## Distribution

### For Users (PMs)

```bash
npx vox
```

Single command. Downloads package from npm, starts Next.js dashboard, opens browser. No global install.

Simulation execution requires Claude Code with the `/vox` skill installed (via the skills directory in the package or a Claude Code plugin).

### For Contributors

```bash
git clone <repo>
cd vox
npm install
npm run dev
```

Standard Next.js development setup. Dashboard at `localhost:3000`.

### First-Run Setup

On first launch, the `/vox` skill checks for:
- Anthropic API key availability (via Claude Code session)
- `personas/` directory existence
- SQLite database existence (auto-creates if missing via Drizzle migrations)

No manual configuration required beyond having Claude Code running.

---

## What's NOT in v1

- Hosted/cloud deployment
- Multi-user collaboration
- Authentication or access control
- Non-Claude LLM support
- Real-time simulation streaming in the dashboard
- Persona marketplace/sharing
- CI/CD integration (run simulations on PRD changes)
- A/B test result ingestion (feeding real data back automatically)
