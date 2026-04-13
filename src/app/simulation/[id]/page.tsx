export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import { events, personas, reports, simulations, touchpoints } from "@/db/schema";
import { ComparisonTable } from "./comparison-table";
import { ComprehensionHeatmap } from "./comprehension-heatmap";
import { DropoutFunnelChart } from "./dropout-funnel-chart";
import { ReportMarkdown } from "./report-markdown";

type SimulationStatus = "extracting" | "ready" | "running" | "completed" | "failed";

const statusVariant: Record<SimulationStatus, "default" | "secondary" | "destructive"> = {
	completed: "default",
	running: "secondary",
	extracting: "secondary",
	ready: "secondary",
	failed: "destructive",
};

interface FunnelDatum {
	touchpointName: string;
	activeCount: number;
}

interface HeatmapDatum {
	touchpointName: string;
	personaName: string;
	score: number;
}

interface ComparisonDatum {
	touchpointName: string;
	personaName: string;
	currentScore: number | null;
	proposedScore: number | null;
}

function buildFunnelData(
	touchpointRows: { id: string; name: string; order: number; runType: string }[],
	eventRows: {
		touchpointId: string;
		wouldProceed: boolean;
		personaId: string;
		runType: string;
	}[],
): FunnelDatum[] {
	const currentTouchpoints = touchpointRows
		.filter((tp) => tp.runType === "current")
		.sort((a, b) => a.order - b.order);

	const currentEvents = eventRows.filter((e) => e.runType === "current");

	// Get unique personas
	const personaIds = [...new Set(currentEvents.map((e) => e.personaId))];

	const funnel: FunnelDatum[] = [];

	for (const tp of currentTouchpoints) {
		// Count personas still active at this touchpoint
		let activeCount = 0;
		for (const pid of personaIds) {
			// A persona is active at a touchpoint if they have an event for it
			// and all prior touchpoints had wouldProceed = true
			const priorTouchpoints = currentTouchpoints.filter((t) => t.order < tp.order);
			const droppedEarlier = priorTouchpoints.some((prior) => {
				const evt = currentEvents.find((e) => e.personaId === pid && e.touchpointId === prior.id);
				return evt !== undefined && !evt.wouldProceed;
			});
			if (!droppedEarlier) {
				activeCount++;
			}
		}
		funnel.push({ touchpointName: tp.name, activeCount });
	}

	return funnel;
}

function buildHeatmapData(
	touchpointRows: { id: string; name: string; order: number; runType: string }[],
	eventRows: {
		touchpointId: string;
		personaId: string;
		comprehensionScore: number;
		runType: string;
	}[],
	personaMap: Map<string, string>,
): HeatmapDatum[] {
	const currentTouchpoints = touchpointRows
		.filter((tp) => tp.runType === "current")
		.sort((a, b) => a.order - b.order);

	const currentEvents = eventRows.filter((e) => e.runType === "current");

	const data: HeatmapDatum[] = [];

	for (const tp of currentTouchpoints) {
		for (const evt of currentEvents) {
			if (evt.touchpointId === tp.id) {
				data.push({
					touchpointName: tp.name,
					personaName: personaMap.get(evt.personaId) ?? evt.personaId,
					score: evt.comprehensionScore,
				});
			}
		}
	}

	return data;
}

