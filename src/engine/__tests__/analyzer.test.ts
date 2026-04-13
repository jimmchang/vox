import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
	getComprehensionHeatmap,
	getDropoutFunnel,
	getObjectionsByCohort,
} from "@/engine/analyzer";

// -- Helpers ------------------------------------------------------------------

type TestDb = BetterSQLite3Database<typeof schema>;

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
  `);
}

function seedSimulation(id = "sim-1") {
	sqlite.exec(`
    INSERT INTO simulations (id, name, prd_text, current_state_description, current_state_metrics, target_metrics, status, created_at)
    VALUES ('${id}', 'Test Sim', 'prd', 'desc', '{}', '[]', 'completed', 1000);
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

// -- Setup / Teardown ---------------------------------------------------------

beforeEach(() => {
	sqlite = new Database(":memory:");
	db = drizzle(sqlite, { schema });
	createTables();
});

afterEach(() => {
	sqlite.close();
});

// -- getDropoutFunnel ---------------------------------------------------------

describe("getDropoutFunnel", () => {
	it("returns decreasing counts when personas abandon", async () => {
		seedSimulation("sim-1");
		// 4 touchpoints
		seedTouchpoint("tp-1", "sim-1", 1, "Landing Page");
		seedTouchpoint("tp-2", "sim-1", 2, "Sign Up Form");
		seedTouchpoint("tp-3", "sim-1", 3, "Verification");
		seedTouchpoint("tp-4", "sim-1", 4, "Dashboard");

		// Persona A: completes step 1, drops at step 2 (would_proceed = false)
		seedEvent({
			id: "e1",
			simulationId: "sim-1",
			runType: "current",
			personaId: "persona-a",
			touchpointId: "tp-1",
			touchpointOrder: 1,
			comprehensionScore: 4,
			trustScore: 3,
			wouldProceed: true,
		});
		seedEvent({
			id: "e2",
			simulationId: "sim-1",
			runType: "current",
			personaId: "persona-a",
			touchpointId: "tp-2",
			touchpointOrder: 2,
			comprehensionScore: 2,
			trustScore: 1,
			wouldProceed: false,
		});

		// Persona B: completes steps 1-2, drops at step 3
		seedEvent({
			id: "e3",
			simulationId: "sim-1",
			runType: "current",
			personaId: "persona-b",
			touchpointId: "tp-1",
			touchpointOrder: 1,
			comprehensionScore: 5,
			trustScore: 4,
			wouldProceed: true,
		});
		seedEvent({
			id: "e4",
			simulationId: "sim-1",
			runType: "current",
			personaId: "persona-b",
			touchpointId: "tp-2",
			touchpointOrder: 2,
			comprehensionScore: 4,
			trustScore: 3,
			wouldProceed: true,
		});
		seedEvent({
			id: "e5",
			simulationId: "sim-1",
			runType: "current",
			personaId: "persona-b",
			touchpointId: "tp-3",
			touchpointOrder: 3,
			comprehensionScore: 2,
			trustScore: 2,
			wouldProceed: false,
		});

		// Persona C: completes all 4 steps
		for (let i = 1; i <= 4; i++) {
			seedEvent({
				id: `e-c-${i}`,
				simulationId: "sim-1",
				runType: "current",
				personaId: "persona-c",
				touchpointId: `tp-${i}`,
				touchpointOrder: i,
				comprehensionScore: 5,
				trustScore: 5,
				wouldProceed: true,
			});
		}

		// Persona D: completes all 4 steps
		for (let i = 1; i <= 4; i++) {
			seedEvent({
				id: `e-d-${i}`,
				simulationId: "sim-1",
				runType: "current",
				personaId: "persona-d",
				touchpointId: `tp-${i}`,
				touchpointOrder: i,
				comprehensionScore: 4,
				trustScore: 4,
				wouldProceed: true,
			});
		}

		const result = await getDropoutFunnel("sim-1", undefined, db);

		expect(result).toEqual([
			{
				touchpointId: "tp-1",
				touchpointOrder: 1,
				touchpointName: "Landing Page",
				activeCount: 4,
			},
			{
				touchpointId: "tp-2",
				touchpointOrder: 2,
				touchpointName: "Sign Up Form",
				activeCount: 3,
			},
			{
				touchpointId: "tp-3",
				touchpointOrder: 3,
				touchpointName: "Verification",
				activeCount: 2,
			},
			{
				touchpointId: "tp-4",
				touchpointOrder: 4,
				touchpointName: "Dashboard",
				activeCount: 2,
			},
		]);
	});

	it("returns same count at every step when all personas complete", async () => {
		seedSimulation("sim-1");
		seedTouchpoint("tp-1", "sim-1", 1, "Step 1");
		seedTouchpoint("tp-2", "sim-1", 2, "Step 2");
		seedTouchpoint("tp-3", "sim-1", 3, "Step 3");

		for (const persona of ["p-1", "p-2", "p-3"]) {
			for (let i = 1; i <= 3; i++) {
				seedEvent({
					id: `e-${persona}-${i}`,
					simulationId: "sim-1",
					runType: "current",
					personaId: persona,
					touchpointId: `tp-${i}`,
					touchpointOrder: i,
					comprehensionScore: 5,
					trustScore: 5,
					wouldProceed: true,
				});
			}
		}

		const result = await getDropoutFunnel("sim-1", undefined, db);

		expect(result).toHaveLength(3);
		for (const step of result) {
			expect(step.activeCount).toBe(3);
		}
	});

	it("returns empty array for simulation with no events", async () => {
		seedSimulation("sim-empty");

		const result = await getDropoutFunnel("sim-empty", undefined, db);

		expect(result).toEqual([]);
	});

	it("filters by runType when specified", async () => {
		seedSimulation("sim-1");
		seedTouchpoint("tp-c1", "sim-1", 1, "Current Step 1", "current");
		seedTouchpoint("tp-c2", "sim-1", 2, "Current Step 2", "current");
		seedTouchpoint("tp-p1", "sim-1", 1, "Proposed Step 1", "proposed");
		seedTouchpoint("tp-p2", "sim-1", 2, "Proposed Step 2", "proposed");

		// Current run events: 2 personas, one drops
		seedEvent({
			id: "ec-1",
			simulationId: "sim-1",
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
			simulationId: "sim-1",
			runType: "current",
			personaId: "p-1",
			touchpointId: "tp-c2",
			touchpointOrder: 2,
			comprehensionScore: 3,
			trustScore: 3,
			wouldProceed: true,
		});
		seedEvent({
			id: "ec-3",
			simulationId: "sim-1",
			runType: "current",
			personaId: "p-2",
			touchpointId: "tp-c1",
			touchpointOrder: 1,
			comprehensionScore: 2,
			trustScore: 2,
			wouldProceed: false,
		});

		// Proposed run events: 2 personas, both complete
		seedEvent({
			id: "ep-1",
			simulationId: "sim-1",
			runType: "proposed",
			personaId: "p-1",
			touchpointId: "tp-p1",
			touchpointOrder: 1,
			comprehensionScore: 5,
			trustScore: 5,
			wouldProceed: true,
		});
		seedEvent({
			id: "ep-2",
			simulationId: "sim-1",
			runType: "proposed",
			personaId: "p-1",
			touchpointId: "tp-p2",
			touchpointOrder: 2,
			comprehensionScore: 5,
			trustScore: 5,
			wouldProceed: true,
		});
		seedEvent({
			id: "ep-3",
			simulationId: "sim-1",
			runType: "proposed",
			personaId: "p-2",
			touchpointId: "tp-p1",
			touchpointOrder: 1,
			comprehensionScore: 4,
			trustScore: 4,
			wouldProceed: true,
		});
		seedEvent({
			id: "ep-4",
			simulationId: "sim-1",
			runType: "proposed",
			personaId: "p-2",
			touchpointId: "tp-p2",
			touchpointOrder: 2,
			comprehensionScore: 4,
			trustScore: 4,
			wouldProceed: true,
		});

		const result = await getDropoutFunnel("sim-1", "proposed", db);

		expect(result).toHaveLength(2);
		expect(result[0]?.touchpointName).toBe("Proposed Step 1");
		expect(result[0]?.activeCount).toBe(2);
		expect(result[1]?.touchpointName).toBe("Proposed Step 2");
		expect(result[1]?.activeCount).toBe(2);
	});
});

