import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const simulations = sqliteTable("simulations", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	prdText: text("prd_text").notNull(),
	currentStateDescription: text("current_state_description").notNull(),
	currentStateMetrics: text("current_state_metrics").notNull(), // JSON
	targetMetrics: text("target_metrics").notNull(), // JSON array
	status: text("status", {
		enum: ["extracting", "ready", "running", "completed", "failed"],
	}).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const touchpoints = sqliteTable("touchpoints", {
	id: text("id").primaryKey(),
	simulationId: text("simulation_id")
		.notNull()
		.references(() => simulations.id),
	runType: text("run_type", { enum: ["current", "proposed"] }).notNull(),
	type: text("type").notNull(),
	name: text("name").notNull(),
	order: integer("order").notNull(),
	content: text("content").notNull(),
	availableActions: text("available_actions").notNull(), // JSON array
	requiresPriorKnowledge: text("requires_prior_knowledge").notNull(), // JSON array
	criticalPathMetrics: text("critical_path_metrics").notNull(), // JSON array
});

export const simulationPersonas = sqliteTable("simulation_personas", {
	simulationId: text("simulation_id")
		.notNull()
		.references(() => simulations.id),
	personaId: text("persona_id").notNull(),
	personaVersion: integer("persona_version").notNull(),
});

export const events = sqliteTable("events", {
	id: text("id").primaryKey(),
	simulationId: text("simulation_id")
		.notNull()
		.references(() => simulations.id),
	runType: text("run_type", { enum: ["current", "proposed"] }).notNull(),
	personaId: text("persona_id").notNull(),
	touchpointId: text("touchpoint_id")
		.notNull()
		.references(() => touchpoints.id),
	touchpointOrder: integer("touchpoint_order").notNull(),
	comprehensionScore: integer("comprehension_score").notNull(),
	trustScore: integer("trust_score").notNull(),
	wouldProceed: integer("would_proceed", { mode: "boolean" }).notNull(),
	confusionSignal: text("confusion_signal"),
	actionTaken: text("action_taken").notNull(),
	reasoning: text("reasoning").notNull(),
	timeOnScreen: text("time_on_screen", {
		enum: ["quick", "normal", "long", "very_long"],
	}).notNull(),
	metricImpacts: text("metric_impacts").notNull(), // JSON array
	timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
});

export const reports = sqliteTable("reports", {
	id: text("id").primaryKey(),
	simulationId: text("simulation_id")
		.notNull()
		.references(() => simulations.id),
	markdown: text("markdown").notNull(),
	generatedAt: integer("generated_at", { mode: "timestamp" }).notNull(),
});

export const personas = sqliteTable("personas", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	domain: text("domain").notNull(),
	version: integer("version").notNull(),
	filePath: text("file_path").notNull(),
	literacy: text("literacy").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
