/**
 * Headless smoke test for a built RIFTLINE. Loads the page in Chromium, waits until the sim loop
 * has run for a couple of seconds, fails on any console error or failed request, and saves
 * screenshots to smoke-artifacts/.
 *
 *   npm run build && npm run smoke              serves dist/ with `vite preview` and tests it
 *   npm run smoke -- --url https://host/path/   tests an existing deployment instead
 *
 * Playwright is intentionally not a project dependency (it is large and only this optional check
 * uses it). Claude Code cloud sessions have it preinstalled; elsewhere install it globally with
 * `npm i -g playwright && npx playwright install chromium`.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

interface Page {
  on(event: 'console', fn: (msg: { type(): string; text(): string }) => void): void;
  on(event: 'pageerror', fn: (error: Error) => void): void;
  on(
    event: 'requestfailed',
    fn: (req: { url(): string; failure(): { errorText: string } | null }) => void,
  ): void;
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  waitForFunction(fn: string, arg?: unknown, options?: { timeout?: number }): Promise<unknown>;
  evaluate<T>(fn: string): Promise<T>;
  screenshot(options: { path: string }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
}
interface Browser {
  newPage(options?: { viewport?: { width: number; height: number } }): Promise<Page>;
  close(): Promise<void>;
}
interface Playwright {
  chromium: { launch(options?: { args?: string[] }): Promise<Browser> };
}

const PREVIEW_PORT = 4173;
const OUT_DIR = 'smoke-artifacts';

function loadPlaywright(): Playwright {
  try {
    // createRequire resolves through NODE_PATH, where a global Playwright install lives.
    return createRequire(import.meta.url)('playwright') as Playwright;
  } catch {
    console.error(
      'Playwright not found. Install it globally: npm i -g playwright && npx playwright install chromium',
    );
    process.exit(2);
  }
}

async function isUp(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isUp(url)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Preview server did not start at ${url}`);
}

async function main(): Promise<void> {
  const urlFlag = process.argv.indexOf('--url');
  let baseUrl = urlFlag >= 0 ? process.argv[urlFlag + 1] : undefined;
  let server: ChildProcess | undefined;

  if (!baseUrl) {
    baseUrl = `http://localhost:${PREVIEW_PORT}/Riftline/`;
    if (await isUp(baseUrl)) {
      throw new Error(`Port ${PREVIEW_PORT} is already serving; stop that server first.`);
    }
    // Run Vite's CLI directly (not through npx) so kill() stops the server itself.
    server = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'],
      { stdio: 'ignore' },
    );
    await waitForServer(baseUrl, 20_000);
  }

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    // Software WebGL so the test runs on machines without a GPU.
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const problems: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('requestfailed', (req) =>
      problems.push(`request failed: ${req.url()} (${req.failure()?.errorText ?? 'unknown'})`),
    );

    const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}debug`;
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForFunction('window.__RIFTLINE__ && window.__RIFTLINE__.ready', undefined, {
      timeout: 60_000,
    });
    // Only checks that the loop runs: software rendering here is far slower than any real GPU.
    const t0 = await page.evaluate<number>('window.__RIFTLINE__.tick()');
    await page.waitForFunction(`window.__RIFTLINE__.tick() >= ${t0 + 8}`, undefined, {
      timeout: 30_000,
    });
    await page.waitForTimeout(1500);
    const t1 = await page.evaluate<number>('window.__RIFTLINE__.tick()');
    const build = await page.evaluate<string>('window.__RIFTLINE__.build');
    const fatal = await page.evaluate<string | null>(
      "document.querySelector('.fatal-error')?.textContent ?? null",
    );
    if (fatal) problems.push(`fatal error panel: ${fatal}`);

    mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({ path: `${OUT_DIR}/smoke.png` });
    console.log(`url:    ${url}`);
    console.log(`build:  ${build}`);
    console.log(`ticks:  ${t1 - t0} advanced (software WebGL; not a performance measurement)`);
    console.log(`shot:   ${OUT_DIR}/smoke.png`);
  } finally {
    await browser.close();
    server?.kill();
  }

  if (problems.length > 0) {
    console.error(`\nSMOKE FAILED (${problems.length} problem(s)):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('\nSMOKE OK');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
