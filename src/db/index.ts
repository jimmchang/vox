import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const dataDir = join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(join(dataDir, "vox.db"));
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
