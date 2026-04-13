import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { events, simulations, touchpoints } from "@/db/schema";

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

	const currentTouchpoints = simTouchpoints.filter((tp) => tp.runType === "current");
	const proposedTouchpoints = simTouchpoints.filter((tp) => tp.runType === "proposed");

	const currentEvents = simEvents.filter((e) => e.runType === "current");
	const proposedEvents = simEvents.filter((e) => e.runType === "proposed");

	return NextResponse.json({
		simulation: {
			id: simulation.id,
			name: simulation.name,
			status: simulation.status,
		},
		current: {
			touchpoints: currentTouchpoints,
			events: currentEvents,
		},
		proposed: {
			touchpoints: proposedTouchpoints,
			events: proposedEvents,
		},
	});
}
