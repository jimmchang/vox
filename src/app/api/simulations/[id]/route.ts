import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { events, reports, simulations, touchpoints } from "@/db/schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	const simulation = db.select().from(simulations).where(eq(simulations.id, id)).get();

	if (!simulation) {
		return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
	}

	const simTouchpoints = db
		.select()
		.from(touchpoints)
		.where(eq(touchpoints.simulationId, id))
		.all();

	const simEvents = db.select().from(events).where(eq(events.simulationId, id)).all();

	const simReport = db.select().from(reports).where(eq(reports.simulationId, id)).get();

	return NextResponse.json({
		...simulation,
		touchpoints: simTouchpoints,
		events: simEvents,
		report: simReport ?? null,
	});
}
