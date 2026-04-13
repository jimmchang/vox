---
name: vox
description: Run product experience simulations — test PRDs against diverse personas, manage persona libraries, and view results
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

# /vox — Product Experience Simulation

## What would you like to do?

1. **Test a PRD** — paste a product requirements document and simulate how personas experience it
2. **Work on personas** — create, import, refine, or browse persona libraries
3. **Open dashboard** — start the visualization dashboard

---

## 1. Test a PRD

### Step 1: Collect the PRD

Ask the user to paste or describe their product requirements document. Accept text, markdown, or a file path.

### Step 2: Identify metrics

Scan the PRD for metrics and goals:
- If found: confirm with the user ("I see you're optimizing for X — correct?")
- If missing: prompt ("What metrics matter for this? e.g., conversion rate, activation, support tickets")

### Step 3: Collect current state

Prompt the user for:
- "Describe the current experience/flow"
- "Share any current metrics (conversion rate, drop-off %, etc.)"
- "Any known pain points or user feedback?"

Accept whatever format they provide — text, data, screenshots.

### Step 4: Extract touchpoints

Extract touchpoints yourself from both current and proposed state documents. For each touchpoint, identify:
- `id`: kebab-case identifier (e.g. `tp-current-1`, `tp-proposed-1`)
- `type`: page, form, modal, etc.
- `name`: human-readable name
- `order`: sequential number starting from 1
- `content`: description of what happens
- `available_actions`: array of actions the user can take
- `requires_prior_knowledge`: array of knowledge the user needs
- `critical_path_metrics`: which target metrics this touchpoint affects

Present the extracted touchpoints to the user for review. Allow them to adjust, reorder, add, or remove touchpoints before proceeding.

### Step 5: Select personas

Analyze the domain from the PRD and suggest a persona cohort (4-6 personas spanning the literacy spectrum). Options:
- Accept suggestions as-is
- Modify individual personas
- Import existing personas from the `personas/` library
- Create new personas via the interview flow (see section 2)

### Step 6: Run simulation

**IMPORTANT: You ARE the LLM. Do NOT call the engine's TypeScript functions (they require an external API key). Instead, run the simulation directly using subagents.**

#### 6a. Create simulation record in DB

```bash
npx tsx -e "
import { join } from 'node:path';
import { db } from './src/db/index';
import * as schema from './src/db/schema';
import { syncPersonasToDb } from './src/personas/manager';

// Sync persona YAML files to DB first
syncPersonasToDb(join(process.cwd(), 'personas'), db as any);

// Insert simulation record
db.insert(schema.simulations).values({
  id: '<uuid>',
  name: '<name>',
  prdText: \`<prd text>\`,
  currentStateDescription: \`<current state text>\`,
  currentStateMetrics: JSON.stringify({...}),
  targetMetrics: JSON.stringify([...]),
  status: 'running',
  createdAt: new Date(),
}).run();

// IMPORTANT: Also insert simulation_personas join records
// (the dashboard counts personas from this table)
db.insert(schema.simulationPersonas).values([
  { simulationId: '<uuid>', personaId: '<persona-id>', personaVersion: <version> },
  // ... one per persona
]).run();
"
```

#### 6b. Dispatch parallel subagents for persona traversal

Launch one background Agent per persona+runType combination (e.g. 2 personas x 2 run types = 4 agents). Each agent:

1. Receives the full persona definition and touchpoint list
2. Simulates the persona walking through each touchpoint sequentially
3. Returns a JSON array of traversal events with these fields per touchpoint:
   - `personaId`, `touchpointId`, `touchpointOrder`
   - `comprehensionScore` (1-10), `trustScore` (1-10)
   - `wouldProceed` (boolean — if false, persona abandons and traversal stops)
   - `confusionSignal` (string or null)
   - `actionTaken` (from available_actions)
   - `reasoning` (2-3 sentence internal monologue)
   - `timeOnScreen` ("quick" | "normal" | "long" | "very_long")
   - `metricImpacts` (array of affected metrics)

#### 6c. Write results to DB

Once all agents return, insert touchpoints and events into the DB via `npx tsx` scripts, then generate a markdown report and insert it into the `reports` table.

### Step 7: Present results

Display the report summary in the terminal. Offer to open the dashboard for full visualization:

```bash
npm run dev
# Then open http://localhost:3000/simulation/{simId}
```

---

## 2. Work on Personas

### Generate cohort from context

User says "I'm building X for Y audience." Generate 4-6 personas spanning the literacy spectrum with domain-specific mental models and misconceptions. Write YAML files to `personas/{domain}/`.

### Import from research

User pastes interview transcripts, support tickets, analytics segments, or user feedback. Extract personas with real mental models grounded in actual user behavior.

### Create single persona via interview

Ask questions one at a time:
1. What domain is this for?
2. What's their technical background?
3. What are they trying to accomplish?
4. What misconceptions might they have?
5. When do they give up?

Each answer populates a specific field in the persona YAML schema.

### Refine existing persona

User shares new observations about a persona. Propose specific field updates. On approval, use `savePersona()` to increment version and log the change.

### Browse library

List all personas from `personas/` directory, grouped by domain.

---

## 3. Open Dashboard

Start the Next.js dev server and open the browser:

```bash
npm run dev
# Opens http://localhost:3000
```

If already running, just report the URL.
