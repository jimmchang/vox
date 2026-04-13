"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface SimulationSummary {
	id: string;
	name: string;
	status: string;
	createdAt: string;
}

interface EventData {
	touchpointId: string;
	personaId: string;
	comprehensionScore: number;
	trustScore: number;
	wouldProceed: boolean;
	runType: string;
}

interface TouchpointData {
	id: string;
	name: string;
	order: number;
	runType: string;
}

interface SimulationDetail {
	id: string;
	name: string;
	touchpoints: TouchpointData[];
	events: EventData[];
}

interface ComparisonRow {
	touchpointName: string;
	personaId: string;
	scoreA: number | null;
	scoreB: number | null;
}

function buildComparisonRows(a: SimulationDetail, b: SimulationDetail): ComparisonRow[] {
	const tpA = a.touchpoints
		.filter((tp) => tp.runType === "current")
		.sort((x, y) => x.order - y.order);
	const tpB = b.touchpoints
		.filter((tp) => tp.runType === "current")
		.sort((x, y) => x.order - y.order);

	const eventsA = a.events.filter((e) => e.runType === "current");
	const eventsB = b.events.filter((e) => e.runType === "current");

	const personaIds = [
		...new Set([...eventsA.map((e) => e.personaId), ...eventsB.map((e) => e.personaId)]),
	].sort();

	const maxLen = Math.max(tpA.length, tpB.length);
	const rows: ComparisonRow[] = [];

	for (let i = 0; i < maxLen; i++) {
		const currentTpA = tpA[i];
		const currentTpB = tpB[i];
		const tpName = currentTpA?.name ?? currentTpB?.name ?? `Touchpoint ${String(i + 1)}`;

		for (const pid of personaIds) {
			const evtA = currentTpA
				? eventsA.find((e) => e.personaId === pid && e.touchpointId === currentTpA.id)
				: undefined;
			const evtB = currentTpB
				? eventsB.find((e) => e.personaId === pid && e.touchpointId === currentTpB.id)
				: undefined;

			rows.push({
				touchpointName: tpName,
				personaId: pid,
				scoreA: evtA?.comprehensionScore ?? null,
				scoreB: evtB?.comprehensionScore ?? null,
			});
		}
	}

	return rows;
}

function deltaLabel(scoreA: number | null, scoreB: number | null): string {
	if (scoreA === null || scoreB === null) {
		return "-";
	}
	const diff = scoreB - scoreA;
	if (diff > 0) {
		return `+${String(diff)}`;
	}
	return String(diff);
}

function deltaVariant(
	scoreA: number | null,
	scoreB: number | null,
): "default" | "secondary" | "destructive" {
	if (scoreA === null || scoreB === null) {
		return "secondary";
	}
	const diff = scoreB - scoreA;
	if (diff > 0) {
		return "default";
	}
	if (diff < 0) {
		return "destructive";
	}
	return "secondary";
}

function SummaryStats({ rows }: { rows: ComparisonRow[] }) {
	let improved = 0;
	let regressed = 0;
	let unchanged = 0;

	for (const row of rows) {
		if (row.scoreA === null || row.scoreB === null) {
			continue;
		}
		const diff = row.scoreB - row.scoreA;
		if (diff > 0) {
			improved++;
		} else if (diff < 0) {
			regressed++;
		} else {
			unchanged++;
		}
	}

	return (
		<div className="flex gap-6">
			<div className="flex flex-col gap-1">
				<span className="text-sm text-muted-foreground">Improved</span>
				<span className="text-2xl font-semibold text-foreground">{improved}</span>
			</div>
			<div className="flex flex-col gap-1">
				<span className="text-sm text-muted-foreground">Regressed</span>
				<span className="text-2xl font-semibold text-foreground">{regressed}</span>
			</div>
			<div className="flex flex-col gap-1">
				<span className="text-sm text-muted-foreground">Unchanged</span>
				<span className="text-2xl font-semibold text-foreground">{unchanged}</span>
			</div>
		</div>
	);
}

