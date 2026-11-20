// Runs the hand-ported ES5 extractor that the iOS app injects into its WebView
// (mobile-app/src/lib/extractorScript.ts) against the same retailer fixtures
// as the extension, so the two copies can't silently drift on these pages.
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractorScript } from "../../../../mobile-app/src/lib/extractorScript";
import { retailerFixtures } from "./__fixtures__/retailers";

const originalLocation = window.location;

function loadPage(url: string, head: string, body: string) {
	const parsed = new URL(url);
	Object.defineProperty(window, "location", {
		configurable: true,
		writable: true,
		value: {
			href: parsed.href,
			hostname: parsed.hostname,
			pathname: parsed.pathname,
			search: parsed.search,
			origin: parsed.origin,
			protocol: parsed.protocol,
			host: parsed.host,
		},
	});
	document.head.innerHTML = head;
	document.body.innerHTML = body;
	for (const s of Array.from(document.head.querySelectorAll("script"))) {
		const copy = document.createElement("script");
		copy.type = s.type;
		copy.textContent = s.textContent;
		s.replaceWith(copy);
	}
}

type MobileMessage = {
	type: string;
	data?: Record<string, string | undefined>;
	error?: string;
};

function installBridge(): MobileMessage[] {
	const messages: MobileMessage[] = [];
	(window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = {
		postMessage: (raw: string) => messages.push(JSON.parse(raw)),
	};
	return messages;
}

// Equivalent of the app's webViewRef.injectJavaScript(extractorScript).
function inject() {
	new Function(extractorScript)();
}

function runMobileScript(): MobileMessage[] {
	const messages = installBridge();
	inject();
	return messages;
}

afterEach(() => {
	Object.defineProperty(window, "location", {
		configurable: true,
		writable: true,
		value: originalLocation,
	});
	document.head.innerHTML = "";
	document.body.innerHTML = "";
	delete (window as unknown as { __toteExtractorWatch?: unknown })
		.__toteExtractorWatch;
	vi.useRealTimers();
});

describe("mobile WebView extractor — retailer parity", () => {
	for (const fixture of retailerFixtures) {
		it(fixture.name, () => {
			loadPage(fixture.url, fixture.head, fixture.body);
			const [message] = runMobileScript();
			expect(message.type).toBe("METADATA_RESULT");
			expect(message.data?.title).toBe(fixture.expected.title);
			expect(message.data?.price).toBe(fixture.expected.price);
			expect(message.data?.imageUrl).toBe(fixture.expected.imageUrl);
		});
	}

	const targetBeforeHydration = () =>
		loadPage(
			"https://www.target.com/p/holiday-throw-wondershop/-/A-1014483528",
			`<meta property="og:image" content="https://target.scene7.com/is/image/Target/GUEST_f06ea356-6235-4a1a-8e64-4b5f21ec486d">`,
			`<h1 data-test="product-title">Holiday Candy Cane Throw - Wondershop™</h1><div id="price-slot"></div><div id="carousel"></div>`,
		);
	const renderPrice = () => {
		const slot = document.getElementById("price-slot");
		if (slot) slot.innerHTML = `<span data-test="product-price">$10.00</span>`;
	};

	it("reports Target's client-rendered price as soon as it appears", async () => {
		vi.useFakeTimers();
		targetBeforeHydration();
		const messages = runMobileScript();
		await vi.advanceTimersByTimeAsync(600);
		expect(messages).toHaveLength(0);

		// Hydration fetches the store price; the observer picks it up within
		// one check interval rather than waiting on a polling tick.
		renderPrice();
		await vi.advanceTimersByTimeAsync(150);
		expect(messages).toHaveLength(1);
		expect(messages[0].data?.price).toBe("10.00");

		// The timeout was cleared: no second, competing result.
		await vi.advanceTimersByTimeAsync(5000);
		expect(messages).toHaveLength(1);
	});

	it("is not starved by a carousel that mutates continuously", async () => {
		vi.useFakeTimers();
		targetBeforeHydration();
		const carousel = document.getElementById("carousel");
		let frame = 0;
		const spin = setInterval(() => {
			if (carousel) carousel.textContent = `slide ${frame++}`;
		}, 20);
		const messages = runMobileScript();
		await vi.advanceTimersByTimeAsync(500);
		renderPrice();
		await vi.advanceTimersByTimeAsync(150);
		clearInterval(spin);
		expect(messages).toHaveLength(1);
		expect(messages[0].data?.price).toBe("10.00");
	});

	it("gives up after 4s and reports what it has", async () => {
		vi.useFakeTimers();
		loadPage(
			"https://www.target.com/p/x/-/A-1",
			`<meta property="og:image" content="https://target.scene7.com/is/image/Target/GUEST_x">`,
			`<h1 data-test="product-title">Out of stock thing</h1>`,
		);
		const messages = runMobileScript();
		await vi.advanceTimersByTimeAsync(3900);
		expect(messages).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(100);
		expect(messages).toHaveLength(1);
		expect(messages[0].data?.title).toBe("Out of stock thing");
		expect(messages[0].data?.price).toBeUndefined();
	});

	it("a repeat onLoadEnd injection doesn't start a second watcher", async () => {
		vi.useFakeTimers();
		targetBeforeHydration();
		const messages = installBridge();
		inject();
		inject(); // onLoadEnd fired again for the same document
		renderPrice();
		await vi.advanceTimersByTimeAsync(5000);
		expect(messages).toHaveLength(1);
		expect(messages[0].data?.price).toBe("10.00");
	});

	it("re-extracts on a later injection once the first has reported", async () => {
		vi.useFakeTimers();
		const fixture = retailerFixtures[0];
		loadPage(fixture.url, fixture.head, fixture.body);
		const messages = installBridge();
		inject();
		inject(); // e.g. SPA navigation inside the same document
		expect(messages).toHaveLength(2);
	});

	it("reports immediately on non-retailer pages (no waiting)", () => {
		loadPage(
			"https://example.com/blog/post",
			`<meta property="og:title" content="A blog post">`,
			"<p>No product here</p>",
		);
		const messages = runMobileScript();
		expect(messages).toHaveLength(1);
		expect(messages[0].data?.title).toBe("A blog post");
	});
});
