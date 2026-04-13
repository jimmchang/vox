export const dynamic = "force-dynamic";

import { sql } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { db } from "@/db";
import { simulations } from "@/db/schema";

type SimulationStatus = "extracting" | "ready" | "running" | "completed" | "failed";

const statusVariant: Record<SimulationStatus, "default" | "secondary" | "destructive"> = {
	completed: "default",
	running: "secondary",
	extracting: "secondary",
	ready: "secondary",
	failed: "destructive",
};

function StatusBadge({ status }: { status: SimulationStatus }) {
	return <Badge variant={statusVariant[status]}>{status}</Badge>;
}

function formatDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function EmptyState() {
	return (
		<div className="flex flex-col items-center gap-2 py-16 text-center">
			<p className="text-lg font-medium text-muted-foreground">No simulations yet</p>
			<p className="text-sm text-muted-foreground">
				Run your first simulation to see results here.
			</p>
		</div>
	);
}

interface SimulationRow {
	id: string;
	name: string;
	status: SimulationStatus;
	createdAt: Date;
	personaCount: number;
	touchpointCount: number;
	totalEvents: number;
	completedEvents: number;
}

function completionRate(row: SimulationRow): string {
	if (row.totalEvents === 0) {
		return "-";
	}
	const pct = Math.round((row.completedEvents / row.totalEvents) * 100);
	return `${String(pct)}%`;
}

function SimulationTable({ rows }: { rows: SimulationRow[] }) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Name</TableHead>
					<TableHead>Date</TableHead>
					<TableHead className="text-right">Personas</TableHead>
					<TableHead className="text-right">Touchpoints</TableHead>
					<TableHead className="text-right">Completion</TableHead>
					<TableHead>Status</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((row) => (
					<TableRow key={row.id}>
						<TableCell>
							<Link
								href={`/simulation/${row.id}`}
								className="font-medium text-foreground hover:underline"
							>
								{row.name}
							</Link>
						</TableCell>
						<TableCell className="text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
						<TableCell className="text-right">{row.personaCount}</TableCell>
						<TableCell className="text-right">{row.touchpointCount}</TableCell>
						<TableCell className="text-right">{completionRate(row)}</TableCell>
						<TableCell>
							<StatusBadge status={row.status} />
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

export default function Home() {
	const rows = db
		.select({
			id: simulations.id,
			name: simulations.name,
			status: simulations.status,
			createdAt: simulations.createdAt,
			personaCount:
				sql<number>`(SELECT COUNT(*) FROM simulation_personas WHERE simulation_personas.simulation_id = simulations.id)`.as(
					"persona_count",
				),
			touchpointCount:
				sql<number>`(SELECT COUNT(*) FROM touchpoints WHERE touchpoints.simulation_id = simulations.id)`.as(
					"touchpoint_count",
				),
			totalEvents:
				sql<number>`(SELECT COUNT(*) FROM events WHERE events.simulation_id = simulations.id)`.as(
					"total_events",
				),
			completedEvents:
				sql<number>`(SELECT COUNT(*) FROM events WHERE events.simulation_id = simulations.id AND events.would_proceed = 1)`.as(
					"completed_events",
				),
		})
		.from(simulations)
		.all();

	if (rows.length === 0) {
		return (
			<main className="mx-auto max-w-[1200px] px-6 py-8">
				<h1 className="text-2xl font-semibold">Simulations</h1>
				<EmptyState />
			</main>
		);
	}

	return (
		<main className="mx-auto max-w-[1200px] px-6 py-8">
			<div className="flex flex-col gap-8">
				<h1 className="text-2xl font-semibold">Simulations</h1>
				<SimulationTable rows={rows} />
			</div>
		</main>
	);
}
