# Tasks

### Task 1: Persona schema + manager

**Size:** S

**What:** Define the Zod validation schema for persona YAML files and build the manager module that loads, saves, versions, and syncs personas between YAML files and SQLite.

**Where:**
- `src/personas/schema.ts` — new file: Zod schema matching the persona YAML structure (id, name, version, domain, domain_literacy, mental_model, misconceptions, task, entry_context, patience, risk_tolerance, reads_tooltips, abandons_when, age, profession, tech_comfort, history)
- `src/personas/manager.ts` — new file: functions to load persona from YAML, save persona to YAML, increment version with history entry, sync all YAML files to SQLite `personas` table, resolve conflicts (YAML wins)
- `src/db/schema.ts` — existing, no changes needed (personas table already defined)
- `src/db/index.ts` — existing, imported by manager

**Behavior:**
- Happy path: `loadPersona(path)` parses a persona YAML file and returns a validated object. `syncPersonasToDb()` reads all YAML files from `personas/` subdirectories and upserts into SQLite. Tests use synthetic YAML fixtures created in a temp directory.
- Edge case: YAML file fails Zod validation — throws descriptive error with field path
- Edge case: YAML version > SQLite version — SQLite updated to match (YAML wins)
- Error case: YAML file doesn't exist — throws with file path in message

**Done when:**
- [ ] Test: load a valid persona YAML and get a typed object back
- [ ] Test: invalid YAML (missing required field) throws ZodError
- [ ] Test: syncPersonasToDb writes all personas from `personas/` dir to SQLite
- [ ] Test: saving a persona increments version and appends to history
- [ ] Verification checklist passes

---

### Task 2: Extractor — PRD to touchpoints

**Size:** M

**What:** Build the extractor module that takes a text description of a product experience and calls Claude to decompose it into an ordered sequence of typed touchpoints. Called twice per simulation (current state + proposed state).

**Where:**
- `src/engine/extractor.ts` — new file: `extractTouchpoints(text: string, targetMetrics: string[])` function that calls Claude API with a structured prompt, parses response into touchpoint objects, and returns them
- `src/db/schema.ts` — existing, touchpoints table already defined

**Behavior:**
- Happy path: given PRD text and target metrics, returns an ordered array of touchpoints with id, type, name, order, content, available_actions, requires_prior_knowledge, critical_path_metrics
- Edge case: Claude returns malformed JSON — retry once, then throw with raw response for debugging
- Edge case: empty text input — throw descriptive error before calling Claude
- Error case: Anthropic API key not available — throw with clear setup instructions

**Done when:**
- [ ] Test: given sample PRD text, returns array of touchpoints matching the schema
- [ ] Test: each touchpoint has a stable id, type, and order
- [ ] Test: empty input throws before making API call
- [ ] Verification checklist passes

---

### Task 3: Traversal — core simulation loop

**Size:** M
**Depends on:** Task 1 (persona types), Task 2 (touchpoint types)

**What:** Build the traversal module that runs each persona through each touchpoint sequentially with isolated context, producing TraversalEvent records. This is the core simulation engine.

**Where:**
- `src/engine/traversal.ts` — new file: `runTraversal(simulationId: string, runType: "current" | "proposed", personas: Persona[], touchpoints: Touchpoint[])` that loops persona × touchpoint, calls Claude as each persona, saves events to SQLite
- `src/db/schema.ts` — existing, events table already defined

**Behavior:**
- Happy path: each persona traverses touchpoints in order, Claude responds as the persona, events are saved. If `wouldProceed` is false, persona stops early (dropout).
- Edge case: persona memory is isolated — each persona gets a fresh context array, no cross-persona leakage
- Edge case: no state carries between simulation runs (current vs proposed)
- Error case: Claude API failure mid-traversal — save partial results, mark simulation as failed

**Done when:**
- [ ] Test: traversal produces one event per persona × touchpoint (or fewer if dropout)
- [ ] Test: persona A's events are never visible to persona B's Claude calls
- [ ] Test: dropout stops traversal for that persona at the correct touchpoint
- [ ] Test: events are persisted to SQLite during traversal (not batched at end)
- [ ] Verification checklist passes

---

### Task 4: Analyzer — aggregation functions

**Size:** S

**What:** Build three pure query functions: dropout funnel, comprehension heatmap, and objections by cohort. All query the events table and accept optional runType filter.

**Where:**
- `src/engine/analyzer.ts` — new file: `getDropoutFunnel()`, `getComprehensionHeatmap()`, `getObjectionsByCohort()` — all accept `(simulationId: string, runType?: "current" | "proposed")`

**Behavior:**
- `getDropoutFunnel`: returns touchpoint-by-touchpoint count of personas still active
- `getComprehensionHeatmap`: returns grid of avg comprehension + trust scores per touchpoint × persona
- `getObjectionsByCohort`: returns confusion signals grouped by persona, ranked by frequency
- Edge case: simulation with zero events — return empty structures, not errors
- Edge case: filter by runType returns only that run's data

**Done when:**
- [ ] Test: dropout funnel shows decreasing counts when personas abandon
- [ ] Test: heatmap returns correct averages for known test data
- [ ] Test: objections groups and ranks confusion signals correctly
- [ ] Test: empty simulation returns empty results without throwing
- [ ] Verification checklist passes

---

### Task 5: Reporter — report generation

**Size:** S
**Depends on:** Task 4 (analyzer functions)

**What:** Build the reporter module that calls all three analyzer functions for both runs, feeds results to Claude with the report template, and saves structured markdown to the reports table.

**Where:**
- `src/engine/reporter.ts` — new file: `generateReport(simulationId: string)` that calls analyzer functions, constructs Claude prompt with report template, saves markdown to `reports` table

