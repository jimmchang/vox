import { sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

type DB = BetterSQLite3Database<Record<string, unknown>>;

export async function getDropoutFunnel(
	simulationId: string,
	runType: "current" | "proposed" | undefined,
	db: DB,
) {
	const runTypeParam = runType ?? "%";

	const rows = db.all<{
		touchpoint_id: string;
		touchpoint_order: number;
		touchpoint_name: string;
		active_count: number;
	}>(sql`
		SELECT
			t.id AS touchpoint_id,
			t."order" AS touchpoint_order,
			t.name AS touchpoint_name,
			COUNT(DISTINCT e.persona_id) AS active_count
		FROM touchpoints t
		JOIN events e
			ON e.touchpoint_id = t.id
			AND e.simulation_id = ${simulationId}
			AND e.run_type LIKE ${runTypeParam}
			AND e.would_proceed = 1
		WHERE t.simulation_id = ${simulationId}
			AND t.run_type LIKE ${runTypeParam}
		GROUP BY t.id, t."order", t.name
		ORDER BY t."order" ASC
	`);

	return rows.map((r) => ({
		touchpointId: r.touchpoint_id,
		touchpointOrder: r.touchpoint_order,
		touchpointName: r.touchpoint_name,
		activeCount: r.active_count,
	}));
}

export async function getComprehensionHeatmap(
	simulationId: string,
	runType: "current" | "proposed" | undefined,
	db: DB,
) {
	const runTypeParam = runType ?? "%";

	const rows = db.all<{
		touchpoint_id: string;
		touchpoint_order: number;
		persona_id: string;
		avg_comprehension: number;
		avg_trust: number;
	}>(sql`
		SELECT
			e.touchpoint_id,
			e.touchpoint_order,
			e.persona_id,
			AVG(e.comprehension_score) AS avg_comprehension,
			AVG(e.trust_score) AS avg_trust
		FROM events e
		WHERE e.simulation_id = ${simulationId}
			AND e.run_type LIKE ${runTypeParam}
		GROUP BY e.touchpoint_id, e.persona_id
		ORDER BY e.touchpoint_order ASC, e.persona_id ASC
	`);

	return rows.map((r) => ({
		touchpointId: r.touchpoint_id,
		touchpointOrder: r.touchpoint_order,
		personaId: r.persona_id,
		avgComprehension: r.avg_comprehension,
		avgTrust: r.avg_trust,
	}));
}

export async function getObjectionsByCohort(
	simulationId: string,
	runType: "current" | "proposed" | undefined,
	db: DB,
) {
	const runTypeParam = runType ?? "%";

	const rows = db.all<{
		persona_id: string;
		signal: string;
		cnt: number;
	}>(sql`
		SELECT
			e.persona_id,
			e.confusion_signal AS signal,
			COUNT(*) AS cnt
		FROM events e
		WHERE e.simulation_id = ${simulationId}
			AND e.run_type LIKE ${runTypeParam}
			AND e.confusion_signal IS NOT NULL
		GROUP BY e.persona_id, e.confusion_signal
		ORDER BY e.persona_id ASC, cnt DESC
	`);

	const grouped = new Map<string, Array<{ signal: string; count: number }>>();

	for (const row of rows) {
		let list = grouped.get(row.persona_id);
		if (!list) {
			list = [];
			grouped.set(row.persona_id, list);
		}
		list.push({ signal: row.signal, count: row.cnt });
	}

	return Array.from(grouped.entries()).map(([personaId, objections]) => ({
		personaId,
		objections,
	}));
}
