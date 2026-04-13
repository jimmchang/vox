import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

// ---- In-memory DB setup ----

type TestDb = BetterSQLite3Database<typeof schema>;

let sqlite: InstanceType<typeof Database>;
let testDb: TestDb;

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

// ---- Mock @/db ----

vi.mock("@/db", () => ({
	get db() {
		return testDb;
	},
}));

// ---- Seed helpers ----

function seedSimulation(id: string, name: string, status = "completed") {
	sqlite.exec(`
    INSERT INTO simulations (id, name, prd_text, current_state_description, current_state_metrics, target_metrics, status, created_at)
    VALUES ('${id}', '${name}', 'prd', 'desc', '{}', '[]', '${status}', 1000);
  `);
}

function seedTouchpoint(id: string, simulationId: string, runType: string, order: number) {
	sqlite.exec(`
    INSERT INTO touchpoints (id, simulation_id, run_type, type, name, "order", content, available_actions, requires_prior_knowledge, critical_path_metrics)
    VALUES ('${id}', '${simulationId}', '${runType}', 'page', 'Step ${order}', ${order}, 'content', '[]', '[]', '[]');
  `);
}

function seedEvent(
	id: string,
	simulationId: string,
	runType: string,
	touchpointId: string,
	order: number,
) {
	sqlite.exec(`
    INSERT INTO events (id, simulation_id, run_type, persona_id, touchpoint_id, touchpoint_order, comprehension_score, trust_score, would_proceed, confusion_signal, action_taken, reasoning, time_on_screen, metric_impacts, timestamp)
    VALUES ('${id}', '${simulationId}', '${runType}', 'persona-1', '${touchpointId}', ${order}, 80, 70, 1, NULL, 'click', 'makes sense', 'normal', '[]', 2000);
  `);
}

function seedReport(id: string, simulationId: string) {
	sqlite.exec(`
    INSERT INTO reports (id, simulation_id, markdown, generated_at)
    VALUES ('${id}', '${simulationId}', '# Report', 3000);
  `);
}

function seedPersona(id: string, name: string, domain: string, literacy: string) {
	sqlite.exec(`
    INSERT INTO personas (id, name, domain, version, file_path, literacy, created_at, updated_at)
    VALUES ('${id}', '${name}', '${domain}', 1, '/personas/${id}.yaml', '${literacy}', 1000, 1000);
  `);
}

// ---- Test lifecycle ----

beforeEach(() => {
	sqlite = new Database(":memory:");
	testDb = drizzle(sqlite, { schema });
	createTables();
});

afterEach(() => {
	sqlite.close();
});

// ---- Tests ----

describe("GET /api/simulations", () => {
	it("returns array with simulation data and counts", async () => {
		seedSimulation("sim-1", "First Sim", "completed");
		seedSimulation("sim-2", "Second Sim", "running");
		seedTouchpoint("tp-1", "sim-1", "current", 1);
		seedTouchpoint("tp-2", "sim-1", "current", 2);
		seedEvent("ev-1", "sim-1", "current", "tp-1", 1);

		const { GET } = await import("@/app/api/simulations/route");
		const response = await GET();
		const data: unknown = await response.json();

		expect(response.status).toBe(200);
		expect(Array.isArray(data)).toBe(true);

		const arr = data as Array<unknown>;
		expect(arr).toHaveLength(2);

		expect(arr).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "sim-1",
					name: "First Sim",
					status: "completed",
					touchpointCount: 2,
					eventCount: 1,
				}),
				expect.objectContaining({
					id: "sim-2",
					name: "Second Sim",
					status: "running",
					touchpointCount: 0,
					eventCount: 0,
				}),
			]),
		);
	});

	it("returns empty array when no simulations exist", async () => {
		const { GET } = await import("@/app/api/simulations/route");
		const response = await GET();
		const data: unknown = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual([]);
	});
});

