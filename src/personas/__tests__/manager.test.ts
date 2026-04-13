import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import * as schema from "@/db/schema";
import { loadPersona, savePersona, syncPersonasToDb } from "@/personas/manager";

const validPersonaData = {
	id: "test-persona-alice",
	name: "Alice Tester",
	version: 1,
	domain: "defi",
	domain_literacy: "medium",
	mental_model: "Thinks everything is straightforward.",
	misconceptions: ["All tokens are the same"],
	task: "Swap ETH for USDC",
	entry_context: "Clicked a swap button",
	patience: "medium",
	risk_tolerance: "high",
	reads_tooltips: false,
	abandons_when: "Gets confused by warnings",
	age: 34,
	profession: "Software engineer",
	tech_comfort: "high",
	history: [
		{
			date: "2026-04-01",
			change: "Initial creation",
		},
	],
};

describe("loadPersona", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `vox-test-${randomUUID()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("loads a valid persona YAML file and returns a typed object", () => {
		const filePath = join(tempDir, "alice.yaml");
		writeFileSync(filePath, stringify(validPersonaData), "utf-8");

		const persona = loadPersona(filePath);

		expect(persona.id).toBe("test-persona-alice");
		expect(persona.name).toBe("Alice Tester");
		expect(persona.version).toBe(1);
		expect(persona.domain).toBe("defi");
		expect(persona.domain_literacy).toBe("medium");
		expect(persona.misconceptions).toEqual(["All tokens are the same"]);
		expect(persona.reads_tooltips).toBe(false);
		expect(persona.age).toBe(34);
		expect(persona.history).toHaveLength(1);
	});

	it("throws when YAML is missing a required field", () => {
		const { id: _id, ...incomplete } = validPersonaData;
		const filePath = join(tempDir, "incomplete.yaml");
		writeFileSync(filePath, stringify(incomplete), "utf-8");

		expect(() => loadPersona(filePath)).toThrow();
	});

	it("throws when file does not exist", () => {
		const bogusPath = join(tempDir, "nonexistent.yaml");
		expect(() => loadPersona(bogusPath)).toThrow();
	});
});

describe("savePersona", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `vox-test-${randomUUID()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("increments version and appends a history entry when saving", () => {
		const filePath = join(tempDir, "alice.yaml");
		writeFileSync(filePath, stringify(validPersonaData), "utf-8");

		const original = loadPersona(filePath);
		expect(original.version).toBe(1);
		expect(original.history).toHaveLength(1);

		savePersona(filePath, original, "Updated mental model");

		const updated = loadPersona(filePath);
		expect(updated.version).toBe(2);
		expect(updated.history).toHaveLength(2);

		const latestEntry = updated.history[updated.history.length - 1];
		expect(latestEntry).toBeDefined();
		expect(latestEntry?.change).toBe("Updated mental model");
		expect(latestEntry?.date).toBeDefined();
	});
});

describe("syncPersonasToDb", () => {
	let tempDir: string;
	let testDb: ReturnType<typeof drizzle>;

	beforeEach(() => {
		tempDir = join(tmpdir(), `vox-test-${randomUUID()}`);
		mkdirSync(join(tempDir, "defi"), { recursive: true });
		mkdirSync(join(tempDir, "nft"), { recursive: true });

		// Create in-memory SQLite database
		const sqlite = new Database(":memory:");
		testDb = drizzle(sqlite, { schema });

		// Create the personas table
		testDb.run(sql`
			CREATE TABLE personas (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				domain TEXT NOT NULL,
				version INTEGER NOT NULL,
				file_path TEXT NOT NULL,
				literacy TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`);
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("writes all persona YAML files from a directory to the database", () => {
		// Create two persona files in different subdirectories
		const persona1 = { ...validPersonaData, id: "defi-alice", domain: "defi" };
		const persona2 = {
			...validPersonaData,
			id: "nft-bob",
			name: "Bob NFT",
			domain: "nft",
			domain_literacy: "high",
		};

		writeFileSync(join(tempDir, "defi", "alice.yaml"), stringify(persona1), "utf-8");
		writeFileSync(join(tempDir, "nft", "bob.yaml"), stringify(persona2), "utf-8");

		syncPersonasToDb(tempDir, testDb);

		const rows = testDb.select().from(schema.personas).all();
		expect(rows).toHaveLength(2);

		const ids = rows.map((r) => r.id);
		expect(ids).toContain("defi-alice");
		expect(ids).toContain("nft-bob");
	});

	it("updates existing rows when syncing again (YAML wins)", () => {
		const persona = { ...validPersonaData, id: "conflict-test" };
		const filePath = join(tempDir, "defi", "conflict.yaml");
		writeFileSync(filePath, stringify(persona), "utf-8");

		// First sync
		syncPersonasToDb(tempDir, testDb);

		const rowsBefore = testDb.select().from(schema.personas).all();
		expect(rowsBefore).toHaveLength(1);
		expect(rowsBefore[0]?.name).toBe("Alice Tester");

		// Modify the YAML file (simulating YAML as source of truth)
		const updatedPersona = { ...persona, name: "Alice Updated", version: 2 };
		writeFileSync(filePath, stringify(updatedPersona), "utf-8");

		// Second sync — YAML wins
		syncPersonasToDb(tempDir, testDb);

		const rowsAfter = testDb.select().from(schema.personas).all();
		expect(rowsAfter).toHaveLength(1);
		expect(rowsAfter[0]?.name).toBe("Alice Updated");
		expect(rowsAfter[0]?.version).toBe(2);
	});

	it("handles an empty personas directory without error", () => {
		const emptyDir = join(tmpdir(), `vox-test-empty-${randomUUID()}`);
		mkdirSync(emptyDir, { recursive: true });

		expect(() => syncPersonasToDb(emptyDir, testDb)).not.toThrow();

		const rows = testDb.select().from(schema.personas).all();
		expect(rows).toHaveLength(0);

		rmSync(emptyDir, { recursive: true, force: true });
	});
});
