import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

// -- Mock engine modules ------------------------------------------------------

vi.mock("@/engine/extractor", () => ({
	extractTouchpoints: vi.fn(),
}));

vi.mock("@/engine/traversal", () => ({
	runTraversal: vi.fn(),
}));

vi.mock("@/engine/reporter", () => ({
	generateReport: vi.fn(),
}));

// Import mocked modules so we can control their return values
import { extractTouchpoints } from "@/engine/extractor";
import { createSimulation, runSimulation } from "@/engine/orchestrator";
import { generateReport } from "@/engine/reporter";
import { runTraversal } from "@/engine/traversal";

// -- Types --------------------------------------------------------------------

type TestDb = BetterSQLite3Database<typeof schema>;

// -- Test data ----------------------------------------------------------------

const MOCK_TOUCHPOINTS = [
	{
		id: "tp-landing",
		type: "page",
		name: "Landing Page",
		order: 1,
		content: "Welcome to the product",
		available_actions: ["sign_up", "learn_more"],
		requires_prior_knowledge: [],
		critical_path_metrics: ["conversion"],
	},
	{
		id: "tp-signup",
		type: "form",
		name: "Sign Up Form",
		order: 2,
		content: "Enter your details",
		available_actions: ["submit", "cancel"],
		requires_prior_knowledge: ["email"],
		critical_path_metrics: ["conversion"],
	},
];

const MOCK_TRAVERSAL_EVENTS = [
	{
		simulationId: "will-be-set",
		runType: "current" as const,
		personaId: "persona-1",
		touchpointId: "tp-landing",
		touchpointOrder: 1,
		comprehensionScore: 4,
		trustScore: 3,
		wouldProceed: true,
		confusionSignal: null,
		actionTaken: "sign_up",
		reasoning: "Looks trustworthy",
		timeOnScreen: "normal" as const,
		metricImpacts: ["conversion:+0.1"],
	},
];

