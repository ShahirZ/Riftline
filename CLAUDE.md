# RIFTLINE: working guide

Original browser-based tactical FPS: round-based 4v4 attack/defend against bots. Vite + TypeScript
(strict) + three.js + Rapier (compat build) + WebAudio. No external art or audio assets: everything
is procedural or in code.

- **[docs/DESIGN.md](docs/DESIGN.md)**: the owner's full design spec and workflow rules, plus
  dated owner amendments. The source of truth for scope and process; read it before starting a
  milestone.
- **[docs/ROADMAP.md](docs/ROADMAP.md)**: milestone status, acceptance criteria, known stubs.

## Ground rules (from the project owner)

- Priority one is game quality and feel; priority two is efficient use of the owner's time. Never
  trade quality for speed.
- Everything is original: names, agents, map, weapons, art. Tactical shooters are a reference for
  feel and structure only. Never copy characters, maps, logos or layouts.
- Never fake a feature. Anything stubbed is marked in code (`STUB(Mx):` comment) and listed under
  "Known stubs" in the roadmap.
- If a requirement is ambiguous or impossible, say so and propose the best alternative instead of
  silently simplifying.
- Keep dependencies minimal and justify every addition (see Dependencies below).

## Milestone workflow

1. Build one milestone at a time, in roadmap order.
2. When it is done: `npm run lint`, `npm test`, `npm run build` all green (fix everything), then
   `npm run smoke` for anything that touches rendering or boot.
3. Update this file's "Current status" and the roadmap, commit with a clear message, and push the
   working branch.
4. Fast-forward `main` to the milestone commit and push it (standing owner permission, see
   DESIGN.md amendments). Wait for the Pages deploy job to finish and report its result. The
   milestone tag `mN` is created by the owner (tag pushes from the cloud session are refused, see
   Gotchas), so the report includes the exact tag command with the commit hash.
5. Stop and report: (a) what changed, (b) the live URL or run command, (c) a short playtest
   checklist of specific things to try. Do not start the next milestone until the owner says so.
6. Claude cannot playtest feel. Logic gets headless tests (economy, round state, nav, damage,
   recoil determinism, movement edge cases); say plainly what only a human can judge.

## Commands

| Command                        | What it does                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `npm run dev`                  | Dev server at http://localhost:5173/Riftline/ (note the base path)                      |
| `npm run build`                | Typecheck (`tsc -b`) and production build into `dist/`                                  |
| `npm test`                     | Vitest unit tests (Node; Rapier WASM works there too)                                   |
| `npm run lint`                 | ESLint (type-aware) + Prettier check                                                    |
| `npm run format`               | Prettier write                                                                          |
| `npm run typecheck`            | `tsc -b` only                                                                           |
| `npm run smoke`                | Headless Chromium check of `dist/` via `vite preview`; screenshot in `smoke-artifacts/` |
| `npm run smoke -- --url <url>` | Same check against a deployed URL                                                       |

`npm run smoke` needs Playwright, which is deliberately not a project dependency. Claude Code cloud
sessions have it preinstalled globally; elsewhere `npm i -g playwright && npx playwright install chromium`.

## Architecture

```
src/
  main.ts            boot: init physics, build Sim + renderer + App, error screen on failure
  app/               composition root and main loop (App, FixedStepper), fatal error UI
  sim/               deterministic game simulation (no three.js, no DOM; lint-enforced)
    core/            TICK_RATE/DT, seeded Rng + deriveSeed, math helpers
    input/           InputCommand: the per-tick controller -> sim contract
    map/             MapDef format, validation, geometry shared by physics and render
    physics/         PhysicsWorld: Rapier wrapper (colliders from MapDef, ray queries)
    showcase/        M0 placeholder content (remove in M1)
    Sim.ts           top-level simulation; owns all game state
  data/              data-driven definitions, typed with `satisfies` (maps now; weapons, agents,
                     abilities, economy, bot difficulty later)
  client/            presentation: reads sim state, never writes it
    render/          GameRenderer (three.js), map mesh builder, palette, sky, views
    debug/           DebugOverlay, RollingStat
scripts/smoke.ts     headless browser smoke test
```

