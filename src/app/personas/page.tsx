export const dynamic = "force-dynamic";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { db } from "@/db";
import { personas } from "@/db/schema";

const literacyVariant: Record<string, "default" | "secondary" | "destructive"> = {
	high: "default",
	medium: "secondary",
	low: "destructive",
};

function getLiteracyVariant(literacy: string): "default" | "secondary" | "destructive" {
	return literacyVariant[literacy] ?? "secondary";
}

interface PersonaRow {
	id: string;
	name: string;
	domain: string;
	version: number;
	literacy: string;
}

function groupByDomain(rows: PersonaRow[]): Map<string, PersonaRow[]> {
	const groups = new Map<string, PersonaRow[]>();
	for (const row of rows) {
		const existing = groups.get(row.domain);
		if (existing) {
			existing.push(row);
		} else {
			groups.set(row.domain, [row]);
		}
	}
	return groups;
}

function EmptyState() {
	return (
		<div className="flex flex-col items-center gap-2 py-16 text-center">
			<p className="text-lg font-medium text-muted-foreground">No personas found</p>
			<p className="text-sm text-muted-foreground">
				Add persona YAML files to the personas/ directory and run a sync.
			</p>
		</div>
	);
}

function DomainSection({ domain, rows }: { domain: string; rows: PersonaRow[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="capitalize">{domain}</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Literacy</TableHead>
							<TableHead className="text-right">Version</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow key={row.id}>
								<TableCell className="font-medium">{row.name}</TableCell>
								<TableCell>
									<Badge variant={getLiteracyVariant(row.literacy)}>{row.literacy}</Badge>
								</TableCell>
								<TableCell className="text-right">v{row.version}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

export default function PersonasPage() {
	const rows = db
		.select({
			id: personas.id,
			name: personas.name,
			domain: personas.domain,
			version: personas.version,
			literacy: personas.literacy,
		})
		.from(personas)
		.all();

	if (rows.length === 0) {
		return (
			<main className="mx-auto max-w-[1200px] px-6 py-8">
				<h1 className="text-2xl font-semibold">Persona Library</h1>
				<EmptyState />
			</main>
		);
	}

	const grouped = groupByDomain(rows);
	const sortedDomains = [...grouped.keys()].sort();

	return (
		<main className="mx-auto max-w-[1200px] px-6 py-8">
			<div className="flex flex-col gap-8">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold">Persona Library</h1>
					<p className="text-sm text-muted-foreground">
						{rows.length} persona{rows.length !== 1 ? "s" : ""} across {sortedDomains.length} domain
						{sortedDomains.length !== 1 ? "s" : ""}
					</p>
				</div>
				{sortedDomains.map((domain) => {
					const domainRows = grouped.get(domain);
					if (!domainRows) {
						return null;
					}
					return <DomainSection key={domain} domain={domain} rows={domainRows} />;
				})}
			</div>
		</main>
	);
}
