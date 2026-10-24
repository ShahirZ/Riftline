import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

/** Short commit hash shown in the debug overlay, so a deployed build can be matched to a commit. */
function buildSha(): string {
  const fromCi = process.env['GITHUB_SHA'];
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  // GitHub Pages serves the site at https://<owner>.github.io/Riftline/. The dev server uses the
  // same base so asset-path bugs show up locally rather than after deploy.
  base: '/Riftline/',
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha()),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // The rapier chunk is ~4.3 MB (1.6 MB gzipped) because the compat build inlines its 3 MB
    // WASM as base64. Expected; the limit sits just above it so any other bloat still warns.
    chunkSizeWarningLimit: 4500,
    rolldownOptions: {
      output: {
        // Vendor chunks change rarely, so browsers keep them cached across game deploys.
        codeSplitting: {
          groups: [
            { name: 'rapier', test: /node_modules[\\/]@dimforge[\\/]/ },
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
