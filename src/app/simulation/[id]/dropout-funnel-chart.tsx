"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";

interface FunnelDatum {
	touchpointName: string;
	activeCount: number;
}

const chartConfig: ChartConfig = {
	activeCount: {
		label: "Active Personas",
		color: "hsl(142 71% 45%)",
	},
};

function getBarColor(current: number, total: number): string {
	if (total === 0) return "var(--color-activeCount)";
	const ratio = current / total;
	if (ratio >= 0.8) return "hsl(142 71% 45%)"; // green
	if (ratio >= 0.5) return "hsl(48 96% 53%)"; // yellow
	if (ratio > 0) return "hsl(25 95% 53%)"; // orange
	return "hsl(0 84% 60%)"; // red
}

export function DropoutFunnelChart({ data }: { data: FunnelDatum[] }) {
	if (data.length === 0) {
		return <p className="text-sm text-muted-foreground">No funnel data available.</p>;
	}

	const maxCount = Math.max(...data.map((d) => d.activeCount), 1);

	const coloredData = data.map((d) => ({
		...d,
		fill: getBarColor(d.activeCount, maxCount),
		label: `${String(d.activeCount)} / ${String(maxCount)}`,
	}));

	return (
		<div className="space-y-2">
			<p className="text-xs text-muted-foreground">
				Personas still active at each touchpoint (current flow, {String(maxCount)} started)
			</p>
			<ChartContainer config={chartConfig} className="min-h-[300px] w-full">
				<BarChart data={coloredData} layout="vertical">
					<CartesianGrid horizontal={false} />
					<YAxis
						dataKey="touchpointName"
						type="category"
						tickLine={false}
						axisLine={false}
						width={160}
						tick={{ fontSize: 12 }}
					/>
					<XAxis
						type="number"
						allowDecimals={false}
						domain={[0, maxCount]}
						tickCount={maxCount + 1}
					/>
					<ChartTooltip content={<ChartTooltipContent />} />
					<Bar dataKey="activeCount" radius={[0, 4, 4, 0]}>
						<LabelList dataKey="label" position="right" className="fill-foreground text-xs" />
					</Bar>
				</BarChart>
			</ChartContainer>
		</div>
	);
}
