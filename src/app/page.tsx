import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
	return (
		<main className="mx-auto max-w-[800px] px-6 py-12">
			<div className="flex flex-col gap-10">
				<div>
					<h1 className="text-3xl font-bold">Vox</h1>
					<p className="mt-2 text-lg text-muted-foreground">
						Product experience simulation tool. This is a read-only dashboard — simulations are run
						from the CLI using the{" "}
						<code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">/vox</code> skill in
						Claude Code.
					</p>
				</div>

				<div className="flex flex-col gap-4">
					<h2 className="text-xl font-semibold">How it works</h2>
					<div className="grid gap-4 sm:grid-cols-2">
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-base">1. Run a simulation</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground">
								In Claude Code, type{" "}
								<code className="rounded bg-muted px-1 py-0.5 font-mono">/vox</code> and paste a
								PRD. The skill extracts touchpoints, selects personas, and simulates each persona
								walking through the flow.
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-base">2. Review results here</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground">
								This dashboard visualizes what happened. Browse simulation reports, dropout funnels,
								comprehension heatmaps, and current-vs-proposed comparisons.
							</CardContent>
						</Card>
					</div>
				</div>

				<div className="flex flex-col gap-4">
					<h2 className="text-xl font-semibold">Reading the dashboard</h2>
					<div className="flex flex-col gap-3">
						<DashboardGuide
							title="Simulations"
							href="/simulations"
							description="List of all simulation runs. Each row shows persona count, touchpoints, and completion rate (% of touchpoint visits where the persona proceeded)."
						/>
						<DashboardGuide
							title="Simulation detail"
							href="/simulations"
							description="Click into a simulation to see: the full markdown report, a dropout funnel (how many personas survived each step), a comprehension heatmap (scores 1-10 per persona per touchpoint), and a current-vs-proposed comparison table."
						/>
						<DashboardGuide
							title="Personas"
							href="/personas"
							description="Browse the persona library grouped by domain. Each persona has a literacy level, mental model, misconceptions, and abandonment triggers defined in YAML."
						/>
						<DashboardGuide
							title="Compare"
							href="/compare"
							description="Side-by-side comparison of current vs proposed flows across all personas and touchpoints."
						/>
					</div>
				</div>

				<div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-6">
					<h2 className="text-base font-semibold">Quick start</h2>
					<ol className="ml-5 list-decimal space-y-2 text-sm text-muted-foreground">
						<li>Open Claude Code in this project directory</li>
						<li>
							Type <code className="rounded bg-muted px-1 py-0.5 font-mono">/vox</code> and select
							&quot;Test a PRD&quot;
						</li>
						<li>Paste your product requirements document</li>
						<li>
							Run <code className="rounded bg-muted px-1 py-0.5 font-mono">npm run dev</code> and
							open this dashboard to view results
						</li>
					</ol>
				</div>
			</div>
		</main>
	);
}

function DashboardGuide({
	title,
	href,
	description,
}: {
	title: string;
	href: string;
	description: string;
}) {
	return (
		<Link
			href={href}
			className="group flex flex-col gap-1 rounded-lg border p-4 transition-colors hover:bg-muted/50"
		>
			<span className="text-sm font-medium group-hover:underline">{title}</span>
			<span className="text-sm text-muted-foreground">{description}</span>
		</Link>
	);
}
