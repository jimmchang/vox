import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface ComparisonDatum {
	touchpointName: string;
	personaName: string;
	currentScore: number | null;
	proposedScore: number | null;
}

function deltaColor(current: number | null, proposed: number | null): string {
	if (current === null || proposed === null) {
		return "";
	}
	if (proposed > current) {
		return "text-green-600 dark:text-green-400";
	}
	if (proposed < current) {
		return "text-red-600 dark:text-red-400";
	}
	return "";
}

function formatScore(score: number | null): string {
	return score !== null ? String(score) : "-";
}

export function ComparisonTable({ data }: { data: ComparisonDatum[] }) {
	if (data.length === 0) {
		return <p className="text-sm text-muted-foreground">No comparison data available.</p>;
	}

	// Group by touchpoint
	const touchpointNames = [...new Set(data.map((d) => d.touchpointName))];
	const personaNames = [...new Set(data.map((d) => d.personaName))];

	const scoreMap = new Map<string, ComparisonDatum>();
	for (const d of data) {
		scoreMap.set(`${d.touchpointName}::${d.personaName}`, d);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Touchpoint</TableHead>
					{personaNames.map((name) => (
						<TableHead key={name} className="text-center" colSpan={2}>
							{name}
						</TableHead>
					))}
				</TableRow>
				<TableRow>
					<TableHead />
					{personaNames.map((name) => (
						<>
							<TableHead key={`${name}-current`} className="text-center text-xs">
								Current
							</TableHead>
							<TableHead key={`${name}-proposed`} className="text-center text-xs">
								Proposed
							</TableHead>
						</>
					))}
				</TableRow>
			</TableHeader>
			<TableBody>
				{touchpointNames.map((tp) => (
					<TableRow key={tp}>
						<TableCell className="font-medium">{tp}</TableCell>
						{personaNames.map((persona) => {
							const datum = scoreMap.get(`${tp}::${persona}`);
							const current = datum?.currentScore ?? null;
							const proposed = datum?.proposedScore ?? null;
							return (
								<>
									<TableCell key={`${tp}::${persona}-current`} className="text-center">
										{formatScore(current)}
									</TableCell>
									<TableCell
										key={`${tp}::${persona}-proposed`}
										className={`text-center ${deltaColor(current, proposed)}`}
									>
										{formatScore(proposed)}
									</TableCell>
								</>
							);
						})}
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
