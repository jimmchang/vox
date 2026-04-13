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

Run the extractor for both current and proposed states:

```typescript
import { extractTouchpoints } from "@/engine/extractor";

const currentTouchpoints = await extractTouchpoints(currentStateText, targetMetrics);
const proposedTouchpoints = await extractTouchpoints(prdText, targetMetrics);
```

Present the extracted touchpoints to the user for review. Allow them to adjust, reorder, add, or remove touchpoints before proceeding.

### Step 5: Select personas

Analyze the domain from the PRD and suggest a persona cohort (4-6 personas spanning the literacy spectrum). Options:
- Accept suggestions as-is
- Modify individual personas
- Import existing personas from the `personas/` library
- Create new personas via the interview flow (see section 2)

### Step 6: Run simulation

```typescript
import { createSimulation, runSimulation } from "@/engine/orchestrator";

const simId = await createSimulation({
  name: derivedName,
  prdText,
  currentStateDescription,
  currentStateMetrics,
  targetMetrics,
});

await runSimulation(simId);
```

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
