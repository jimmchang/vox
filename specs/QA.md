# QA — Manual Testing (2026-04-12)

## Test Environment

- Node: 22+
- Environment: localhost:3000
- Auth: none (local-only tool)
- LLM: Anthropic API via Claude Code session

---

## 1. Static Analysis

| Check | Command | Result |
|-------|---------|--------|
| Typecheck | `npm run typecheck` | |
| Lint | `npm run lint` | |
| Build | `npm run build` | |

---

## 2. Persona Management

### Load persona from YAML

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Load valid persona YAML | Happy | backend | Returns typed persona object matching Zod schema | | |
| Load YAML with missing required field (no `id`) | Unhappy | backend | ZodError with field path indicating missing field | | |
| Load YAML with invalid enum (`domain_literacy: "expert"`) | Unhappy | backend | ZodError indicating invalid enum value | | |
| Load nonexistent file path | Unhappy | backend | Error thrown with file path in message | | |
| Load YAML with extra unknown fields | Happy | backend | Parses successfully, extra fields stripped | | |

### Save and version persona

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Save persona with updated field | Happy | backend | Version increments by 1, history entry appended with date and change description | | |
| Save persona preserves existing history entries | Happy | backend | All previous history entries remain, new entry appended | | |

### Sync personas to SQLite

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Sync directory with 3 valid personas | Happy | backend | All 3 appear in SQLite `personas` table with correct fields | | |
| Sync empty personas directory | Happy | backend | No rows in `personas` table, no error thrown | | |
| YAML version > SQLite version | Happy | backend | SQLite updated to match YAML (YAML wins) | | |
| SQLite has persona not on disk | Happy | backend | Stale SQLite row removed or left (per implementation), YAML remains source of truth | | |

---

## 3. Touchpoint Extraction

### Extract touchpoints from text

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Extract from sample PRD text | Happy | backend | Ordered array of touchpoints with id, type, name, order, content, available_actions, requires_prior_knowledge, critical_path_metrics | | |
| Extract with target metrics specified | Happy | backend | Touchpoints have critical_path_metrics matching target metrics | | |
| Empty text input | Unhappy | backend | Error thrown before any API call | | |
| Claude returns malformed JSON | Unhappy | backend | Retry once, then throw with raw response included in error | | |

---

## 4. Traversal (Core Simulation)

### Run persona through touchpoints

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Single persona, 3 touchpoints, all proceed | Happy | backend | 3 events saved, all `wouldProceed: true` | | |
| Persona abandons at touchpoint 2 of 4 | Happy | backend | 2 events saved, last event has `wouldProceed: false`, no events for touchpoints 3-4 | | |
| Two personas, same touchpoints | Happy | backend | Each persona's events are independent, persona A context never appears in persona B's Claude calls | | |

### Context isolation

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Persona A sees only own prior events | Happy | backend | Claude call for persona A at touchpoint 3 includes only A's events for touchpoints 1-2 | | |
| No state between current and proposed runs | Happy | backend | Proposed run starts with empty memory for each persona | | |
| Events persist during traversal (not batched) | Happy | backend | After persona A completes, events queryable in SQLite before persona B starts | | |

### Error handling

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Claude API failure mid-traversal | Unhappy | backend | Partial events saved, simulation status set to "failed" | | |

---

## 5. Analyzer Functions

### Dropout funnel

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| 4 personas, 1 drops at step 2, 1 drops at step 3 | Happy | backend | Funnel: step 1=4, step 2=3, step 3=2, step 4=2 | | |
| All personas complete all touchpoints | Happy | backend | Funnel shows same count at every step | | |
| Zero events (empty simulation) | Edge | backend | Returns empty funnel structure, no error | | |
| Filter by runType "proposed" | Happy | backend | Only proposed run events included | | |

### Comprehension heatmap

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Known test data with specific scores | Happy | backend | Averages match expected values per touchpoint × persona cell | | |
| Single persona, single touchpoint | Edge | backend | Grid with one cell, scores equal to that event's scores | | |

### Objections by cohort

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Multiple confusion signals, some repeated | Happy | backend | Grouped by persona, ranked by frequency (most frequent first) | | |
| No confusion signals (all null) | Edge | backend | Returns empty objections, no error | | |

---

## 6. Report Generation

