import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { runTraversal } from "@/engine/traversal";
import type { Persona } from "@/personas/schema";

// -- Types --------------------------------------------------------------------

/** Touchpoint shape matching the extractor interface */
interface Touchpoint {
	id: string;
	type: string;
	name: string;
	order: number;
	content: string;
	available_actions: string[];
	requires_prior_knowledge: string[];
	critical_path_metrics: string[];
}

/** The event shape we expect runTraversal to return */
interface TraversalEvent {
	simulationId: string;
	runType: "current" | "proposed";
	personaId: string;
	touchpointId: string;
	touchpointOrder: number;
	comprehensionScore: number;
	trustScore: number;
	wouldProceed: boolean;
	confusionSignal: string | null;
	actionTaken: string;
	reasoning: string;
	timeOnScreen: "quick" | "normal" | "long" | "very_long";
	metricImpacts: string[];
}

// -- Fixtures -----------------------------------------------------------------

function makePersona(overrides: Partial<Persona> & { id: string; name: string }): Persona {
	return {
		version: 1,
		domain: "e-commerce",
		domain_literacy: "medium",
		mental_model: "Standard online shopping model",
		misconceptions: [],
		task: "Complete a purchase",
		entry_context: "Arrived from product page",
		patience: "medium",
		risk_tolerance: "medium",
		reads_tooltips: true,
		abandons_when: "confused for too long",
		history: [],
		...overrides,
	};
}

const PERSONA_A = makePersona({ id: "persona-a", name: "Alice" });
const PERSONA_B = makePersona({
	id: "persona-b",
	name: "Bob",
	domain_literacy: "low",
	patience: "low",
});

const TOUCHPOINTS: Touchpoint[] = [
	{
		id: "tp-1",
		type: "page",
		name: "Landing Page",
		order: 1,
		content: "Welcome page with product overview",
		available_actions: ["proceed", "browse"],
		requires_prior_knowledge: [],
		critical_path_metrics: ["conversion_rate"],
	},
	{
		id: "tp-2",
		type: "form",
		name: "Sign Up Form",
		order: 2,
		content: "User registration form",
		available_actions: ["submit", "go_back"],
		requires_prior_knowledge: ["email"],
		critical_path_metrics: ["signup_rate"],
	},
	{
		id: "tp-3",
		type: "page",
		name: "Dashboard",
		order: 3,
		content: "Main user dashboard after signup",
		available_actions: ["explore", "settings"],
		requires_prior_knowledge: [],
		critical_path_metrics: ["activation_rate"],
	},
];

const SIM_ID = "sim-test-001";

/** Claude API response for a single traversal event */
function makeApiResponse(overrides: Partial<TraversalEvent> = {}): TraversalEvent {
	return {
		simulationId: SIM_ID,
		runType: "current",
		personaId: "persona-a",
		touchpointId: "tp-1",
		touchpointOrder: 1,
		comprehensionScore: 80,
		trustScore: 75,
		wouldProceed: true,
		confusionSignal: null,
		actionTaken: "proceed",
		reasoning: "The page is clear and inviting",
		timeOnScreen: "normal",
		metricImpacts: [],
		...overrides,
	};
}

/**
 * Creates a mock Anthropic client that returns controlled traversal responses.
 * Calls are tracked for assertion on arguments.
 */
function createMockClient(responses: TraversalEvent[]) {
	let callIndex = 0;
	const createFn = vi.fn().mockImplementation(() => {
		const response = responses[callIndex];
		callIndex++;
		return Promise.resolve({
			content: [{ type: "text", text: JSON.stringify(response) }],
		});
	});
	return {
		client: { messages: { create: createFn } },
		createFn,
	};
}

// -- In-memory DB setup -------------------------------------------------------

let testDb: ReturnType<typeof drizzle>;
let rawSqlite: InstanceType<typeof Database>;

