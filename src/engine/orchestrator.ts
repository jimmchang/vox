import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/db/index";
import * as schema from "@/db/schema";
import { extractTouchpoints } from "@/engine/extractor";
import { generateReport } from "@/engine/reporter";
import { runTraversal } from "@/engine/traversal";

type DB = BetterSQLite3Database<Record<string, unknown>>;

interface CreateSimulationParams {
	name: string;
	prdText: string;
	currentStateDescription: string;
	currentStateMetrics: Record<string, string>;
	targetMetrics: string[];
	db?: DB;
}

interface AnthropicClient {
	messages: {
		create: (params: unknown) => Promise<{
			content: Array<{ type: string; text: string }>;
		}>;
	};
}

export async function createSimulation(params: CreateSimulationParams): Promise<string> {
	const database = (params.db ?? defaultDb) as DB;
	const id = randomUUID();

	database
		.insert(schema.simulations)
		.values({
			id,
			name: params.name,
			prdText: params.prdText,
			currentStateDescription: params.currentStateDescription,
			currentStateMetrics: JSON.stringify(params.currentStateMetrics),
			targetMetrics: JSON.stringify(params.targetMetrics),
			status: "extracting",
			createdAt: new Date(),
		})
		.run();

	return id;
}

export async function runSimulation(
	simulationId: string,
	client?: AnthropicClient,
	db?: DB,
): Promise<void> {
	const database = (db ?? defaultDb) as DB;

	try {
		// Load simulation record
		const simulation = database
			.select()
			.from(schema.simulations)
			.where(eq(schema.simulations.id, simulationId))
			.get();

		if (!simulation) {
			throw new Error(`Simulation not found: ${simulationId}`);
		}

		const targetMetrics = JSON.parse(simulation.targetMetrics) as string[];

		// Phase 1: Extract touchpoints (status is already "extracting")
		const currentTouchpoints = await extractTouchpoints(
			simulation.currentStateDescription,
			targetMetrics,
			client as Parameters<typeof extractTouchpoints>[2],
		);

		const proposedTouchpoints = await extractTouchpoints(
			simulation.prdText,
			targetMetrics,
			client as Parameters<typeof extractTouchpoints>[2],
		);

		// Phase 2: Set status to "running" for traversal
		database
			.update(schema.simulations)
			.set({ status: "running" })
			.where(eq(schema.simulations.id, simulationId))
			.run();

		// Load personas from DB
		const personas = database.select().from(schema.personas).all();

		// Run traversal for both current and proposed
		await runTraversal(
			simulationId,
			"current",
			personas as unknown as Parameters<typeof runTraversal>[2],
			currentTouchpoints,
			client as Parameters<typeof runTraversal>[4],
			db,
		);

		await runTraversal(
			simulationId,
			"proposed",
			personas as unknown as Parameters<typeof runTraversal>[2],
			proposedTouchpoints,
			client as Parameters<typeof runTraversal>[4],
			db,
		);

		// Phase 3: Generate report
		await generateReport(simulationId, client as Parameters<typeof generateReport>[1], db);

		// Set final status
		database
			.update(schema.simulations)
			.set({ status: "completed" })
			.where(eq(schema.simulations.id, simulationId))
			.run();
	} catch (error) {
		const database = (db ?? defaultDb) as DB;
		database
			.update(schema.simulations)
			.set({ status: "failed" })
			.where(eq(schema.simulations.id, simulationId))
			.run();
		throw error;
	}
}
