/**
 * Headless smoke test for a built RIFTLINE. For each map it loads the page in Chromium, clicks
 * Play (pointer lock), walks forward, jumps, releases the mouse and checks that the game paused.
 * Fails on any console error, page error, failed request or fatal error panel, and saves
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
  click(selector: string): Promise<void>;
  keyboard: { down(key: string): Promise<void>; up(key: string): Promise<void> };
  screenshot(options: { path: string }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  close(): Promise<void>;
}
interface Browser {
  newPage(options?: { viewport?: { width: number; height: number } }): Promise<Page>;
  close(): Promise<void>;
}
interface Playwright {
  chromium: { launch(options?: { args?: string[] }): Promise<Browser> };
}
interface PlayerState {
  x: number;
  y: number;
  z: number;
  onGround: boolean;
}

const PREVIEW_PORT = 4173;
const OUT_DIR = 'smoke-artifacts';
const MAPS = ['foundry', 'gym'];

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

/** Loads one map, plays it briefly and returns a summary line. Problems go into `problems`. */
async function playMap(browser: Browser, baseUrl: string, map: string, problems: string[]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const tag = `[${map}]`;
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`${tag} console: ${msg.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`${tag} page error: ${error.message}`));
  page.on('requestfailed', (req) =>
    problems.push(`${tag} request failed: ${req.url()} (${req.failure()?.errorText ?? 'unknown'})`),
  );

  const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}debug&map=${map}`;
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction('window.__RIFTLINE__ && window.__RIFTLINE__.ready', undefined, {
    timeout: 60_000,
  });
  await page.screenshot({ path: `${OUT_DIR}/${map}-menu.png` });

  // Play: the click captures the mouse (the fallback without raw input works headless).
  await page.click('button.play');
  await page.waitForFunction('window.__RIFTLINE__.playing()', undefined, { timeout: 10_000 });
  const t0 = await page.evaluate<number>('window.__RIFTLINE__.tick()');
  const start = await page.evaluate<PlayerState>('window.__RIFTLINE__.player()');

  // Walk forward. Software rendering is slow, so only the direction and some progress count.
  await page.keyboard.down('KeyW');
  await page.waitForFunction(
    `Math.hypot(window.__RIFTLINE__.player().x - ${start.x}, window.__RIFTLINE__.player().z - ${start.z}) > 1.5`,
    undefined,
    { timeout: 20_000 },
  );
  await page.keyboard.up('KeyW');
  const walked = await page.evaluate<PlayerState>('window.__RIFTLINE__.player()');

  // Jump: the player must leave the ground and come back down.
  await page.keyboard.down('Space');
  await page.waitForFunction(`window.__RIFTLINE__.player().y > ${walked.y + 0.2}`, undefined, {
    timeout: 10_000,
  });
  await page.keyboard.up('Space');
  await page.waitForFunction('window.__RIFTLINE__.player().onGround', undefined, {
    timeout: 10_000,
  });
  await page.screenshot({ path: `${OUT_DIR}/${map}.png` });

  // Releasing the mouse pauses the game and shows the menu again.
  await page.evaluate('document.exitPointerLock()');
  await page.waitForFunction('!window.__RIFTLINE__.playing()', undefined, { timeout: 5_000 });
  const paused = await page.evaluate<number>('window.__RIFTLINE__.tick()');
  await page.waitForTimeout(500);
  if ((await page.evaluate<number>('window.__RIFTLINE__.tick()')) !== paused) {
    problems.push(`${tag} the sim kept running while paused`);
  }
  if (!(await page.evaluate<boolean>("!document.querySelector('.menu')?.hidden"))) {
    problems.push(`${tag} the pause menu did not appear`);
  }
  const fatal = await page.evaluate<string | null>(
    "document.querySelector('.fatal-error')?.textContent ?? null",
  );
  if (fatal) problems.push(`${tag} fatal error panel: ${fatal}`);

  const moved = Math.hypot(walked.x - start.x, walked.z - start.z);
  await page.close();
  return `${map.padEnd(8)} ${paused - t0} ticks played · walked ${moved.toFixed(1)} m · jumped · paused OK`;
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
  const results: string[] = [];
  mkdirSync(OUT_DIR, { recursive: true });
  try {
    for (const map of MAPS) results.push(await playMap(browser, baseUrl, map, problems));
  } catch (error) {
    problems.push(`smoke run aborted: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await browser.close();
    server?.kill();
  }

  console.log(`url:    ${baseUrl}`);
  for (const line of results) console.log(`map:    ${line}`);
  console.log(`shots:  ${OUT_DIR}/ (software WebGL; not a performance measurement)`);
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
