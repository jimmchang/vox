/**
 * Sample end-to-end simulation run.
 *
 * Usage:
 *   npx tsx test/run-sample.ts
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 * Uses the fixtures in test/fixtures/ as input.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// Force the DB module to initialize (auto-migrates)
import "@/db/index";

import { db } from "@/db/index";
import { createSimulation, runSimulation } from "@/engine/orchestrator";
import { syncPersonasToDb } from "@/personas/manager";

const fixturesDir = join(import.meta.dirname, "fixtures");

async function main() {
	console.log("=== Vox Sample Simulation ===\n");

	// 1. Sync test personas to the database
	const personasDir = join(fixturesDir, "personas");
	console.log("Syncing personas from", personasDir);
	syncPersonasToDb(personasDir, db);
	console.log("  Done.\n");

	// 2. Read the sample PRD and current state
	const prdText = readFileSync(join(fixturesDir, "sample-prd.md"), "utf-8");
	const currentState = readFileSync(join(fixturesDir, "sample-current-state.md"), "utf-8");

	console.log("PRD:", prdText.split("\n")[0]);
	console.log("Current state:", currentState.split("\n")[0]);
	console.log();

	// 3. Create the simulation
	console.log("Creating simulation...");
	const simId = await createSimulation({
		name: "DeFi Bridge Checkout Redesign",
		prdText,
		currentStateDescription: currentState,
		currentStateMetrics: {
			bridge_completion_rate: "32%",
			support_tickets: "~50/week",
			avg_completion_time: "8 minutes",
		},
		targetMetrics: ["bridge_completion_rate", "support_tickets", "avg_completion_time"],
	});
	console.log("  Simulation ID:", simId);
	console.log();

	// 4. Run the simulation (this makes Claude API calls)
	console.log("Running simulation (this calls Claude API, may take a minute)...");
	console.log("  Phase 1: Extracting touchpoints...");
	console.log("  Phase 2: Running persona traversals...");
	console.log("  Phase 3: Generating report...");
	console.log();

	await runSimulation(simId);

	console.log("Simulation completed!");
	console.log();
	console.log(`View results at: http://localhost:3000/simulation/${simId}`);
	console.log("(make sure 'npm run dev' is running)");
}

main().catch((err) => {
	console.error("Simulation failed:", err);
	process.exit(1);
});
