import { NextResponse } from "next/server";
import { db } from "@/db";
import { personas } from "@/db/schema";

export async function GET() {
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

	return NextResponse.json(rows);
}
