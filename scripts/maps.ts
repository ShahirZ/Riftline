/**
 * Regenerates the committed top-down map layout images (docs/maps/*.svg) from the map data.
 *
 *   npm run maps
 *
 * The images are file snapshots of the layout test, so the generator and the check that keeps
 * the committed images current are the same code; this runs that test in update mode.
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', 'src/client/render/layoutSvg.test.ts', '--update'],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