function ComparisonTable({
	rows,
	nameA,
	nameB,
}: {
	rows: ComparisonRow[];
	nameA: string;
	nameB: string;
}) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Touchpoint</TableHead>
					<TableHead>Persona</TableHead>
					<TableHead className="text-right">{nameA}</TableHead>
					<TableHead className="text-right">{nameB}</TableHead>
					<TableHead className="text-right">Delta</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((row) => (
					<TableRow key={`${row.touchpointName}-${row.personaId}`}>
						<TableCell className="font-medium">{row.touchpointName}</TableCell>
						<TableCell className="text-muted-foreground">{row.personaId}</TableCell>
						<TableCell className="text-right">
							{row.scoreA !== null ? String(row.scoreA) : "-"}
						</TableCell>
						<TableCell className="text-right">
							{row.scoreB !== null ? String(row.scoreB) : "-"}
						</TableCell>
						<TableCell className="text-right">
							<Badge variant={deltaVariant(row.scoreA, row.scoreB)}>
								{deltaLabel(row.scoreA, row.scoreB)}
							</Badge>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

export default function ComparePage() {
	const [simulations, setSimulations] = useState<SimulationSummary[]>([]);
	const [idA, setIdA] = useState<string | null>(null);
	const [idB, setIdB] = useState<string | null>(null);
	const [detailA, setDetailA] = useState<SimulationDetail | null>(null);
	const [detailB, setDetailB] = useState<SimulationDetail | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function loadSimulations() {
			const res = await fetch("/api/simulations");
			const data: SimulationSummary[] = (await res.json()) as SimulationSummary[];
			setSimulations(data);
			setLoading(false);
		}
		void loadSimulations();
	}, []);

	useEffect(() => {
		if (!idA) {
			setDetailA(null);
			return;
		}
		async function loadDetail() {
			const res = await fetch(`/api/simulations/${idA}`);
			const data = (await res.json()) as SimulationDetail;
			setDetailA(data);
		}
		void loadDetail();
	}, [idA]);

	useEffect(() => {
		if (!idB) {
			setDetailB(null);
			return;
		}
		async function loadDetail() {
			const res = await fetch(`/api/simulations/${idB}`);
			const data = (await res.json()) as SimulationDetail;
			setDetailB(data);
		}
		void loadDetail();
	}, [idB]);

	if (loading) {
		return (
			<main className="mx-auto max-w-[1200px] px-6 py-8">
				<h1 className="text-2xl font-semibold">Compare Simulations</h1>
				<p className="mt-4 text-muted-foreground">Loading simulations...</p>
			</main>
		);
	}

	if (simulations.length < 2) {
		return (
			<main className="mx-auto max-w-[1200px] px-6 py-8">
				<h1 className="text-2xl font-semibold">Compare Simulations</h1>
				<div className="flex flex-col items-center gap-2 py-16 text-center">
					<p className="text-lg font-medium text-muted-foreground">Not enough simulations</p>
					<p className="text-sm text-muted-foreground">
						You need at least two completed simulations to compare results.
					</p>
				</div>
			</main>
		);
	}

	const comparisonRows = detailA && detailB ? buildComparisonRows(detailA, detailB) : null;

	return (
		<main className="mx-auto max-w-[1200px] px-6 py-8">
			<div className="flex flex-col gap-8">
				<h1 className="text-2xl font-semibold">Compare Simulations</h1>

				<div className="flex gap-4">
					<div className="flex flex-col gap-2">
						<span className="text-sm font-medium text-muted-foreground">Simulation A</span>
						<Select
							value={idA ?? undefined}
							onValueChange={(val) => {
								setIdA(val);
							}}
						>
							<SelectTrigger className="w-[280px]">
								<SelectValue placeholder="Select simulation..." />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{simulations.map((sim) => (
										<SelectItem key={sim.id} value={sim.id}>
											{sim.name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-2">
						<span className="text-sm font-medium text-muted-foreground">Simulation B</span>
						<Select
							value={idB ?? undefined}
							onValueChange={(val) => {
								setIdB(val);
							}}
						>
							<SelectTrigger className="w-[280px]">
								<SelectValue placeholder="Select simulation..." />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{simulations.map((sim) => (
										<SelectItem key={sim.id} value={sim.id}>
											{sim.name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</div>
				</div>

				{comparisonRows !== null ? (
					<div className="flex flex-col gap-6">
						<Card>
							<CardHeader>
								<CardTitle>Summary</CardTitle>
							</CardHeader>
							<CardContent>
								<SummaryStats rows={comparisonRows} />
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Comprehension Scores by Touchpoint</CardTitle>
							</CardHeader>
							<CardContent>
								<ComparisonTable
									rows={comparisonRows}
									nameA={detailA?.name ?? "A"}
									nameB={detailB?.name ?? "B"}
								/>
							</CardContent>
						</Card>
					</div>
				) : idA && idB ? (
					<p className="text-muted-foreground">Loading comparison data...</p>
				) : (
					<p className="text-muted-foreground">
						Select two simulations above to see the comparison.
					</p>
				)}
			</div>
		</main>
	);
}
