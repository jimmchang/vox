import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/db/index";
import * as schema from "@/db/schema";
import type { Persona } from "@/personas/schema";

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

interface AnthropicMessage {
	role: string;
	content: string;
}

interface AnthropicResponse {
	content: Array<{ type: string; text: string }>;
}

interface AnthropicClient {
	messages: {
		create: (params: {
			model: string;
			max_tokens: number;
			system: string;
			messages: AnthropicMessage[];
		}) => Promise<AnthropicResponse>;
	};
}

type DB = BetterSQLite3Database<Record<string, unknown>>;

export async function runTraversal(
	simulationId: string,
	runType: "current" | "proposed",
	personas: Persona[],
	touchpoints: Touchpoint[],
	client?: AnthropicClient,
	db?: DB,
): Promise<TraversalEvent[]> {
	const activeDb = (db ?? defaultDb) as DB;
	const activeClient = client as AnthropicClient;
	const allEvents: TraversalEvent[] = [];
	const sortedTouchpoints = [...touchpoints].sort((a, b) => a.order - b.order);

	for (const persona of personas) {
		const personaMemory: TraversalEvent[] = [];

		const systemPrompt = buildSystemPrompt(persona);

		for (const touchpoint of sortedTouchpoints) {
			const messages = buildMessages(persona, touchpoint, personaMemory);

			let response: AnthropicResponse;
			try {
				response = await activeClient.messages.create({
					model: "claude-sonnet-4-20250514",
					max_tokens: 1024,
					system: systemPrompt,
					messages,
				});
			} catch (error) {
				activeDb
					.update(schema.simulations)
					.set({ status: "failed" })
					.where(eq(schema.simulations.id, simulationId))
					.run();
				throw error;
			}

			const textBlock = response.content.find((b) => b.type === "text");
			const parsed = JSON.parse(textBlock?.text ?? "{}") as TraversalEvent;

			const event: TraversalEvent = {
				simulationId,
				runType,
				personaId: parsed.personaId,
				touchpointId: parsed.touchpointId,
				touchpointOrder: parsed.touchpointOrder,
				comprehensionScore: parsed.comprehensionScore,
				trustScore: parsed.trustScore,
				wouldProceed: parsed.wouldProceed,
				confusionSignal: parsed.confusionSignal,
				actionTaken: parsed.actionTaken,
				reasoning: parsed.reasoning,
				timeOnScreen: parsed.timeOnScreen,
				metricImpacts: parsed.metricImpacts,
			};

			activeDb
				.insert(schema.events)
				.values({
					id: randomUUID(),
					simulationId: event.simulationId,
					runType: event.runType,
					personaId: event.personaId,
					touchpointId: event.touchpointId,
					touchpointOrder: event.touchpointOrder,
					comprehensionScore: event.comprehensionScore,
					trustScore: event.trustScore,
					wouldProceed: event.wouldProceed,
					confusionSignal: event.confusionSignal,
					actionTaken: event.actionTaken,
					reasoning: event.reasoning,
					timeOnScreen: event.timeOnScreen,
					metricImpacts: JSON.stringify(event.metricImpacts),
					timestamp: new Date(),
				})
				.run();

			allEvents.push(event);
			personaMemory.push(event);

			if (!event.wouldProceed) {
				break;
			}
		}
	}

	return allEvents;
}

function buildSystemPrompt(persona: Persona): string {
	return [
		`You are simulating user "${persona.name}".`,
		`Domain: ${persona.domain}`,
		`Domain literacy: ${persona.domain_literacy}`,
		`Mental model: ${persona.mental_model}`,
		`Misconceptions: ${JSON.stringify(persona.misconceptions)}`,
		`Task: ${persona.task}`,
		`Entry context: ${persona.entry_context}`,
		`Patience: ${persona.patience}`,
		`Risk tolerance: ${persona.risk_tolerance}`,
		`Reads tooltips: ${String(persona.reads_tooltips)}`,
		`Abandons when: ${persona.abandons_when}`,
		"Respond with a JSON object describing this persona's experience at the given touchpoint.",
	].join("\n");
}

function buildMessages(
	persona: Persona,
	touchpoint: Touchpoint,
	memory: TraversalEvent[],
): AnthropicMessage[] {
	const messages: AnthropicMessage[] = [];

	let userContent = [
		`Persona: ${persona.name}`,
		`Touchpoint: ${touchpoint.name} (${touchpoint.type})`,
		`Order: ${touchpoint.order}`,
		`Content: ${touchpoint.content}`,
		`Available actions: ${JSON.stringify(touchpoint.available_actions)}`,
		`Requires prior knowledge: ${JSON.stringify(touchpoint.requires_prior_knowledge)}`,
		`Critical path metrics: ${JSON.stringify(touchpoint.critical_path_metrics)}`,
	].join("\n");

	if (memory.length > 0) {
		userContent += `\n\nPrior experience:\n${JSON.stringify(memory)}`;
	}

	messages.push({ role: "user", content: userContent });

	return messages;
}
