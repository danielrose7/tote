#!/usr/bin/env tsx
/**
 * Test Jina Reader (r.jina.ai) against bot-blocked URLs.
 * Usage: JINA_API_KEY=xxx npx tsx scripts/test-jina-reader.ts
 */

const URLS = [
	"https://shop.lululemon.com/a/running-jacket-with-phone-pocket-2aaz00a",
	"https://www.patagonia.com/shop/womens/jackets-vests/lightweight/slim",
	"https://www.titlenine.com/womens-shorts",
];

async function testUrl(apiKey: string, url: string): Promise<void> {
	const start = Date.now();
	console.log(`\n${"─".repeat(60)}`);
	console.log(`URL: ${url}`);

	try {
		const res = await fetch(`https://r.jina.ai/${url}`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				Accept: "text/plain",
				"X-Return-Format": "markdown",
			},
			signal: AbortSignal.timeout(30_000),
		});

		const ms = Date.now() - start;
		console.log(`Status: ${res.status} | Time: ${ms}ms`);

		if (!res.ok) {
			console.log(`ERROR: ${res.statusText}`);
			return;
		}

		const text = await res.text();
		console.log(`Length: ${text.length} chars`);
		console.log(`\nPreview (first 800 chars):\n${text.slice(0, 800)}`);
	} catch (err) {
		const ms = Date.now() - start;
		console.log(`ERROR: ${String(err)} | Time: ${ms}ms`);
	}
}

async function main() {
	const apiKey = process.env.JINA_API_KEY;
	if (!apiKey) {
		console.error("JINA_API_KEY not set");
		process.exit(1);
	}

	console.log("Testing Jina Reader (r.jina.ai)");

	for (const url of URLS) {
		await testUrl(apiKey, url);
	}

	console.log(`\n${"─".repeat(60)}`);
	console.log("Done.");
}

main().catch(console.error);
