import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/db/index";
import * as schema from "@/db/schema";
import {
	getComprehensionHeatmap,
	getDropoutFunnel,
	getObjectionsByCohort,
} from "@/engine/analyzer";

type DB = BetterSQLite3Database<Record<string, unknown>>;

interface AnthropicClient {
	messages: {
		create: (params: unknown) => Promise<{
			content: Array<{ type: string; text: string }>;
		}>;
	};
}

export async function generateReport(
	simulationId: string,
	client?: AnthropicClient,
	db?: DB,
): Promise<string> {
	const database = db ?? defaultDb;

	const simulation = database
		.select()
		.from(schema.simulations)
		.where(eq(schema.simulations.id, simulationId))
		.get();

	if (!simulation) {
		throw new Error(`Simulation not found: ${simulationId}`);
	}

	const [
		currentFunnel,
		proposedFunnel,
		currentHeatmap,
		proposedHeatmap,
		currentObjections,
		proposedObjections,
	] = await Promise.all([
		getDropoutFunnel(simulationId, "current", database),
		getDropoutFunnel(simulationId, "proposed", database),
		getComprehensionHeatmap(simulationId, "current", database),
		getComprehensionHeatmap(simulationId, "proposed", database),
		getObjectionsByCohort(simulationId, "current", database),
		getObjectionsByCohort(simulationId, "proposed", database),
	]);

	const prompt = `Generate a simulation report in markdown with these sections:
## Executive Summary
## Target Metrics
## Current State Baseline
## Proposed State Results
## Comparison Delta Table
## Regressions
## Recommendations

Simulation: ${simulation.name}
Target Metrics: ${simulation.targetMetrics}
Current State: ${simulation.currentStateDescription}
Current Metrics: ${simulation.currentStateMetrics}

Current Funnel: ${JSON.stringify(currentFunnel)}
Proposed Funnel: ${JSON.stringify(proposedFunnel)}
Current Heatmap: ${JSON.stringify(currentHeatmap)}
Proposed Heatmap: ${JSON.stringify(proposedHeatmap)}
Current Objections: ${JSON.stringify(currentObjections)}
Proposed Objections: ${JSON.stringify(proposedObjections)}`;

	if (!client) {
		throw new Error("Anthropic client is required");
	}

	const response = await client.messages.create({
		model: "claude-sonnet-4-20250514",
		max_tokens: 4096,
		messages: [{ role: "user", content: prompt }],
	});

	const textBlock = response.content.find((block) => block.type === "text");
	if (!textBlock) {
		throw new Error("No text content in Claude response");
	}
	const markdown = textBlock.text;

	database
		.insert(schema.reports)
		.values({
			id: randomUUID(),
			simulationId,
			markdown,
			generatedAt: new Date(),
		})
		.run();

	return markdown;
}
