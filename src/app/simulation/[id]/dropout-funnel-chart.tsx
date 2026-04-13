"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
		color: "var(--chart-1)",
	},
};

export function DropoutFunnelChart({ data }: { data: FunnelDatum[] }) {
	if (data.length === 0) {
		return <p className="text-sm text-muted-foreground">No funnel data available.</p>;
	}

	return (
		<ChartContainer config={chartConfig} className="min-h-[300px] w-full">
			<BarChart data={data} layout="vertical">
				<CartesianGrid horizontal={false} />
				<YAxis
					dataKey="touchpointName"
					type="category"
					tickLine={false}
					axisLine={false}
					width={140}
					tick={{ fontSize: 12 }}
				/>
				<XAxis type="number" allowDecimals={false} />
				<ChartTooltip content={<ChartTooltipContent />} />
				<Bar dataKey="activeCount" fill="var(--color-activeCount)" radius={[0, 4, 4, 0]} />
			</BarChart>
		</ChartContainer>
	);
}