describe("GET /api/simulations/[id]", () => {
	it("returns simulation detail with events, touchpoints, and report", async () => {
		seedSimulation("sim-1", "Detail Sim");
		seedTouchpoint("tp-1", "sim-1", "current", 1);
		seedEvent("ev-1", "sim-1", "current", "tp-1", 1);
		seedReport("rpt-1", "sim-1");

		const { GET } = await import("@/app/api/simulations/[id]/route");
		const request = new Request("http://localhost/api/simulations/sim-1");
		const response = await GET(request, {
			params: Promise.resolve({ id: "sim-1" }),
		});
		const data: unknown = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveProperty("id", "sim-1");
		expect(data).toHaveProperty("name", "Detail Sim");
		expect(data).toHaveProperty("touchpoints");
		expect(data).toHaveProperty("events");
		expect(data).toHaveProperty("report");

		const typed = data as { touchpoints: unknown[]; events: unknown[]; report: unknown };
		expect(typed.touchpoints).toHaveLength(1);
		expect(typed.events).toHaveLength(1);
		expect(typed.report).not.toBeNull();
	});

	it("returns 404 for nonexistent simulation", async () => {
		const { GET } = await import("@/app/api/simulations/[id]/route");
		const request = new Request("http://localhost/api/simulations/nope");
		const response = await GET(request, {
			params: Promise.resolve({ id: "nope" }),
		});
		const data: unknown = await response.json();

		expect(response.status).toBe(404);
		expect(data).toEqual({ error: "Simulation not found" });
	});
});

describe("GET /api/personas", () => {
	it("returns array of personas", async () => {
		seedPersona("p-1", "Alice", "finance", "high");
		seedPersona("p-2", "Bob", "healthcare", "low");

		const { GET } = await import("@/app/api/personas/route");
		const response = await GET();
		const data: unknown = await response.json();

		expect(response.status).toBe(200);
		expect(Array.isArray(data)).toBe(true);

		const arr = data as Array<unknown>;
		expect(arr).toHaveLength(2);

		expect(arr).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "p-1",
					name: "Alice",
					domain: "finance",
					literacy: "high",
					version: 1,
				}),
			]),
		);

		// Should NOT include filePath or timestamps
		const alice = arr.find((p) => (p as { id: string }).id === "p-1") as
			| Record<string, unknown>
			| undefined;
		expect(alice).toBeDefined();
		expect("filePath" in (alice as Record<string, unknown>)).toBe(false);
	});

	it("returns empty array when no personas exist", async () => {
		const { GET } = await import("@/app/api/personas/route");
		const response = await GET();
		const data: unknown = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual([]);
	});
});

describe("GET /api/simulations/[id]/compare", () => {
	it("returns comparison data grouped by run type", async () => {
		seedSimulation("sim-1", "Compare Sim");
		seedTouchpoint("tp-c1", "sim-1", "current", 1);
		seedTouchpoint("tp-p1", "sim-1", "proposed", 1);
		seedEvent("ev-c1", "sim-1", "current", "tp-c1", 1);
		seedEvent("ev-p1", "sim-1", "proposed", "tp-p1", 1);

		const { GET } = await import("@/app/api/simulations/[id]/compare/route");
		const request = new Request("http://localhost/api/simulations/sim-1/compare");
		const response = await GET(request, {
			params: Promise.resolve({ id: "sim-1" }),
		});
		const data: unknown = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveProperty("simulation");
		expect(data).toHaveProperty("current");
		expect(data).toHaveProperty("proposed");

		const typed = data as {
			simulation: { id: string };
			current: { touchpoints: unknown[]; events: unknown[] };
			proposed: { touchpoints: unknown[]; events: unknown[] };
		};

		expect(typed.simulation.id).toBe("sim-1");
		expect(typed.current.touchpoints).toHaveLength(1);
		expect(typed.current.events).toHaveLength(1);
		expect(typed.proposed.touchpoints).toHaveLength(1);
		expect(typed.proposed.events).toHaveLength(1);
	});

	it("returns 404 for nonexistent simulation", async () => {
		const { GET } = await import("@/app/api/simulations/[id]/compare/route");
		const request = new Request("http://localhost/api/simulations/nope/compare");
		const response = await GET(request, {
			params: Promise.resolve({ id: "nope" }),
		});
		const data: unknown = await response.json();

		expect(response.status).toBe(404);
		expect(data).toEqual({ error: "Simulation not found" });
	});
});