**Behavior:**
- Happy path: generates markdown report with all sections (executive summary, baseline, proposed results, comparison delta table, regressions, recommendations)
- Edge case: one run has zero events (all personas abandoned at first touchpoint) — report still generates with appropriate messaging
- Error case: simulation not found — throw with simulation ID

**Done when:**
- [ ] Test: report contains all required sections from the template
- [ ] Test: report includes delta table comparing current vs proposed
- [ ] Test: regressions (score decreases) are flagged in the report
- [ ] Verification checklist passes

---

### Task 6: Simulation orchestrator

**Size:** M
**Depends on:** Tasks 2, 3, 4, 5 (all engine modules)

**What:** Build the top-level simulation workflow that ties together extraction, traversal, and reporting. Manages simulation lifecycle (status transitions) and coordinates the full flow.

**Where:**
- `src/engine/orchestrator.ts` — new file: `createSimulation()` to create the record, `runSimulation(simulationId: string)` to execute the full pipeline (extract → traverse current → traverse proposed → report)
- `src/db/schema.ts` — existing, simulations table already defined

**Behavior:**
- Happy path: creates simulation record, extracts touchpoints for both states, runs traversal for both, generates report, sets status to "completed"
- Edge case: status transitions are enforced (extracting → ready → running → completed)
- Error case: failure at any stage sets status to "failed" with error context preserved

**Done when:**
- [ ] Test: full pipeline from PRD text to completed report
- [ ] Test: simulation status progresses through each stage
- [ ] Test: failure mid-pipeline sets status to "failed"
- [ ] Verification checklist passes

---

### Task 7: Dashboard API routes

**Size:** M
**Depends on:** Task 1 (personas in SQLite), Task 6 (simulations in SQLite)

**What:** Build read-only API routes that the dashboard pages will consume. All routes query SQLite and return JSON.

**Where:**
- `src/app/api/simulations/route.ts` — new file: GET list all simulations
- `src/app/api/simulations/[id]/route.ts` — new file: GET simulation detail + events + report
- `src/app/api/personas/route.ts` — new file: GET list all personas
- `src/app/api/simulations/[id]/compare/route.ts` — new file: GET comparison data for two runs

**Behavior:**
- Happy path: each route returns structured JSON from SQLite
- Edge case: simulation not found — 404 with JSON error body
- Edge case: no simulations exist — return empty array, not error

**Done when:**
- [ ] Test: GET /api/simulations returns array of simulation summaries
- [ ] Test: GET /api/simulations/[id] returns detail with events and report
- [ ] Test: GET /api/simulations/nonexistent returns 404
- [ ] Verification checklist passes

---

### Task 8: Dashboard — simulation list page

**Size:** S

**What:** Build the home page showing a table of all simulations with key stats.

**Where:**
- `src/app/page.tsx` — existing, replace placeholder with simulation list
- `src/app/layout.tsx` — existing, add navigation

**Behavior:**
- Happy path: table shows simulation name, date, persona count, touchpoint count, completion rate, improvement/regression badge
- Edge case: no simulations — show empty state message
- Edge case: simulation in "running" status — show spinner/indicator

**Done when:**
- [ ] Simulations render in a table with all specified columns
- [ ] Empty state shows when no simulations exist
- [ ] Verification checklist passes

---

### Task 9: Dashboard — simulation detail page

**Size:** M

**What:** Build the simulation detail page with rendered report, dropout funnel chart, comprehension heatmap, and current vs proposed comparison table.

**Where:**
- `src/app/simulation/[id]/page.tsx` — new file: detail page with report + charts
- Use recharts for charts (install as dependency)

**Behavior:**
- Happy path: renders report markdown, dropout funnel bar chart, comprehension heatmap grid, metric impact summary, comparison table
- Edge case: simulation not yet completed — show status indicator, no charts
- Edge case: simulation ID not found — show 404 page

**Done when:**
- [ ] Report renders as formatted markdown
- [ ] Dropout funnel displays as horizontal bar chart
- [ ] Comprehension heatmap displays as color-coded grid
- [ ] Comparison table shows current vs proposed delta
- [ ] Verification checklist passes

---

### Task 10: Dashboard — comparison + persona pages

**Size:** M

**What:** Build the cross-simulation comparison page and persona library browser page.

**Where:**
- `src/app/compare/page.tsx` — new file: select two simulations, side-by-side delta table, overlay charts
- `src/app/personas/page.tsx` — new file: browse personas by domain, view definition + version history

**Behavior:**
- Happy path (compare): select two simulations, see delta table per touchpoint × persona, summary of improved/regressed/unchanged
- Happy path (personas): browse by domain, click into persona to see current definition, version history, and simulation usage
- Edge case: fewer than 2 simulations — compare page shows message
- Edge case: no personas — library shows empty state

**Done when:**
- [ ] Comparison page renders delta table for two selected simulations
- [ ] Persona library lists personas grouped by domain
- [ ] Persona detail shows version history and simulation usage
- [ ] Verification checklist passes

---

### Task 11: Claude Code skills

**Size:** S

**What:** Create the `/vox` and `/vox-dashboard` skill definition files.

**Where:**
- `skills/vox.md` — new file: primary skill with the conversational flow from the spec (test PRD, work on personas, open dashboard)
- `skills/vox-dashboard.md` — new file: dashboard lifecycle (start/stop/status)

**Behavior:**
- `/vox` follows the guided flow: test a PRD → extract touchpoints → suggest personas → run simulation → show report
- `/vox-dashboard` starts/stops the Next.js server

**Done when:**
- [ ] Both skill files have valid frontmatter (name, description, allowed-tools)
- [ ] `/vox` covers all three menu paths from the spec
- [ ] Verification checklist passes