### Generate report

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Complete simulation with both runs | Happy | backend | Markdown contains: executive summary, target metrics, current baseline, proposed results, comparison delta table, regressions, recommendations | | |
| Proposed state has regressions (scores decreased) | Happy | backend | Regressions section flags specific touchpoints + personas with score decreases | | |
| One run has zero events (all abandoned) | Edge | backend | Report generates with appropriate "no data" messaging for that run | | |
| Simulation ID not found | Unhappy | backend | Error thrown with simulation ID in message | | |

---

## 7. Simulation Orchestrator

### Full pipeline

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Create and run simulation end-to-end | Happy | backend | Status transitions: extracting → ready → running → completed. Report saved to `reports` table | | |
| Failure during extraction | Unhappy | backend | Status set to "failed", no traversal or report attempted | | |
| Failure during traversal | Unhappy | backend | Status set to "failed", partial events preserved | | |

---

## 8. Dashboard API Routes

### GET /api/simulations

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Multiple simulations exist | Happy | backend | 200, JSON array with name, date, persona count, touchpoint count, status | | |
| No simulations exist | Edge | backend | 200, empty array `[]` | | |

### GET /api/simulations/[id]

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Valid simulation ID | Happy | backend | 200, simulation detail with events, touchpoints, and report | | |
| Nonexistent simulation ID | Unhappy | backend | 404, `{"error": "Simulation not found"}` | | |

### GET /api/personas

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Personas exist in library | Happy | backend | 200, JSON array of personas with id, name, domain, version | | |
| No personas | Edge | backend | 200, empty array `[]` | | |

### GET /api/simulations/[id]/compare

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Valid simulation with both runs | Happy | backend | 200, comparison data with current vs proposed events | | |

---

## 9. Dashboard — Simulation List

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Page loads with simulations | Happy | frontend | Table renders with columns: name, date, persona count, touchpoint count, completion rate | | |
| No simulations | Edge | frontend | Empty state message displayed | | |
| Simulation in "running" status | Edge | frontend | Spinner or status indicator shown | | |
| Click simulation row | Happy | frontend | Navigates to /simulation/[id] detail page | | |

---

## 10. Dashboard — Simulation Detail

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Completed simulation | Happy | frontend | Report markdown rendered, dropout funnel chart, comprehension heatmap, comparison table all visible | | |
| Simulation not yet completed | Edge | frontend | Status indicator shown, no charts rendered | | |
| Invalid simulation ID in URL | Unhappy | frontend | 404 page displayed | | |
| Dropout funnel chart | Happy | frontend | Horizontal bar chart, one bar per touchpoint, length = % still active | | |
| Comprehension heatmap | Happy | frontend | Grid with rows=touchpoints, cols=personas, color-coded green (5) to red (1) | | |

---

## 11. Dashboard — Comparison Page

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Select two simulations | Happy | frontend | Side-by-side delta table showing score changes per touchpoint × persona | | |
| Summary shows improved/regressed/unchanged counts | Happy | frontend | Accurate counts based on score differences | | |
| Fewer than 2 simulations exist | Edge | frontend | Message explaining comparison requires 2+ simulations | | |

---

## 12. Dashboard — Persona Library

| Scenario | Path | Runner | Expected | Actual | Status |
|----------|------|--------|----------|--------|--------|
| Browse personas by domain | Happy | frontend | Personas grouped by domain, each showing name and literacy level | | |
| Click into persona | Happy | frontend | Shows current YAML definition, version history, simulation usage | | |
| No personas exist | Edge | frontend | Empty state message | | |

---

## Triage Tags

After a `/backend-qa` run, add tags to the **Status** column to control future runs:

| Tag | Meaning | Next run behavior |
|-----|---------|-------------------|
| `[known]` | Confirmed bug, already tracked | Skip |
| `[retest: reason]` | Re-verify (e.g., after a fix) | Execute, clear tag, write new result |
| `[wontfix: reason]` | Intentional behavior | Skip permanently |
| `Pass` (no tag) | Previously passed | Skip (already green) |

---

## Summary

- **12 feature groups tested** — 55 scenarios total
  - Backend: 38 scenarios (run with `/backend-qa`)
  - Frontend: 17 scenarios (run with `/qa`)

---

## TODO

- [ ] Claude API mock strategy for automated testing (real API calls are slow and costly)
- [ ] Seed data fixtures for dashboard frontend tests
- [ ] E2E test config (Playwright) not yet set up