function buildComparisonData(
	touchpointRows: { id: string; name: string; order: number; runType: string }[],
	eventRows: {
		touchpointId: string;
		personaId: string;
		comprehensionScore: number;
		runType: string;
	}[],
	personaMap: Map<string, string>,
): ComparisonDatum[] {
	const currentTouchpoints = touchpointRows
		.filter((tp) => tp.runType === "current")
		.sort((a, b) => a.order - b.order);
	const proposedTouchpoints = touchpointRows
		.filter((tp) => tp.runType === "proposed")
		.sort((a, b) => a.order - b.order);

	const currentEvents = eventRows.filter((e) => e.runType === "current");
	const proposedEvents = eventRows.filter((e) => e.runType === "proposed");

	const personaIds = [...new Set(eventRows.map((e) => e.personaId))];

	// Build a union of touchpoint names by order
	const maxLen = Math.max(currentTouchpoints.length, proposedTouchpoints.length);
	const data: ComparisonDatum[] = [];

	for (let i = 0; i < maxLen; i++) {
		const currentTp = currentTouchpoints[i];
		const proposedTp = proposedTouchpoints[i];
		const tpName = currentTp?.name ?? proposedTp?.name ?? `Touchpoint ${String(i + 1)}`;

		for (const pid of personaIds) {
			const currentEvt = currentTp
				? currentEvents.find((e) => e.personaId === pid && e.touchpointId === currentTp.id)
				: undefined;
			const proposedEvt = proposedTp
				? proposedEvents.find((e) => e.personaId === pid && e.touchpointId === proposedTp.id)
				: undefined;

			data.push({
				touchpointName: tpName,
				personaName: personaMap.get(pid) ?? pid,
				currentScore: currentEvt?.comprehensionScore ?? null,
				proposedScore: proposedEvt?.comprehensionScore ?? null,
			});
		}
	}

	return data;
}

export default async function SimulationDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const [simulation, touchpointRows, eventRows, reportRow, personaRows] = await Promise.all([
		db.select().from(simulations).where(eq(simulations.id, id)).get(),
		db
			.select({
				id: touchpoints.id,
				name: touchpoints.name,
				order: touchpoints.order,
				runType: touchpoints.runType,
			})
			.from(touchpoints)
			.where(eq(touchpoints.simulationId, id))
			.all(),
		db
			.select({
				touchpointId: events.touchpointId,
				personaId: events.personaId,
				comprehensionScore: events.comprehensionScore,
				wouldProceed: events.wouldProceed,
				runType: events.runType,
			})
			.from(events)
			.where(eq(events.simulationId, id))
			.all(),
		db.select().from(reports).where(eq(reports.simulationId, id)).get(),
		db.select({ id: personas.id, name: personas.name }).from(personas).all(),
	]);

	if (!simulation) {
		notFound();
	}

	const status = simulation.status as SimulationStatus;

	const personaMap = new Map(personaRows.map((p) => [p.id, p.name]));

	return (
		<main className="mx-auto max-w-[1200px] px-6 py-8">
			<div className="flex flex-col gap-8">
				<div className="flex items-center gap-3">
					<h1 className="text-2xl font-bold">{simulation.name}</h1>
					<Badge variant={statusVariant[status]}>{status}</Badge>
				</div>

				{status !== "completed" ? (
					<Card>
						<CardContent>
							<p className="text-muted-foreground">
								Simulation is currently <strong>{status}</strong>. Results will appear here once the
								simulation completes.
							</p>
						</CardContent>
					</Card>
				) : (
					<Tabs defaultValue="report">
						<TabsList>
							<TabsTrigger value="report">Report</TabsTrigger>
							<TabsTrigger value="funnel">Dropout Funnel</TabsTrigger>
							<TabsTrigger value="heatmap">Comprehension</TabsTrigger>
							<TabsTrigger value="comparison">Comparison</TabsTrigger>
						</TabsList>

						<TabsContent value="report">
							<Card>
								<CardHeader>
									<CardTitle>Simulation Report</CardTitle>
								</CardHeader>
								<CardContent>
									{reportRow ? (
										<ReportMarkdown content={reportRow.markdown} />
									) : (
										<p className="text-muted-foreground">No report has been generated yet.</p>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="funnel">
							<Card>
								<CardHeader>
									<CardTitle>Dropout Funnel</CardTitle>
								</CardHeader>
								<CardContent>
									<DropoutFunnelChart data={buildFunnelData(touchpointRows, eventRows)} />
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="heatmap">
							<Card>
								<CardHeader>
									<CardTitle>Comprehension Heatmap</CardTitle>
								</CardHeader>
								<CardContent>
									<ComprehensionHeatmap
										data={buildHeatmapData(touchpointRows, eventRows, personaMap)}
									/>
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="comparison">
							<Card>
								<CardHeader>
									<CardTitle>Current vs Proposed</CardTitle>
								</CardHeader>
								<CardContent>
									<ComparisonTable
										data={buildComparisonData(touchpointRows, eventRows, personaMap)}
									/>
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>
				)}
			</div>
		</main>
	);
}
