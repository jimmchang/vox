import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { personaSchema } from "@/personas/schema";

describe("personaSchema", () => {
	const validPersona = {
		id: "crypto-novice-marcus",
		name: "Marcus Chen",
		version: 1,
		domain: "defi",
		domain_literacy: "low",
		mental_model:
			'Thinks USDC is the same everywhere. Doesn\'t understand that "USDC on Arbitrum" is different from "USDC on Ethereum." Confuses gas fees with bridge fees.\n',
		misconceptions: [
			"Bridging is like sending to another wallet",
			"Gas fees are the same on every chain",
		],
		task: "Bridge 100 USDC from Ethereum to Arbitrum",
		entry_context: "Clicked a link from a friend who said Arbitrum is cheaper",
		patience: "low",
		risk_tolerance: "low",
		reads_tooltips: true,
		abandons_when: "Sees unfamiliar terminology or unexpected fees",
		age: 28,
		profession: "Graphic designer",
		tech_comfort: "medium",
		history: [
			{
				date: "2026-04-01",
				change: "Initial creation from DeFi cohort generation",
			},
		],
	};

	it("parses a valid persona object", () => {
		const result = personaSchema.parse(validPersona);
		expect(result.id).toBe("crypto-novice-marcus");
		expect(result.name).toBe("Marcus Chen");
		expect(result.version).toBe(1);
		expect(result.domain).toBe("defi");
		expect(result.domain_literacy).toBe("low");
		expect(result.misconceptions).toHaveLength(2);
		expect(result.patience).toBe("low");
		expect(result.risk_tolerance).toBe("low");
		expect(result.reads_tooltips).toBe(true);
		expect(result.age).toBe(28);
		expect(result.profession).toBe("Graphic designer");
		expect(result.tech_comfort).toBe("medium");
		expect(result.history).toHaveLength(1);
	});

	it("throws ZodError when required field 'id' is missing", () => {
		const { id: _id, ...withoutId } = validPersona;
		expect(() => personaSchema.parse(withoutId)).toThrow(ZodError);
	});

	it("throws ZodError when required field 'name' is missing", () => {
		const { name: _name, ...withoutName } = validPersona;
		expect(() => personaSchema.parse(withoutName)).toThrow(ZodError);
	});

	it("throws ZodError when required field 'domain' is missing", () => {
		const { domain: _domain, ...withoutDomain } = validPersona;
		expect(() => personaSchema.parse(withoutDomain)).toThrow(ZodError);
	});

	it("throws ZodError when required field 'task' is missing", () => {
		const { task: _task, ...withoutTask } = validPersona;
		expect(() => personaSchema.parse(withoutTask)).toThrow(ZodError);
	});

	it("throws ZodError when version is not a number", () => {
		expect(() => personaSchema.parse({ ...validPersona, version: "one" })).toThrow(ZodError);
	});

	it("throws ZodError when domain_literacy has invalid value", () => {
		expect(() => personaSchema.parse({ ...validPersona, domain_literacy: "super-high" })).toThrow(
			ZodError,
		);
	});

	it("throws ZodError when misconceptions is not an array", () => {
		expect(() => personaSchema.parse({ ...validPersona, misconceptions: "just a string" })).toThrow(
			ZodError,
		);
	});

	it("throws ZodError when reads_tooltips is not a boolean", () => {
		expect(() => personaSchema.parse({ ...validPersona, reads_tooltips: "yes" })).toThrow(ZodError);
	});

	it("throws ZodError when history entry is missing required fields", () => {
		expect(() =>
			personaSchema.parse({
				...validPersona,
				history: [{ date: "2026-04-01" }],
			}),
		).toThrow(ZodError);
	});
});
