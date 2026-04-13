"use client";

interface HeatmapDatum {
	touchpointName: string;
	personaName: string;
	score: number;
}

const SCORE_COLORS: Record<number, string> = {
	1: "#ef4444", // red
	2: "#f97316", // orange
	3: "#f59e0b", // amber
	4: "#84cc16", // yellow-green
	5: "#22c55e", // green
};

function getScoreColor(score: number): string {
	return SCORE_COLORS[score] ?? "#6b7280";
}

function getTextColor(score: number): string {
	return score <= 2 ? "#ffffff" : "#000000";
}

export function ComprehensionHeatmap({ data }: { data: HeatmapDatum[] }) {
	if (data.length === 0) {
		return <p className="text-sm text-muted-foreground">No comprehension data available.</p>;
	}

	const touchpointNames = [...new Set(data.map((d) => d.touchpointName))];
	const personaNames = [...new Set(data.map((d) => d.personaName))];

	const scoreMap = new Map<string, number>();
	for (const d of data) {
		scoreMap.set(`${d.touchpointName}::${d.personaName}`, d.score);
	}

	return (
		<div className="overflow-x-auto">
			<div
				className="grid gap-1"
				style={{
					gridTemplateColumns: `140px repeat(${String(personaNames.length)}, minmax(80px, 1fr))`,
				}}
			>
				{/* Header row */}
				<div className="text-xs font-medium text-muted-foreground" />
				{personaNames.map((name) => (
					<div
						key={name}
						className="truncate text-center text-xs font-medium text-muted-foreground"
						title={name}
					>
						{name}
					</div>
				))}

				{/* Data rows */}
				{touchpointNames.map((tp) => (
					<>
						<div
							key={`label-${tp}`}
							className="flex items-center truncate text-xs font-medium"
							title={tp}
						>
							{tp}
						</div>
						{personaNames.map((persona) => {
							const score = scoreMap.get(`${tp}::${persona}`);
							return (
								<div
									key={`${tp}::${persona}`}
									className="flex items-center justify-center rounded-md py-2 text-xs font-bold"
									style={{
										backgroundColor: score !== undefined ? getScoreColor(score) : "#e5e7eb",
										color: score !== undefined ? getTextColor(score) : "#9ca3af",
									}}
									title={score !== undefined ? `${persona} @ ${tp}: ${String(score)}/5` : "No data"}
								>
									{score !== undefined ? String(score) : "-"}
								</div>
							);
						})}
					</>
				))}
			</div>

			{/* Legend */}
			<div className="mt-4 flex items-center gap-4">
				<span className="text-xs text-muted-foreground">Score:</span>
				{[1, 2, 3, 4, 5].map((s) => (
					<div key={s} className="flex items-center gap-1">
						<div className="size-3 rounded-sm" style={{ backgroundColor: getScoreColor(s) }} />
						<span className="text-xs text-muted-foreground">{String(s)}</span>
					</div>
				))}
			</div>
		</div>
	);
}