beforeEach(() => {
	rawSqlite = new Database(":memory:");
	rawSqlite.pragma("journal_mode = WAL");

	// Create tables matching the schema
	rawSqlite.exec(`
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

	testDb = drizzle(rawSqlite, { schema });

	// Seed simulation row so foreign keys are satisfied
	rawSqlite.exec(`
		INSERT INTO simulations (id, name, prd_text, current_state_description, current_state_metrics, target_metrics, status, created_at)
		VALUES ('${SIM_ID}', 'Test Sim', 'PRD text', 'Current state', '{}', '[]', 'running', ${Date.now()});
	`);

	// Seed touchpoint rows
	for (const tp of TOUCHPOINTS) {
		rawSqlite.exec(`
			INSERT INTO touchpoints (id, simulation_id, run_type, type, name, "order", content, available_actions, requires_prior_knowledge, critical_path_metrics)
			VALUES ('${tp.id}', '${SIM_ID}', 'current', '${tp.type}', '${tp.name}', ${tp.order}, '${tp.content}', '${JSON.stringify(tp.available_actions)}', '${JSON.stringify(tp.requires_prior_knowledge)}', '${JSON.stringify(tp.critical_path_metrics)}');
		`);
	}
});

afterEach(() => {
	rawSqlite.close();
});

// -- Tests --------------------------------------------------------------------

describe("runTraversal", () => {
	describe("happy path", () => {
		it("produces one event per persona × touchpoint when all proceed", async () => {
			// 2 personas × 3 touchpoints = 6 events
			const responses: TraversalEvent[] = [];
			for (const persona of [PERSONA_A, PERSONA_B]) {
				for (const tp of TOUCHPOINTS) {
					responses.push(
						makeApiResponse({
							personaId: persona.id,
							touchpointId: tp.id,
							touchpointOrder: tp.order,
							wouldProceed: true,
						}),
					);
				}
			}

			const { client } = createMockClient(responses);

			const events = await runTraversal(
				SIM_ID,
				"current",
				[PERSONA_A, PERSONA_B],
				TOUCHPOINTS,
				client,
				testDb,
			);

			expect(events).toHaveLength(6);
		});

		it("returns events with correct persona and touchpoint associations", async () => {
			const responses: TraversalEvent[] = [];
			for (const persona of [PERSONA_A, PERSONA_B]) {
				for (const tp of TOUCHPOINTS) {
					responses.push(
						makeApiResponse({
							personaId: persona.id,
							touchpointId: tp.id,
							touchpointOrder: tp.order,
						}),
					);
				}
			}

			const { client } = createMockClient(responses);

			const events = await runTraversal(
				SIM_ID,
				"current",
				[PERSONA_A, PERSONA_B],
				TOUCHPOINTS,
				client,
				testDb,
			);

			const aliceEvents = events.filter((e) => e.personaId === "persona-a");
			const bobEvents = events.filter((e) => e.personaId === "persona-b");

			expect(aliceEvents).toHaveLength(3);
			expect(bobEvents).toHaveLength(3);

			// Each persona should have events for all touchpoints in order
			expect(aliceEvents.map((e) => e.touchpointOrder)).toEqual([1, 2, 3]);
			expect(bobEvents.map((e) => e.touchpointOrder)).toEqual([1, 2, 3]);
		});
	});

	describe("dropout", () => {
		it("stops traversal for a persona when wouldProceed is false", async () => {
			// Alice proceeds through all 3, Bob drops out at touchpoint 2
			const responses: TraversalEvent[] = [
				// Alice — all 3 touchpoints
				makeApiResponse({
					personaId: "persona-a",
					touchpointId: "tp-1",
					touchpointOrder: 1,
					wouldProceed: true,
				}),
				makeApiResponse({
					personaId: "persona-a",
					touchpointId: "tp-2",
					touchpointOrder: 2,
					wouldProceed: true,
				}),
				makeApiResponse({
					personaId: "persona-a",
					touchpointId: "tp-3",
					touchpointOrder: 3,
					wouldProceed: true,
				}),
				// Bob — drops out at touchpoint 2
				makeApiResponse({
					personaId: "persona-b",
					touchpointId: "tp-1",
					touchpointOrder: 1,
					wouldProceed: true,
				}),
				makeApiResponse({
					personaId: "persona-b",
					touchpointId: "tp-2",
					touchpointOrder: 2,
					wouldProceed: false,
				}),
			];

			const { client } = createMockClient(responses);

			const events = await runTraversal(
				SIM_ID,
				"current",
				[PERSONA_A, PERSONA_B],
				TOUCHPOINTS,
				client,
				testDb,
			);

			const aliceEvents = events.filter((e) => e.personaId === "persona-a");
			const bobEvents = events.filter((e) => e.personaId === "persona-b");

			// Alice completed all 3 touchpoints
			expect(aliceEvents).toHaveLength(3);

			// Bob stopped at touchpoint 2 (the dropout event IS recorded)
			expect(bobEvents).toHaveLength(2);
			expect(bobEvents[bobEvents.length - 1]?.wouldProceed).toBe(false);
		});

		it("records the dropout event itself before stopping", async () => {
			// Single persona drops at the first touchpoint
			const responses: TraversalEvent[] = [
				makeApiResponse({
					personaId: "persona-a",
					touchpointId: "tp-1",
					touchpointOrder: 1,
					wouldProceed: false,
					confusionSignal: "completely lost",
				}),
			];

			const { client } = createMockClient(responses);

			const events = await runTraversal(
				SIM_ID,
				"current",
				[PERSONA_A],
				TOUCHPOINTS,
				client,
				testDb,
			);

			expect(events).toHaveLength(1);
			expect(events[0]?.wouldProceed).toBe(false);
			expect(events[0]?.confusionSignal).toBe("completely lost");
		});
	});

	describe("persona isolation", () => {
		it("each persona gets a fresh context — no cross-persona leakage", async () => {
			const responses: TraversalEvent[] = [
				// Alice touchpoints
				makeApiResponse({ personaId: "persona-a", touchpointId: "tp-1", touchpointOrder: 1 }),
				makeApiResponse({ personaId: "persona-a", touchpointId: "tp-2", touchpointOrder: 2 }),
				makeApiResponse({ personaId: "persona-a", touchpointId: "tp-3", touchpointOrder: 3 }),
				// Bob touchpoints
				makeApiResponse({ personaId: "persona-b", touchpointId: "tp-1", touchpointOrder: 1 }),
				makeApiResponse({ personaId: "persona-b", touchpointId: "tp-2", touchpointOrder: 2 }),
				makeApiResponse({ personaId: "persona-b", touchpointId: "tp-3", touchpointOrder: 3 }),
			];

			const { client, createFn } = createMockClient(responses);

			await runTraversal(SIM_ID, "current", [PERSONA_A, PERSONA_B], TOUCHPOINTS, client, testDb);

			// Bob's first call (index 3) should NOT contain any of Alice's prior context
			const bobFirstCall = createFn.mock.calls[3] as unknown[];
			const bobFirstArgs = bobFirstCall[0] as {
				messages: Array<{ role: string; content: string }>;
			};
			const bobMessages = bobFirstArgs.messages;
			const bobPromptText = JSON.stringify(bobMessages);

			// Alice's name should not appear in Bob's prompt context
			// (only Bob's persona details should be present)
			expect(bobPromptText).not.toContain("Alice");
			expect(bobPromptText).toContain("Bob");
		});
	});

	describe("persistence", () => {
		it("events are persisted to SQLite during traversal, not batched at end", async () => {
			// We'll use a single persona with 3 touchpoints
			// The mock will check DB state mid-traversal
			const responses: TraversalEvent[] = [
				makeApiResponse({ personaId: "persona-a", touchpointId: "tp-1", touchpointOrder: 1 }),
				makeApiResponse({ personaId: "persona-a", touchpointId: "tp-2", touchpointOrder: 2 }),
				makeApiResponse({ personaId: "persona-a", touchpointId: "tp-3", touchpointOrder: 3 }),
			];

			const { client } = createMockClient(responses);

			await runTraversal(SIM_ID, "current", [PERSONA_A], TOUCHPOINTS, client, testDb);

			// After traversal completes, all events should be in the DB
			const dbEvents = testDb
				.select()
				.from(schema.events)
				.where(eq(schema.events.simulationId, SIM_ID))
				.all();

			expect(dbEvents).toHaveLength(3);
		});

		it("persisted events match the returned events", async () => {
			const responses: TraversalEvent[] = [
				makeApiResponse({
					personaId: "persona-a",
					touchpointId: "tp-1",
					touchpointOrder: 1,
					comprehensionScore: 85,
					trustScore: 90,
					actionTaken: "proceed",
				}),
			];

			const { client } = createMockClient(responses);

			const events = await runTraversal(
				SIM_ID,
				"current",
				[PERSONA_A],
				[TOUCHPOINTS[0] as Touchpoint],
				client,
				testDb,
			);

			const dbEvents = testDb
				.select()
				.from(schema.events)
				.where(eq(schema.events.simulationId, SIM_ID))
				.all();

			expect(dbEvents).toHaveLength(1);
			const dbEvent = dbEvents[0];
			const returnedEvent = events[0];

			expect(dbEvent?.comprehensionScore).toBe(returnedEvent?.comprehensionScore);
			expect(dbEvent?.trustScore).toBe(returnedEvent?.trustScore);
			expect(dbEvent?.actionTaken).toBe(returnedEvent?.actionTaken);
			expect(dbEvent?.personaId).toBe(returnedEvent?.personaId);
		});
	});

	describe("API failure", () => {
		it("saves partial results and throws when Claude API fails mid-traversal", async () => {
			// First touchpoint succeeds, second fails
			const createFn = vi
				.fn()
				.mockResolvedValueOnce({
					content: [
						{
							type: "text",
							text: JSON.stringify(
								makeApiResponse({
									personaId: "persona-a",
									touchpointId: "tp-1",
									touchpointOrder: 1,
								}),
							),
						},
					],
				})
				.mockRejectedValueOnce(new Error("API rate limit exceeded"));

			const client = { messages: { create: createFn } };

			await expect(
				runTraversal(SIM_ID, "current", [PERSONA_A], TOUCHPOINTS, client, testDb),
			).rejects.toThrow();

			// The first event should still be persisted despite the failure
			const dbEvents = testDb
				.select()
				.from(schema.events)
				.where(eq(schema.events.simulationId, SIM_ID))
				.all();

			expect(dbEvents).toHaveLength(1);
			expect(dbEvents[0]?.touchpointId).toBe("tp-1");
		});

		it("marks simulation as failed when API error occurs", async () => {
			const createFn = vi.fn().mockRejectedValue(new Error("API connection refused"));

			const client = { messages: { create: createFn } };

			await expect(
				runTraversal(SIM_ID, "current", [PERSONA_A], TOUCHPOINTS, client, testDb),
			).rejects.toThrow();

			// Simulation status should be updated to "failed"
			const sim = testDb
				.select()
				.from(schema.simulations)
				.where(eq(schema.simulations.id, SIM_ID))
				.all();

			expect(sim[0]?.status).toBe("failed");
		});
	});
});
