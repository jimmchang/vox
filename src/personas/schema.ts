import { z } from "zod";

const literacyEnum = z.enum(["low", "medium", "high"]);

const historyEntrySchema = z.object({
	date: z.string(),
	change: z.string(),
});

export const personaSchema = z.object({
	id: z.string(),
	name: z.string(),
	version: z.number(),
	domain: z.string(),
	domain_literacy: literacyEnum,
	mental_model: z.string(),
	misconceptions: z.array(z.string()),
	task: z.string(),
	entry_context: z.string(),
	patience: literacyEnum,
	risk_tolerance: literacyEnum,
	reads_tooltips: z.boolean(),
	abandons_when: z.string(),
	age: z.number().optional(),
	profession: z.string().optional(),
	tech_comfort: literacyEnum.optional(),
	history: z.array(historyEntrySchema),
});

export type Persona = z.infer<typeof personaSchema>;
