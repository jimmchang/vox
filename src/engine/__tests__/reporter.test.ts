import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { generateReport } from "@/engine/reporter";

// -- Types --------------------------------------------------------------------

type TestDb = BetterSQLite3Database<typeof schema>;

// -- Helpers ------------------------------------------------------------------

let sqlite: InstanceType<typeof Database>;
let db: TestDb;

function createTables() {
	sqlite.exec(`
    CREATE TABLE simulations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prd_text TEXT NOT NULL,
      current_state_description TEXT NOT NULL,
      current_state_metrics TEXT NOT NULL,
      target_metrics TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE touchpoints (
      id TEXT PRIMARY KEY,
      simulation_id TEXT NOT NULL REFERENCES simulations(id),
      run_type TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      content TEXT NOT NULL,
      available_actions TEXT NOT NULL,
      requires_prior_knowledge TEXT NOT NULL,
      critical_path_metrics TEXT NOT NULL
    );

    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      simulation_id TEXT NOT NULL REFERENCES simulations(id),
      run_type TEXT NOT NULL,
      persona_id TEXT NOT NULL,
      touchpoint_id TEXT NOT NULL REFERENCES touchpoints(id),
      touchpoint_order INTEGER NOT NULL,
      comprehension_score INTEGER NOT NULL,
      trust_score INTEGER NOT NULL,
      would_proceed INTEGER NOT NULL,
      confusion_signal TEXT,
      action_taken TEXT NOT NULL,
      reasoning TEXT NOT NULL,
      time_on_screen TEXT NOT NULL,
      metric_impacts TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE reports (
      id TEXT PRIMARY KEY,
      simulation_id TEXT NOT NULL REFERENCES simulations(id),
      markdown TEXT NOT NULL,
      generated_at INTEGER NOT NULL
    );
  `);
}

function seedSimulation(id = "sim-1") {
	sqlite.exec(`
    INSERT INTO simulations (id, name, prd_text, current_state_description, current_state_metrics, target_metrics, status, created_at)
    VALUES ('${id}', 'Test Sim', 'prd text', 'current desc', '{"conversion": 0.5}', '["conversion > 0.7"]', 'completed', 1000);
  `);
}

function seedTouchpoint(
	id: string,
	simulationId: string,
	order: number,
	name: string,
	runType = "current",
) {
	sqlite.exec(`
    INSERT INTO touchpoints (id, simulation_id, run_type, type, name, "order", content, available_actions, requires_prior_knowledge, critical_path_metrics)
    VALUES ('${id}', '${simulationId}', '${runType}', 'page', '${name}', ${order}, 'content', '[]', '[]', '[]');
  `);
}

function seedEvent(params: {
	id: string;
	simulationId: string;
	runType: string;
	personaId: string;
	touchpointId: string;
	touchpointOrder: number;
	comprehensionScore: number;
	trustScore: number;
	wouldProceed: boolean;
	confusionSignal?: string | null;
}) {
	const confVal = params.confusionSignal != null ? `'${params.confusionSignal}'` : "NULL";
	sqlite.exec(`
    INSERT INTO events (id, simulation_id, run_type, persona_id, touchpoint_id, touchpoint_order,
      comprehension_score, trust_score, would_proceed, confusion_signal,
      action_taken, reasoning, time_on_screen, metric_impacts, timestamp)
    VALUES ('${params.id}', '${params.simulationId}', '${params.runType}', '${params.personaId}',
      '${params.touchpointId}', ${params.touchpointOrder},
      ${params.comprehensionScore}, ${params.trustScore}, ${params.wouldProceed ? 1 : 0}, ${confVal},
      'clicked_next', 'seemed fine', 'normal', '[]', ${Date.now()});
  `);
}

const FULL_REPORT_MARKDOWN = `# Simulation Report

## Executive Summary
This report compares current and proposed product experiences.

## Target Metrics
- Conversion rate > 70%

## Current State Baseline
Average comprehension: 3.0, Average trust: 2.5

## Proposed State Results
Average comprehension: 4.5, Average trust: 4.0

## Comparison Delta Table
| Metric | Current | Proposed | Delta |
|--------|---------|----------|-------|
| Comprehension | 3.0 | 4.5 | +1.5 |
| Trust | 2.5 | 4.0 | +1.5 |

## Regressions
No regressions detected.

## Recommendations
1. Ship the proposed changes.
`;

