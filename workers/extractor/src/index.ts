import type { Page } from '@cloudflare/puppeteer';
import puppeteer from '@cloudflare/puppeteer';
import { extractorScript } from '../../../mobile-app/src/lib/extractorScript';

interface Env {
  BROWSER: Fetcher;
  EXTRACTOR_SECRET: string;
}

// Adapt extractorScript (mobile WebView variant) for page.evaluate():
// replace ReactNativeWebView.postMessage calls with return statements.
const evaluateScript = extractorScript
  .replace(
    "window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'METADATA_RESULT', data: result }));",
    'return result;',
  )
  .replace(
    "window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'METADATA_ERROR', error: String(e) }));",
    'return null;',
  )
  .replace('\ntrue; // required by injectJavaScript\n', '');

// ── Challenge bypass helpers ────────────────────────────────────────────────

type Point = [number, number];

function cubicBezierPoint(
  t: number,
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
): Point {
  const mt = 1 - t;
  return [
    mt ** 3 * p0[0] +
      3 * mt ** 2 * t * p1[0] +
      3 * mt * t ** 2 * p2[0] +
      t ** 3 * p3[0],
    mt ** 3 * p0[1] +
      3 * mt ** 2 * t * p1[1] +
      3 * mt * t ** 2 * p2[1] +
      t ** 3 * p3[1],
  ];
}

// Human-like spiral: rough spiral waypoints with jitter, connected by cubic
// bezier curves with randomised control points so the path is never a perfect
// mathematical arc. Speed also varies per segment.
async function spiralMouseMove(page: Page): Promise<void> {
  const vp = page.viewport() ?? { width: 800, height: 600 };
  const cx = vp.width / 2;
  const cy = vp.height / 2;

  // Build spiral waypoints with per-point radius and positional jitter
  const NUM_WAYPOINTS = 18;
  const waypoints: Point[] = [];
  for (let i = 0; i <= NUM_WAYPOINTS; i++) {
    const t = i / NUM_WAYPOINTS;
    const angle = t * Math.PI * 4; // two full rotations
    const r = t * 90 + (Math.random() - 0.5) * 14; // jittered radius
    waypoints.push([
      cx + Math.cos(angle) * r + (Math.random() - 0.5) * 10,
      cy + Math.sin(angle) * r + (Math.random() - 0.5) * 10,
    ]);
  }

  // Walk between waypoints via cubic bezier with random control points
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p0 = waypoints[i];
    const p3 = waypoints[i + 1];
    const dx = p3[0] - p0[0];
    const dy = p3[1] - p0[1];
    // Control points pulled slightly off the direct line for organic curves
    const p1: Point = [
      p0[0] + dx * (0.2 + Math.random() * 0.2) + (Math.random() - 0.5) * 18,
      p0[1] + dy * (0.2 + Math.random() * 0.2) + (Math.random() - 0.5) * 18,
    ];
    const p2: Point = [
      p0[0] + dx * (0.6 + Math.random() * 0.2) + (Math.random() - 0.5) * 18,
      p0[1] + dy * (0.6 + Math.random() * 0.2) + (Math.random() - 0.5) * 18,
    ];

    const subSteps = 3 + Math.floor(Math.random() * 4);
    for (let j = 1; j <= subSteps; j++) {
      const [x, y] = cubicBezierPoint(j / subSteps, p0, p1, p2, p3);
      await page.mouse.move(x, y);
      // Vary speed: faster mid-segment, slower near endpoints
      const ease = Math.sin((j / subSteps) * Math.PI); // 0→1→0
      await new Promise((res) =>
        setTimeout(res, 10 + (1 - ease) * 30 + Math.random() * 20),
      );
    }
  }
}

// Attempt to solve a Cloudflare Turnstile challenge ("Just a moment..." /
// "Performing security verification"). Moves the mouse in a spiral first,
// then clicks the checkbox inside the CF challenge iframe.
async function solveTurnstile(page: Page): Promise<void> {
  await spiralMouseMove(page);
  const cfFrame = page
    .frames()
    .find((f) => f.url().includes('challenges.cloudflare.com'));
  if (!cfFrame) return;
  const checkbox = await cfFrame.$('[type="checkbox"]').catch(() => null);
  if (!checkbox) return;
  // elementHandle.click() handles iframe coordinate translation automatically
  await checkbox.click();
  await page
    .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 })
    .catch(() => {});
}

// Wait for a queue/waiting-room page ("Sit tight", "Hang Tight") to
// auto-refresh away. These pages say they'll redirect automatically.
async function waitForQueueExit(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () =>
        !document.title.includes('Sit tight') &&
        !document.title.includes('Hang Tight') &&
        !document.title.includes('Routing to checkout'),
      { timeout: 60_000, polling: 1_000 },
    )
    .catch(() => {});
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const secret = request.headers.get('X-Extractor-Secret');
    if (!env.EXTRACTOR_SECRET || secret !== env.EXTRACTOR_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { url?: string; debug?: boolean };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { url, debug = false } = body;
    if (!url) {
      return Response.json({ error: 'Missing url' }, { status: 400 });
    }

    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
    try {
      browser = await puppeteer.launch(env.BROWSER);
      const page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      );

      let navError: string | null = null;
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
      } catch (err) {
        navError = String(err);
      }

      // Handle challenge/queue pages before attempting extraction
      if (!navError) {
        const title = await page.title().catch(() => '');
        if (
          title.includes('Just a moment') ||
          title.includes('Performing security verification')
        ) {
          await solveTurnstile(page);
        } else if (
          title.includes('Sit tight') ||
          title.includes('Hang Tight') ||
          title.includes('Routing to checkout')
        ) {
          await waitForQueueExit(page);
        }
      }

      // Race two strategies after challenge handling:
      //   stable: wait for network to quiet (up to 8s), then extract once — always terminates
      //   eager:  poll every 750ms, resolve as soon as we have title + price/imageUrl
      // Whichever yields a complete result first wins.
      const stableExtract = async (): Promise<Record<
        string,
        unknown
      > | null> => {
        try {
          await page.waitForNetworkIdle({ idleTime: 500, timeout: 8_000 });
        } catch {}
        return page.evaluate(evaluateScript).catch(() => null);
      };

      const eagerExtract = async (): Promise<Record<
        string,
        unknown
      > | null> => {
        while (true) {
          const result = await page.evaluate(evaluateScript).catch(() => null);
          if (result?.title && (result?.price || result?.imageUrl))
            return result;
          await new Promise((r) => setTimeout(r, 750));
        }
      };

      const data = await Promise.race([stableExtract(), eagerExtract()]);

      if (debug) {
        const screenshotBuffer = await page
          .screenshot({ type: 'jpeg', quality: 60, fullPage: false })
          .catch(() => null);
        const screenshot = screenshotBuffer
          ? Buffer.from(screenshotBuffer).toString('base64')
          : null;
        const pageTitle = await page.title().catch(() => null);
        const finalUrl = page.url();
        return Response.json({
          ok: !navError,
          data,
          debug: { navError, title: pageTitle, finalUrl, screenshot },
        });
      }

      if (navError && !data) {
        return Response.json({ ok: false, error: navError }, { status: 500 });
      }
      return Response.json({ ok: true, data });
    } catch (err) {
      return Response.json({ ok: false, error: String(err) }, { status: 500 });
    } finally {
      await browser?.close();
    }
  },
} satisfies ExportedHandler<Env>;
