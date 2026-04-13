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
	currentCompleted: number;
	currentTotal: number;
	proposedCompleted: number;
	proposedTotal: number;
}

function flowRate(completed: number, total: number): string {
	if (total === 0) return "-";
	return `${String(completed)}/${String(total)}`;
}

function SimulationTable({ rows }: { rows: SimulationRow[] }) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Name</TableHead>
					<TableHead>Date</TableHead>
					<TableHead className="text-right">Personas</TableHead>
					<TableHead className="text-right">Current</TableHead>
					<TableHead className="text-right">Proposed</TableHead>
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
						<TableCell className="text-right font-mono text-sm">
							{flowRate(row.currentCompleted, row.currentTotal)}
						</TableCell>
						<TableCell className="text-right font-mono text-sm">
							{flowRate(row.proposedCompleted, row.proposedTotal)}
						</TableCell>
						<TableCell>
							<StatusBadge status={row.status} />
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

export default function SimulationsPage() {
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
			currentCompleted: sql<number>`(SELECT COUNT(DISTINCT e.persona_id) FROM events e
					INNER JOIN touchpoints t ON e.touchpoint_id = t.id
					WHERE e.simulation_id = simulations.id
					AND e.run_type = 'current'
					AND e.touchpoint_order = (SELECT MAX(t2."order") FROM touchpoints t2 WHERE t2.simulation_id = simulations.id AND t2.run_type = 'current')
					AND e.would_proceed = 1)`.as("current_completed"),
			currentTotal:
				sql<number>`(SELECT COUNT(DISTINCT persona_id) FROM events WHERE events.simulation_id = simulations.id AND events.run_type = 'current')`.as(
					"current_total",
				),
			proposedCompleted: sql<number>`(SELECT COUNT(DISTINCT e.persona_id) FROM events e
					INNER JOIN touchpoints t ON e.touchpoint_id = t.id
					WHERE e.simulation_id = simulations.id
					AND e.run_type = 'proposed'
					AND e.touchpoint_order = (SELECT MAX(t2."order") FROM touchpoints t2 WHERE t2.simulation_id = simulations.id AND t2.run_type = 'proposed')
					AND e.would_proceed = 1)`.as("proposed_completed"),
			proposedTotal:
				sql<number>`(SELECT COUNT(DISTINCT persona_id) FROM events WHERE events.simulation_id = simulations.id AND events.run_type = 'proposed')`.as(
					"proposed_total",
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
			<div className="flex flex-col gap-6">
				<div>
					<h1 className="text-2xl font-semibold">Simulations</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Current and Proposed columns show how many personas completed the full flow.
					</p>
				</div>
				<SimulationTable rows={rows} />
			</div>
		</main>
	);
}