// -- getComprehensionHeatmap --------------------------------------------------

describe("getComprehensionHeatmap", () => {
	it("returns correct averages for known test data", async () => {
		seedSimulation("sim-1");
		seedTouchpoint("tp-1", "sim-1", 1, "Onboarding");
		seedTouchpoint("tp-2", "sim-1", 2, "Pricing");

		// Persona A at tp-1: two events with comprehension 4,2 and trust 3,5
		seedEvent({
			id: "h1",
			simulationId: "sim-1",
			runType: "current",
			personaId: "persona-a",
			touchpointId: "tp-1",
			touchpointOrder: 1,
			comprehensionScore: 4,
			trustScore: 3,
			wouldProceed: true,
		});
		seedEvent({
			id: "h2",
			simulationId: "sim-1",
			runType: "current",
			personaId: "persona-a",
			touchpointId: "tp-1",
			touchpointOrder: 1,
			comprehensionScore: 2,
			trustScore: 5,
			wouldProceed: true,
		});

		// Persona B at tp-2: one event with comprehension 5, trust 4
		seedEvent({
			id: "h3",
			simulationId: "sim-1",
			runType: "current",
			personaId: "persona-b",
			touchpointId: "tp-2",
			touchpointOrder: 2,
			comprehensionScore: 5,
			trustScore: 4,
			wouldProceed: true,
		});

		const result = await getComprehensionHeatmap("sim-1", undefined, db);

		// Persona A at tp-1: avg comprehension = (4+2)/2 = 3, avg trust = (3+5)/2 = 4
		const personaAtp1 = result.find(
			(r) => r.personaId === "persona-a" && r.touchpointId === "tp-1",
		);
		expect(personaAtp1).toBeDefined();
		expect(personaAtp1?.avgComprehension).toBe(3);
		expect(personaAtp1?.avgTrust).toBe(4);
		expect(personaAtp1?.touchpointOrder).toBe(1);

		// Persona B at tp-2: avg comprehension = 5, avg trust = 4
		const personaBtp2 = result.find(
			(r) => r.personaId === "persona-b" && r.touchpointId === "tp-2",
		);
		expect(personaBtp2).toBeDefined();
		expect(personaBtp2?.avgComprehension).toBe(5);
		expect(personaBtp2?.avgTrust).toBe(4);
		expect(personaBtp2?.touchpointOrder).toBe(2);
	});

	it("returns exact scores for a single event", async () => {
		seedSimulation("sim-1");
		seedTouchpoint("tp-1", "sim-1", 1, "Solo Step");

		seedEvent({
			id: "single-1",
			simulationId: "sim-1",
			runType: "current",
			personaId: "persona-x",
			touchpointId: "tp-1",
			touchpointOrder: 1,
			comprehensionScore: 3,
			trustScore: 2,
			wouldProceed: true,
		});

		const result = await getComprehensionHeatmap("sim-1", undefined, db);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			touchpointId: "tp-1",
			touchpointOrder: 1,
			personaId: "persona-x",
			avgComprehension: 3,
			avgTrust: 2,
		});
	});
});

