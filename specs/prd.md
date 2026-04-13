# Vox — PRD

**Date:** 2026-04-12
**Status:** Draft

## What This Is

Vox simulates how diverse user personas experience product touchpoints and reports friction, comprehension gaps, regressions, and metric impact — structured for action. Local-only tool for product teams.

## User Stories

### US-1: Run a simulation against a PRD

**As a** PM, **I want to** paste a PRD and current state description, **so that** I get a structured comparison of how personas experience current vs proposed flows.

**Acceptance Criteria:**
- Can paste PRD text and current state description
- Claude extracts touchpoints for both current and proposed states
- Can review/adjust touchpoints before running
- Simulation runs each persona through each touchpoint sequentially
- Each persona has isolated context (no cross-persona state leakage)
- Persona abandons flow when `wouldProceed` is false
- Report generated with executive summary, baseline, proposed results, delta table, regressions, and recommendations

### US-2: Manage personas

**As a** PM, **I want to** create, browse, refine, and version personas, **so that** I build a reusable library of realistic user archetypes.

**Acceptance Criteria:**
- Generate a cohort (4-6 personas) from a domain description
- Create a single persona via guided interview
- Import personas from research data (transcripts, tickets, feedback)
- Refine an existing persona with new observations (version increments, history logged)
- Browse persona library by domain
- YAML files are source of truth; SQLite is a derived index

### US-3: View simulation results in dashboard

**As a** PM, **I want to** view simulation results in a web dashboard, **so that** I can visualize funnels, heatmaps, and comparisons.

**Acceptance Criteria:**
- Home page: simulation list with name, date, persona count, touchpoint count, completion rate
- Detail page: rendered report, dropout funnel chart, comprehension heatmap, metric impact summary, current vs proposed table
- Comparison page: select two simulations, side-by-side delta table, overlay charts
- Persona library page: browse by domain, view definition + version history + simulation usage
- Dashboard is strictly read-only (no simulation execution or persona editing)

### US-4: Compare simulations over time

**As a** PM, **I want to** compare results across simulation runs, **so that** I can track whether PRD revisions are improving outcomes.

**Acceptance Criteria:**
- Cross-simulation comparison matches touchpoints by content similarity
- Delta table shows score changes per touchpoint per persona
- Summary: improved / regressed / unchanged / new
- Trend queries: comprehension and dropout over time per persona segment

### US-5: Launch dashboard

**As a** PM, **I want to** run `npx vox` to start the dashboard, **so that** I can view results without setup.

**Acceptance Criteria:**
- Single command starts Next.js server and opens browser
- SQLite database auto-creates on first run
- No manual configuration required beyond having Claude Code running

## Out of Scope (v1)

- Hosted/cloud deployment
- Multi-user collaboration or auth
- Non-Claude LLM support
- Real-time simulation streaming in dashboard
- Persona marketplace/sharing
- CI/CD integration
- A/B test result ingestion

## Dependencies

- Anthropic SDK (Claude API via Claude Code session)
- SQLite (better-sqlite3, local file)
- No external services or APIs beyond Claude

## Verification Criteria

The build is done when:
1. A simulation can be created from a PRD + current state description
2. Touchpoints are extracted for both current and proposed states
3. Personas traverse touchpoints with isolated context, producing structured events
4. A comparison report is generated with delta table and regression flags
5. Dashboard displays simulation list, detail with charts, and comparison view
6. Personas can be created, refined, versioned, and browsed
7. `npx vox` starts the dashboard
8. All code passes `npm run typecheck` and `npm run lint`
