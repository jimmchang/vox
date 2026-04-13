import Anthropic from "@anthropic-ai/sdk";

interface Touchpoint {
	id: string;
	type: string;
	name: string;
	order: number;
	content: string;
	available_actions: string[];
	requires_prior_knowledge: string[];
	critical_path_metrics: string[];
}

interface MessageCreateParams {
	model: string;
	max_tokens: number;
	messages: Array<{ role: string; content: string }>;
}

interface MessageResponse {
	content: Array<{ type: string; text: string }>;
}

interface AnthropicClient {
	messages: {
		create: (params: MessageCreateParams) => Promise<MessageResponse>;
	};
}

function buildPrompt(text: string, targetMetrics: string[]): string {
	return `Extract all user touchpoints from the following product document. Return a JSON array of touchpoint objects.

Each touchpoint must have these fields:
- id: a unique kebab-case identifier (e.g. "tp-cart-review")
- type: the touchpoint type (e.g. "page", "form", "modal")
- name: human-readable name
- order: sequential number starting from 1
- content: description of what happens at this touchpoint
- available_actions: array of actions the user can take
- requires_prior_knowledge: array of knowledge the user needs
- critical_path_metrics: array of relevant metrics from this list: ${targetMetrics.join(", ")}

Return ONLY valid JSON, no other text.

Document:
${text}`;
}

async function callApi(
	client: AnthropicClient,
	text: string,
	targetMetrics: string[],
): Promise<string> {
	const response = await client.messages.create({
		model: "claude-sonnet-4-20250514",
		max_tokens: 4096,
		messages: [{ role: "user", content: buildPrompt(text, targetMetrics) }],
	});

	const firstBlock = response.content[0];
	if (!firstBlock || firstBlock.type !== "text") {
		throw new Error("Unexpected response format from API");
	}
	return firstBlock.text;
}

export async function extractTouchpoints(
	text: string,
	targetMetrics: string[],
	client?: AnthropicClient,
): Promise<Touchpoint[]> {
	if (!text.trim()) {
		throw new Error("Input text must not be empty");
	}

	const resolvedClient: AnthropicClient = client ?? (new Anthropic() as unknown as AnthropicClient);

	const rawText = await callApi(resolvedClient, text, targetMetrics);

	try {
		return JSON.parse(rawText) as Touchpoint[];
	} catch {
		// Retry once
		const retryText = await callApi(resolvedClient, text, targetMetrics);
		try {
			return JSON.parse(retryText) as Touchpoint[];
		} catch {
			throw new Error(`Failed to parse touchpoints after retry. Raw response: ${retryText}`);
		}
	}
}