// -- getObjectionsByCohort ----------------------------------------------------

describe("getObjectionsByCohort", () => {
	it("groups and ranks confusion signals by frequency", async () => {
		seedSimulation("sim-1");
		seedTouchpoint("tp-1", "sim-1", 1, "Step 1");
		seedTouchpoint("tp-2", "sim-1", 2, "Step 2");

		// Persona A: "confusing layout" x2, "unclear CTA" x1
		seedEvent({
			id: "o1",
			simulationId: "sim-1",
			runType: "current",
			personaId: "persona-a",
			touchpointId: "tp-1",
			touchpointOrder: 1,
			comprehensionScore: 2,
			trustScore: 2,
			wouldProceed: true,
			confusionSignal: "confusing layout",
		});
		seedEvent({
			id: "o2",
			simulationId: "sim-1",
			runType: "current",
			personaId: "persona-a",
			touchpointId: "tp-2",
			touchpointOrder: 2,
			comprehensionScore: 3,
			trustScore: 3,
			wouldProceed: true,
			confusionSignal: "confusing layout",
		});
		seedEvent({
			id: "o3",
			simulationId: "sim-1",
			runType: "current",
			personaId: "persona-a",
			touchpointId: "tp-2",
			touchpointOrder: 2,
			comprehensionScore: 3,
			trustScore: 3,
			wouldProceed: true,
			confusionSignal: "unclear CTA",
		});

		// Persona B: "too much text" x1
		seedEvent({
			id: "o4",
			simulationId: "sim-1",
			runType: "current",
			personaId: "persona-b",
			touchpointId: "tp-1",
			touchpointOrder: 1,
			comprehensionScore: 2,
			trustScore: 3,
			wouldProceed: true,
			confusionSignal: "too much text",
		});

		const result = await getObjectionsByCohort("sim-1", undefined, db);

		const personaA = result.find((r) => r.personaId === "persona-a");
		expect(personaA).toBeDefined();
		// Most frequent first
		expect(personaA?.objections[0]).toEqual({
			signal: "confusing layout",
			count: 2,
		});
		expect(personaA?.objections[1]).toEqual({ signal: "unclear CTA", count: 1 });

		const personaB = result.find((r) => r.personaId === "persona-b");
		expect(personaB).toBeDefined();
		expect(personaB?.objections).toEqual([{ signal: "too much text", count: 1 }]);
	});

	it("returns empty objections when all confusion signals are null", async () => {
		seedSimulation("sim-1");
		seedTouchpoint("tp-1", "sim-1", 1, "Step 1");

		seedEvent({
			id: "no-obj-1",
			simulationId: "sim-1",
			runType: "current",
			personaId: "persona-a",
			touchpointId: "tp-1",
			touchpointOrder: 1,
			comprehensionScore: 5,
			trustScore: 5,
			wouldProceed: true,
			confusionSignal: null,
		});
		seedEvent({
			id: "no-obj-2",
			simulationId: "sim-1",
			runType: "current",
			personaId: "persona-b",
			touchpointId: "tp-1",
			touchpointOrder: 1,
			comprehensionScore: 4,
			trustScore: 4,
			wouldProceed: true,
			confusionSignal: null,
		});

		const result = await getObjectionsByCohort("sim-1", undefined, db);

		expect(result).toEqual([]);
	});
});