const REGRESSION_REPORT_MARKDOWN = `# Simulation Report

## Executive Summary
This report compares current and proposed product experiences.

## Target Metrics
- Conversion rate > 70%

## Current State Baseline
Average comprehension: 4.0, Average trust: 4.0

## Proposed State Results
Average comprehension: 2.0, Average trust: 2.0

## Comparison Delta Table
| Metric | Current | Proposed | Delta |
|--------|---------|----------|-------|
| Comprehension | 4.0 | 2.0 | -2.0 |
| Trust | 4.0 | 2.0 | -2.0 |

## Regressions
- Comprehension score decreased by 2.0 points
- Trust score decreased by 2.0 points

## Recommendations
1. Do not ship. Investigate regressions.
`;

function makeMockClient(responseMarkdown: string) {
	return {
		messages: {
			create: vi.fn().mockResolvedValue({
				content: [{ type: "text" as const, text: responseMarkdown }],
			}),
		},
	};
}

function seedFullScenario(simulationId: string) {
	seedSimulation(simulationId);

	// Current run touchpoints + events
	seedTouchpoint("tp-c1", simulationId, 1, "Landing", "current");
	seedTouchpoint("tp-c2", simulationId, 2, "Signup", "current");

	seedEvent({
		id: "ec-1",
		simulationId,
		runType: "current",
		personaId: "p-1",
		touchpointId: "tp-c1",
		touchpointOrder: 1,
		comprehensionScore: 3,
		trustScore: 3,
		wouldProceed: true,
	});
	seedEvent({
		id: "ec-2",
		simulationId,
		runType: "current",
		personaId: "p-1",
		touchpointId: "tp-c2",
		touchpointOrder: 2,
		comprehensionScore: 3,
		trustScore: 2,
		wouldProceed: true,
	});

	// Proposed run touchpoints + events
	seedTouchpoint("tp-p1", simulationId, 1, "Landing v2", "proposed");
	seedTouchpoint("tp-p2", simulationId, 2, "Signup v2", "proposed");

	seedEvent({
		id: "ep-1",
		simulationId,
		runType: "proposed",
		personaId: "p-1",
		touchpointId: "tp-p1",
		touchpointOrder: 1,
		comprehensionScore: 5,
		trustScore: 4,
		wouldProceed: true,
	});
	seedEvent({
		id: "ep-2",
		simulationId,
		runType: "proposed",
		personaId: "p-1",
		touchpointId: "tp-p2",
		touchpointOrder: 2,
		comprehensionScore: 4,
		trustScore: 4,
		wouldProceed: true,
	});
}

// -- Setup / Teardown ---------------------------------------------------------

beforeEach(() => {
	sqlite = new Database(":memory:");
	db = drizzle(sqlite, { schema });
	createTables();
});

afterEach(() => {
	sqlite.close();
});

// -- Tests --------------------------------------------------------------------

describe("generateReport", () => {
	it("returns markdown containing all required report sections", async () => {
		seedFullScenario("sim-1");
		const client = makeMockClient(FULL_REPORT_MARKDOWN);

		const result = await generateReport("sim-1", client, db);

		expect(result).toContain("## Executive Summary");
		expect(result).toContain("## Target Metrics");
		expect(result).toContain("## Current State Baseline");
		expect(result).toContain("## Proposed State Results");
		expect(result).toContain("## Comparison Delta Table");
		expect(result).toContain("## Regressions");
		expect(result).toContain("## Recommendations");
	});

	it("saves the report to the reports table in SQLite", async () => {
		seedFullScenario("sim-1");
		const client = makeMockClient(FULL_REPORT_MARKDOWN);

		await generateReport("sim-1", client, db);

		const rows = sqlite
			.prepare("SELECT * FROM reports WHERE simulation_id = ?")
			.all("sim-1") as Array<{
			id: string;
			simulation_id: string;
			markdown: string;
			generated_at: number;
		}>;

		expect(rows).toHaveLength(1);
		const row = rows[0];
		if (!row) throw new Error("Expected a report row");
		expect(row.simulation_id).toBe("sim-1");
		expect(row.markdown).toContain("## Executive Summary");
		expect(row.generated_at).toBeGreaterThan(0);
	});

	it("throws when the simulation does not exist", async () => {
		const client = makeMockClient(FULL_REPORT_MARKDOWN);

		await expect(generateReport("non-existent-sim", client, db)).rejects.toThrow(
			"non-existent-sim",
		);
	});

	it("includes regression details when proposed scores are lower than current", async () => {
		seedFullScenario("sim-1");
		const client = makeMockClient(REGRESSION_REPORT_MARKDOWN);

		const result = await generateReport("sim-1", client, db);

		expect(result).toContain("## Regressions");
		expect(result).toContain("decreased");
	});
});
