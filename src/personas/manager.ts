import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { parse, stringify } from "yaml";
import { personas } from "@/db/schema";
import { type Persona, personaSchema } from "@/personas/schema";

export function loadPersona(filePath: string): Persona {
	const content = readFileSync(filePath, "utf-8");
	const data: unknown = parse(content);
	return personaSchema.parse(data);
}

export function savePersona(filePath: string, persona: Persona, changeDescription: string): void {
	const updated = {
		...persona,
		version: persona.version + 1,
		history: [
			...persona.history,
			{
				date: new Date().toISOString().slice(0, 10),
				change: changeDescription,
			},
		],
	};
	writeFileSync(filePath, stringify(updated), "utf-8");
}

function findYamlFiles(dir: string): string[] {
	const results: string[] = [];
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return results;
	}
	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			results.push(...findYamlFiles(fullPath));
		} else if (entry.endsWith(".yaml")) {
			results.push(fullPath);
		}
	}
	return results;
}

export function syncPersonasToDb(
	personasDir: string,
	db: BetterSQLite3Database<Record<string, unknown>>,
): void {
	const files = findYamlFiles(personasDir);
	const now = new Date();

	for (const filePath of files) {
		const persona = loadPersona(filePath);
		const relPath = relative(personasDir, filePath);

		const existing = db.select().from(personas).where(eq(personas.id, persona.id)).all();

		if (existing.length > 0) {
			db.update(personas)
				.set({
					name: persona.name,
					domain: persona.domain,
					version: persona.version,
					filePath: relPath,
					literacy: persona.domain_literacy,
					updatedAt: now,
				})
				.where(eq(personas.id, persona.id))
				.run();
		} else {
			db.insert(personas)
				.values({
					id: persona.id,
					name: persona.name,
					domain: persona.domain,
					version: persona.version,
					filePath: relPath,
					literacy: persona.domain_literacy,
					createdAt: now,
					updatedAt: now,
				})
				.run();
		}
	}
}