const MOCK_REPORT_MARKDOWN = "# Simulation Report\n\n## Executive Summary\nDone.";

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

    CREATE TABLE simulation_personas (
      simulation_id TEXT NOT NULL REFERENCES simulations(id),
      persona_id TEXT NOT NULL,
      persona_version INTEGER NOT NULL
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

    CREATE TABLE personas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
      version INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      literacy TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

function seedPersonas() {
	sqlite.exec(`
    INSERT INTO personas (id, name, domain, version, file_path, literacy, created_at, updated_at)
    VALUES
      ('persona-1', 'Cautious Carol', 'fintech', 1, 'personas/cautious-carol.yaml', 'low', ${Date.now()}, ${Date.now()}),
      ('persona-2', 'Power Pete', 'fintech', 1, 'personas/power-pete.yaml', 'high', ${Date.now()}, ${Date.now()});
  `);
}

function getSimulationStatus(simulationId: string): string | undefined {
	const row = sqlite.prepare("SELECT status FROM simulations WHERE id = ?").get(simulationId) as
		| { status: string }
		| undefined;
	return row?.status;
}

// -- Setup / Teardown ---------------------------------------------------------

beforeEach(() => {
	sqlite = new Database(":memory:");
	db = drizzle(sqlite, { schema });
	createTables();
	seedPersonas();

	// Reset mocks
	vi.mocked(extractTouchpoints).mockReset();
	vi.mocked(runTraversal).mockReset();
	vi.mocked(generateReport).mockReset();

	// Default mock implementations
	vi.mocked(extractTouchpoints).mockResolvedValue(MOCK_TOUCHPOINTS);
	vi.mocked(runTraversal).mockResolvedValue(MOCK_TRAVERSAL_EVENTS);
	vi.mocked(generateReport).mockResolvedValue(MOCK_REPORT_MARKDOWN);
});

afterEach(() => {
	sqlite.close();
});

// -- Tests --------------------------------------------------------------------

describe("createSimulation", () => {
	it("creates a simulation record with status 'extracting' and returns the ID", async () => {
		const id = await createSimulation({
			name: "Test Simulation",
			prdText: "This is a PRD about a checkout flow redesign.",
			currentStateDescription: "Current checkout is a 5-step wizard",
			currentStateMetrics: { conversion: "0.45", dropoff: "0.30" },
			targetMetrics: ["conversion > 0.7", "dropoff < 0.15"],
			db,
		});

		expect(id).toBeDefined();
		expect(typeof id).toBe("string");
		expect(id.length).toBeGreaterThan(0);

		const status = getSimulationStatus(id);
		expect(status).toBe("extracting");

		// Verify the full record was persisted
		const row = sqlite.prepare("SELECT * FROM simulations WHERE id = ?").get(id) as {
			id: string;
			name: string;
			prd_text: string;
			current_state_description: string;
			current_state_metrics: string;
			target_metrics: string;
			status: string;
		};
		expect(row.name).toBe("Test Simulation");
		expect(row.prd_text).toBe("This is a PRD about a checkout flow redesign.");
		expect(row.current_state_description).toBe("Current checkout is a 5-step wizard");
		expect(JSON.parse(row.current_state_metrics)).toEqual({
			conversion: "0.45",
			dropoff: "0.30",
		});
		expect(JSON.parse(row.target_metrics)).toEqual(["conversion > 0.7", "dropoff < 0.15"]);
	});
});

describe("runSimulation", () => {
	it("completes the full pipeline and sets status to 'completed'", async () => {
		const simId = await createSimulation({
			name: "Full Pipeline Test",
			prdText: "A product requirements document.",
			currentStateDescription: "Current state description",
			currentStateMetrics: { metric1: "value1" },
			targetMetrics: ["metric1 > 0.8"],
			db,
		});

		await runSimulation(simId, undefined, db);

		// Extractor should have been called (for both current and proposed states)
		expect(extractTouchpoints).toHaveBeenCalled();

		// Traversal should have been called for both run types
		expect(runTraversal).toHaveBeenCalled();

		// Reporter should have been called
		expect(generateReport).toHaveBeenCalledTimes(1);

		// Final status should be completed
		const status = getSimulationStatus(simId);
		expect(status).toBe("completed");
	});

	it("transitions status through extracting -> ready -> running -> completed", async () => {
		const statusLog: string[] = [];

		// Track status changes by intercepting mock calls
		vi.mocked(extractTouchpoints).mockImplementation(async () => {
			const status = getSimulationStatus(simId);
			if (status) statusLog.push(status);
			return MOCK_TOUCHPOINTS;
		});

		vi.mocked(runTraversal).mockImplementation(async () => {
			const status = getSimulationStatus(simId);
			if (status) statusLog.push(status);
			return MOCK_TRAVERSAL_EVENTS;
		});

		vi.mocked(generateReport).mockImplementation(async () => {
			const status = getSimulationStatus(simId);
			if (status) statusLog.push(status);
			return MOCK_REPORT_MARKDOWN;
		});

		const simId = await createSimulation({
			name: "Status Tracking Test",
			prdText: "PRD text here.",
			currentStateDescription: "Current state",
			currentStateMetrics: { k: "v" },
			targetMetrics: ["k > 1"],
			db,
		});

		await runSimulation(simId, undefined, db);

		// During extraction, status should be "extracting"
		expect(statusLog).toContain("extracting");
		// During traversal, status should be "running"
		expect(statusLog).toContain("running");

		// Final status
		const finalStatus = getSimulationStatus(simId);
		expect(finalStatus).toBe("completed");
	});

	it("sets status to 'failed' when extraction throws an error", async () => {
		vi.mocked(extractTouchpoints).mockRejectedValue(new Error("API rate limit exceeded"));

		const simId = await createSimulation({
			name: "Failure Test",
			prdText: "PRD that will fail.",
			currentStateDescription: "Current state",
			currentStateMetrics: { a: "1" },
			targetMetrics: ["a > 2"],
			db,
		});

		await expect(runSimulation(simId, undefined, db)).rejects.toThrow();

		const status = getSimulationStatus(simId);
		expect(status).toBe("failed");
	});

	it("sets status to 'failed' when traversal throws an error", async () => {
		vi.mocked(runTraversal).mockRejectedValue(new Error("Traversal connection timeout"));

		const simId = await createSimulation({
			name: "Traversal Failure Test",
			prdText: "PRD text.",
			currentStateDescription: "Current state",
			currentStateMetrics: { b: "2" },
			targetMetrics: ["b > 3"],
			db,
		});

		await expect(runSimulation(simId, undefined, db)).rejects.toThrow();

		const status = getSimulationStatus(simId);
		expect(status).toBe("failed");
	});

	it("extracts touchpoints for both current and proposed states and runs traversal for both", async () => {
		const simId = await createSimulation({
			name: "Dual Run Test",
			prdText: "PRD with both states.",
			currentStateDescription: "Current checkout flow",
			currentStateMetrics: { conversion: "0.5" },
			targetMetrics: ["conversion > 0.7"],
			db,
		});

		await runSimulation(simId, undefined, db);

		// Extractor should be called twice: once for current state, once for proposed (PRD)
		expect(extractTouchpoints).toHaveBeenCalledTimes(2);

		// Traversal should be called twice: once for "current", once for "proposed"
		expect(runTraversal).toHaveBeenCalledTimes(2);

		// Verify run types
		const traversalCalls = vi.mocked(runTraversal).mock.calls;
		const runTypes = traversalCalls.map((call) => call[1]);
		expect(runTypes).toContain("current");
		expect(runTypes).toContain("proposed");
	});
});
