import { describe, expect, it, vi } from "vitest";
import { extractTouchpoints } from "@/engine/extractor";

// -- Helpers ------------------------------------------------------------------

/** Minimal touchpoint shape matching the DB schema */
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

const SAMPLE_PRD = `
# Checkout Redesign PRD

## Overview
We are redesigning the checkout flow to reduce cart abandonment.

## Touchpoints
1. Cart Review Page - users review items before checkout
2. Shipping Info Form - users enter shipping details
3. Payment Page - users enter payment information
4. Order Confirmation - users see order summary

## Goals
- Reduce abandonment by 15%
- Increase conversion rate
`;

const TARGET_METRICS = ["cart_abandonment_rate", "conversion_rate"];

const VALID_TOUCHPOINTS: Touchpoint[] = [
	{
		id: "tp-cart-review",
		type: "page",
		name: "Cart Review Page",
		order: 1,
		content: "Users review items in their cart before proceeding to checkout.",
		available_actions: ["proceed_to_shipping", "edit_cart", "remove_item"],
		requires_prior_knowledge: [],
		critical_path_metrics: ["cart_abandonment_rate"],
	},
	{
		id: "tp-shipping-info",
		type: "form",
		name: "Shipping Info Form",
		order: 2,
		content: "Users enter their shipping address and select delivery options.",
		available_actions: ["submit_shipping", "go_back"],
		requires_prior_knowledge: ["shipping_address"],
		critical_path_metrics: ["cart_abandonment_rate"],
	},
	{
		id: "tp-payment",
		type: "page",
		name: "Payment Page",
		order: 3,
		content: "Users enter payment information to complete the purchase.",
		available_actions: ["submit_payment", "go_back", "apply_coupon"],
		requires_prior_knowledge: ["payment_method"],
		critical_path_metrics: ["conversion_rate", "cart_abandonment_rate"],
	},
	{
		id: "tp-confirmation",
		type: "page",
		name: "Order Confirmation",
		order: 4,
		content: "Users see a summary of their completed order.",
		available_actions: ["view_order_details", "continue_shopping"],
		requires_prior_knowledge: [],
		critical_path_metrics: ["conversion_rate"],
	},
];

/**
 * Creates a mock Anthropic client that returns the given content in a
 * messages.create response. The mock tracks calls so tests can assert
 * on invocation count and arguments.
 */
function createMockClient(responseContent: string) {
	const createFn = vi.fn().mockResolvedValue({
		content: [{ type: "text", text: responseContent }],
	});
	return {
		client: { messages: { create: createFn } },
		createFn,
	};
}

/**
 * Creates a mock that fails on the first call with non-JSON, then
 * succeeds on the second call with valid JSON.
 */
function createRetryMockClient(malformedResponse: string, validResponse: string) {
	const createFn = vi
		.fn()
		.mockResolvedValueOnce({
			content: [{ type: "text", text: malformedResponse }],
		})
		.mockResolvedValueOnce({
			content: [{ type: "text", text: validResponse }],
		});
	return {
		client: { messages: { create: createFn } },
		createFn,
	};
}

/**
 * Creates a mock that always returns malformed JSON (both attempts fail).
 */
function createAlwaysMalformedMockClient(malformedResponse: string) {
	const createFn = vi.fn().mockResolvedValue({
		content: [{ type: "text", text: malformedResponse }],
	});
	return {
		client: { messages: { create: createFn } },
		createFn,
	};
}

// -- Tests --------------------------------------------------------------------