Planned module homes (the owner's system list): Input -> `client/input` (sampling) + `sim/input`
(contract); Movement, Weapons, Health, Abilities, Economy, RoundManager, Bots, Nav, Map -> `sim/<name>`;
Renderer -> `client/render`; Audio -> `client/audio`; HUD -> `client/hud`; Menu -> `client/menu`;
Settings -> `client/settings`. Definitions for all of them go in `src/data`.

### Simulation and time

- The sim advances in fixed ticks of `DT = 1/60 s`. `App` feeds real frame time into
  `FixedStepper`, which returns how many steps to run (max 8 per frame; stalls over 0.25 s are
  clamped and the excess dropped) and an interpolation factor `alpha`.
- The renderer draws state interpolated between the previous and current tick. Sim entities keep
  `prev*` copies of their transform for this.
- From M1: mouse look is applied to the camera at display rate, and the sim receives absolute
  yaw/pitch in each `InputCommand`, so aiming never waits for a tick. Shots latch the view angles
  at the moment of the click (M2).
- Every controller (local player, bot, later a network peer) drives the sim only through
  `InputCommand`s. Bots perceive the world only through sim queries (line of sight, FOV, hearing).
- Output from the sim to presentation (shots, hits, footsteps, kills) will flow through a pooled
  event queue (M2).

### Rules for `src/sim` and `src/data` (ESLint enforces the first three)

- No `three`, no imports from `client/` or `app/`.
- No DOM, timers, `performance`, `Date`, `fetch`.
- No `Math.random`. All randomness goes through `Rng`; independent streams via
  `new Rng(deriveSeed(seed, 'label'))` so adding a draw in one system never shifts another.
- Units: meters, seconds, radians. Y is up. Seen from above, +X is east (right) and +Z is south
  (down).

### Performance rules (budget: 60 FPS on a mid-range laptop)

- No allocations in per-tick or per-frame paths: preallocate scratch objects, pool effects and
  events, use plain `for` loops (no `map`/`filter`/`forEach`/closures in hot paths).
- Static map geometry is merged per surface class (2 draw calls today); props will use instancing.
- Map surfaces use `MeshLambertMaterial`: flat-shaded art needs no specular, and it is the cheapest
  lit material.
- Rapier query results allocate small wrapper objects internally. Acceptable, but keep the number
  of queries per tick bounded and reuse `Ray` objects.
- Check with the debug overlay (`` ` `` key, or `?debug` in the URL): frame time, tick time, render
  CPU time, draw calls, heap.

### Rendering and art direction

- Stylized low-poly, flat-shaded, vertex colors, no textures. Cheap fake AO darkens wall bases.
- Team color language: Attackers are "Ember" (warm orange `#ff6b2c`), Defenders are "Tide" (cyan
  `#1fc8e8`). Environment stays neutral and lower contrast so players and team colors read first.
  Palette lives in `src/client/render/palette.ts`.
- Tone mapping: `NeutralToneMapping` (keeps team colors faithful). Shadows: `PCFShadowMap`.

## Gotchas

- Rapier: scene queries (raycasts, shape casts, the character controller) only see new or moved
  colliders after `world.step()`. Call `PhysicsWorld.syncQueries()` after changing colliders.
- Rapier 0.21 compat inlines a 3 MB WASM as base64, so the `rapier` chunk is 4.3 MB (1.6 MB
  gzipped). Vendor chunks (`rapier`, `three`) are split so game-code deploys stay small for cached
  browsers.
- three r186 removed `PCFSoftShadowMap`; use `PCFShadowMap`.
- TypeScript is pinned to 6.0.x because typescript-eslint does not support TypeScript 7 yet.
- npm 10 (bundled with Node 22) crashes with `Cannot read properties of null (reading 'edgesOut')`
  when adding packages, due to Vitest 5's optional peer chain. Use `npx npm@11 install <pkg>`.
  `npm ci` from the lockfile works on npm 10 (CI uses it).
- The Vite `base` is `/Riftline/` in dev as well, so local URLs match GitHub Pages.
- Browsers cannot block Ctrl+W (closes the tab), so crouch must default to C, not Ctrl.
- Headless Chromium uses software WebGL; `npm run smoke` checks correctness, never performance.
- The cloud session's git proxy refuses tag pushes (HTTP 403); branch pushes, including `main`,
  work. It is a policy denial: do not retry or work around it. Give the owner the tag command.

## Deployment

- `.github/workflows/ci.yml`: every branch push runs lint, tests, typecheck and build, and
  uploads the built site as an artifact. Pushes to `main` also deploy to GitHub Pages. Tag pushes
  do not trigger CI. `workflow_dispatch` allows re-running a deploy without an empty commit.
- Claude has standing permission to push finished milestones to `main` (fast-forward from the
  working branch). The owner tags each milestone commit `mN`.
- One-time setup by the repo owner: Settings -> Pages -> Build and deployment -> Source:
  **GitHub Actions**.
- Live URL: https://shahirz.github.io/Riftline/
- The Claude cloud sandbox cannot reach `*.github.io` by default (network policy), so the live
  site is verified by the owner, or by Claude after `shahirz.github.io` is added to the
  environment's allowed domains.

## Dependencies

Runtime: `three` (rendering), `@dimforge/rapier3d-compat` (character controller and collision;
compat build needs no bundler WASM plugin).
Dev: `vite`, `typescript`, `vitest`, `eslint`, `@eslint/js`, `typescript-eslint`, `prettier`,
`@types/three`, `@types/node` (Vite config and Node scripts). Versions are pinned exactly.

## Conventions

- TypeScript strict; `import type` for type-only imports; Prettier (single quotes, width 100).
- Class modules are PascalCase (`Sim.ts`), function modules camelCase (`mapMesh.ts`). Tests sit
  next to the code as `*.test.ts`.
- Data definitions use `as const satisfies Type` so balance edits are one-line and type-checked.
- Commit messages: imperative summary line, body explains why.

## Current status

- **M0 Foundation: complete, on `main`, deployed to GitHub Pages.** Scaffold, tooling, CI + Pages
  workflow, sim/render skeleton, debug overlay, placeholder scene, smoke test, design spec in
  docs/DESIGN.md.
- **Next: M1 Movement & camera**, waiting for the owner's go-ahead.
