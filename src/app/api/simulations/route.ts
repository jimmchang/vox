import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { simulations } from "@/db/schema";

export async function GET() {
	const rows = db
		.select({
			id: simulations.id,
			name: simulations.name,
			status: simulations.status,
			createdAt: simulations.createdAt,
			touchpointCount:
				sql<number>`(SELECT COUNT(*) FROM touchpoints WHERE touchpoints.simulation_id = simulations.id)`.as(
					"touchpoint_count",
				),
			eventCount:
				sql<number>`(SELECT COUNT(*) FROM events WHERE events.simulation_id = simulations.id)`.as(
					"event_count",
				),
		})
		.from(simulations)
		.all();

	return NextResponse.json(rows);
}