describe("extractTouchpoints", () => {
	describe("happy path", () => {
		it("returns an ordered array of touchpoints from PRD text", async () => {
			const { client } = createMockClient(JSON.stringify(VALID_TOUCHPOINTS));

			const result = await extractTouchpoints(SAMPLE_PRD, TARGET_METRICS, client);

			expect(result).toHaveLength(4);
			expect(result[0]?.name).toBe("Cart Review Page");
			expect(result[3]?.name).toBe("Order Confirmation");
		});

		it("each touchpoint has a stable id, type, and order", async () => {
			const { client } = createMockClient(JSON.stringify(VALID_TOUCHPOINTS));

			const result = await extractTouchpoints(SAMPLE_PRD, TARGET_METRICS, client);

			for (const tp of result) {
				expect(tp.id).toBeDefined();
				expect(typeof tp.id).toBe("string");
				expect(tp.id.length).toBeGreaterThan(0);

				expect(tp.type).toBeDefined();
				expect(typeof tp.type).toBe("string");

				expect(tp.order).toBeDefined();
				expect(typeof tp.order).toBe("number");
			}

			// Orders should be sequential
			const orders = result.map((tp) => tp.order);
			for (let i = 1; i < orders.length; i++) {
				const prev = orders[i - 1];
				const curr = orders[i];
				expect(prev).toBeDefined();
				expect(curr).toBeDefined();
				expect(curr).toBeGreaterThan(prev as number);
			}
		});

		it("each touchpoint contains all required schema fields", async () => {
			const { client } = createMockClient(JSON.stringify(VALID_TOUCHPOINTS));

			const result = await extractTouchpoints(SAMPLE_PRD, TARGET_METRICS, client);

			for (const tp of result) {
				expect(tp).toHaveProperty("id");
				expect(tp).toHaveProperty("type");
				expect(tp).toHaveProperty("name");
				expect(tp).toHaveProperty("order");
				expect(tp).toHaveProperty("content");
				expect(tp).toHaveProperty("available_actions");
				expect(tp).toHaveProperty("requires_prior_knowledge");
				expect(tp).toHaveProperty("critical_path_metrics");

				expect(Array.isArray(tp.available_actions)).toBe(true);
				expect(Array.isArray(tp.requires_prior_knowledge)).toBe(true);
				expect(Array.isArray(tp.critical_path_metrics)).toBe(true);
			}
		});

		it("passes target metrics to the API call", async () => {
			const { client, createFn } = createMockClient(JSON.stringify(VALID_TOUCHPOINTS));

			await extractTouchpoints(SAMPLE_PRD, TARGET_METRICS, client);

			expect(createFn).toHaveBeenCalledTimes(1);
			// The prompt sent to Claude should contain the target metrics
			const callArgs = createFn.mock.calls[0] as unknown[];
			const firstArg = callArgs[0] as { messages: Array<{ content: string }> };
			const messages = firstArg.messages as Array<{
				content: string;
			}>;
			const promptText = JSON.stringify(messages);
			expect(promptText).toContain("cart_abandonment_rate");
			expect(promptText).toContain("conversion_rate");
		});
	});

	describe("empty input", () => {
		it("throws a descriptive error before making any API call", async () => {
			const { client, createFn } = createMockClient("[]");

			await expect(extractTouchpoints("", TARGET_METRICS, client)).rejects.toThrow();

			// The mock should never have been called
			expect(createFn).not.toHaveBeenCalled();
		});

		it("throws for whitespace-only input", async () => {
			const { client, createFn } = createMockClient("[]");

			await expect(extractTouchpoints("   \n\t  ", TARGET_METRICS, client)).rejects.toThrow();

			expect(createFn).not.toHaveBeenCalled();
		});
	});

	describe("malformed JSON from Claude", () => {
		it("retries once when Claude returns malformed JSON, then succeeds", async () => {
			const { client, createFn } = createRetryMockClient(
				"Here are the touchpoints: {not valid json",
				JSON.stringify(VALID_TOUCHPOINTS),
			);

			const result = await extractTouchpoints(SAMPLE_PRD, TARGET_METRICS, client);

			expect(createFn).toHaveBeenCalledTimes(2);
			expect(result).toHaveLength(4);
		});

		it("throws with raw response after retry fails", async () => {
			const malformedResponse = "This is not JSON at all {{{";
			const { client, createFn } = createAlwaysMalformedMockClient(malformedResponse);

			await expect(extractTouchpoints(SAMPLE_PRD, TARGET_METRICS, client)).rejects.toThrow(
				malformedResponse,
			);

			expect(createFn).toHaveBeenCalledTimes(2);
		});
	});
});
