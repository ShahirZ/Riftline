# RIFTLINE: working guide

Original browser-based tactical FPS: round-based 4v4 attack/defend against bots. Vite + TypeScript
(strict) + three.js + Rapier (compat build) + WebAudio. No external art or audio assets:
everything is procedural or in code.

- **[docs/DESIGN.md](docs/DESIGN.md)**: the owner's full design spec and workflow rules, plus
  dated owner amendments. The source of truth for scope and process; read it before starting a
  milestone.
- **[docs/ROADMAP.md](docs/ROADMAP.md)**: milestone status, acceptance criteria, known stubs.
- **[docs/maps/](docs/maps)**: generated top-down layout images of every map (`npm run maps`).

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
   `npm run smoke` for anything that touches rendering, input or boot.
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

| Command                        | What it does                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `npm run dev`                  | Dev server at http://localhost:5173/Riftline/ (note the base path)                          |
| `npm run build`                | Typecheck (`tsc -b`) and production build into `dist/`                                      |
| `npm test`                     | Vitest unit tests (Node; Rapier WASM works there too)                                       |
| `npm run lint`                 | ESLint (type-aware) + Prettier check                                                        |
| `npm run format`               | Prettier write                                                                              |
| `npm run typecheck`            | `tsc -b` only                                                                               |
| `npm run smoke`                | Headless Chromium plays `dist/` (both maps) via `vite preview`; shots in `smoke-artifacts/` |
| `npm run smoke -- --url <url>` | Same check against a deployed URL                                                           |
| `npm run maps`                 | Regenerate the layout images in `docs/maps/` after a map change                             |

URL parameters: `?map=gym` opens the movement gym instead of Foundry; `?debug` opens the debug
overlay (also toggled with the `` ` `` key).

`npm run smoke` needs Playwright, which is deliberately not a project dependency. Claude Code cloud
sessions have it preinstalled globally; elsewhere `npm i -g playwright && npx playwright install chromium`.

## Architecture

```
src/
  main.ts            boot: map from ?map=, settings + tuning stores, Sim + local player, renderer, App
  app/               composition root and main loop (App, FixedStepper), fatal error UI
  sim/               deterministic game simulation (no three.js, no DOM; lint-enforced)
    core/            TICK_RATE/DT, seeded Rng + deriveSeed, math helpers
    input/           InputCommand: the per-tick controller -> sim contract
    map/             MapDef format, blockout builder (areas carved on a 1 m grid), validation
    movement/        PlayerMovement (rules), CharacterMotor (collision), MovementTuning types
    physics/         PhysicsWorld: Rapier wrapper (colliders from MapDef, ray queries)
    player/          Player state
    testing/         test-only helpers: tiny maps and a scripted input driver
    Sim.ts           top-level simulation; owns all game state
  data/              data-driven definitions, typed with `satisfies` (movement tuning, maps)
  client/            presentation: reads sim state, never writes it
    input/           InputSampler (keys/mouse -> InputCommand), PointerLock, key bindings
    render/          GameRenderer, FirstPersonCamera, dev grid shader, map mesh, layout SVG, sky
    menu/            start/pause menu, settings panel
    hud/             crosshair, speed graph
    settings/        player settings + localStorage persistence
    debug/           DebugOverlay, movement tuning panel/store/schema, movement telemetry
    ui/              tiny DOM helpers
scripts/             smoke test (headless browser), layout image regeneration
docs/maps/           generated top-down layout images (file snapshots of the map data)
```

Planned module homes (the owner's system list): Weapons, Health, Abilities, Economy,
RoundManager, Bots, Nav -> `sim/<name>`; Audio -> `client/audio`. Definitions for all of them go
in `src/data`.

### Simulation and time

- The sim advances in fixed ticks of `DT = 1/60 s`. `App` feeds real frame time into
  `FixedStepper`, which returns how many steps to run (max 8 per frame; stalls over 0.25 s are
  clamped and the excess dropped) and an interpolation factor `alpha`.
- The renderer draws state interpolated between the previous and current tick. Sim entities keep
  `prev*` copies of their transform for this. Per-tick presentation state (step smoothing,
  landing cues) is updated by `GameRenderer.afterTick` after every sim step.
- Mouse look is applied to the camera at display rate (`InputSampler.look` on every mouse event);
  the sim receives absolute yaw/pitch in each `InputCommand`, so aiming never waits for a tick.
  Key presses are latched, so a tap shorter than a tick still counts for one tick. Shots will latch
  the view angles at the moment of the click (M2).
- The game runs only while the pointer is locked. Esc (or focus loss) pauses: the sim stops
  stepping and the menu shows. Resuming never replays the time spent paused.
- Every controller (local player, bot, later a network peer) drives the sim only through
  `InputCommand`s (`Sim.setInput(playerId, cmd)` then `Sim.step()`). Bots perceive the world only
  through sim queries (line of sight, FOV, hearing).
- Output from the sim to presentation (shots, hits, footsteps, kills) will flow through a pooled
  event queue (M2). Until then the Player carries per-tick cues (`landedImpact`, `jumped`,
  `stepDelta`).

### Movement and collision

- `PlayerMovement` holds the rules: ground friction + acceleration (counter-strafing beats
  releasing), air control that steers and brakes but can never exceed the takeoff speed,
  landing slowdown (chained jumps are slower than running), jump buffer and ledge grace, crouch
  (head lowers on the ground, feet tuck in the air), headroom checks to stand up.
- `CharacterMotor` does collision on Rapier scene queries, not Rapier's
  `KinematicCharacterController` (see Gotchas): Quake-style collide-and-slide that clips against
  all contact planes and slides along creases, step-up (retry from step height, keep if further),
  ground snapping, ground probe, overlap tests, and a depenetration safety net (never fires in the
  fuzz tests).
- The body is a cylinder with 2 cm rounded rims (`RoundCylinder`), 0.64 m wide, 1.8 m tall (1.25 m
  crouched). Its flat base stands on ledge edges and lands on steps like a box hull.
- The body keeps a 1.5 cm skin from everything: casts report contact at 7.5 mm and moves stop a
  full skin short along the contact normal, so it never creeps into contact and never jitters.
- Tuning workflow: the owner tunes live in the pause menu (Movement tuning), copies the JSON,
  and the values go into `src/data/movement.ts`. Overrides persist in localStorage tagged with a
  fingerprint of the defaults, so changing the defaults drops stale overrides automatically.
- Tests: `PlayerMovement.test.ts` pins the feel numbers and edge cases; `data/maps/maps.test.ts`
  fuzzes random play on Foundry and the gym (never touching geometry, never stuck, no falls).

### Rules for `src/sim` and `src/data` (ESLint enforces the first three)

- No `three`, no imports from `client/` or `app/`.
- No DOM, timers, `performance`, `Date`, `fetch`.
- No `Math.random`. All randomness goes through `Rng`; independent streams via
  `new Rng(deriveSeed(seed, 'label'))` so adding a draw in one system never shifts another.
- Units: meters, seconds, radians. Y is up. Seen from above, +X is east (right) and +Z is south
  (down). Yaw 0 looks north (-Z); positive yaw turns left.

### Maps

- Maps are `MapDef` data: boxes and ramps, spawn points per team, named regions (callouts).
  Foundry and the gym are authored as blockouts (`sim/map/blockout.ts`): walkable areas carved out
  of solid mass on a 1 m grid, plus explicit solids for platforms, ramps, stairs, cover and roofs.
- Height language (from the movement numbers): up to 0.45 m walk up, about 1.05 m jump onto,
  about 1.6 m crouch-jump onto, taller blocks. Walls are 6 m so nobody sees over them, even
  jumping on the 3 m gantry.
- After any map change run `npm run maps`; the layout test fails until `docs/maps/` matches.

### Performance rules (budget: 60 FPS on a mid-range laptop)

- No allocations in per-tick or per-frame paths: preallocate scratch objects, pool effects and
  events, use plain `for` loops (no `map`/`filter`/`forEach`/closures in hot paths).
- Static map geometry is merged per surface class (2 draw calls); props will use instancing. The
  sun's shadow map covers the whole map and renders once per map (`shadowMap.autoUpdate = false`).
- Map surfaces use `MeshLambertMaterial`: flat-shaded art needs no specular, and it is the cheapest
  lit material. The dev grid is drawn in its shader (`onBeforeCompile`), not as geometry.
- Rapier query results allocate small wrapper objects internally. Acceptable, but keep the number
  of queries per tick bounded (movement uses about 4-8 per player per tick) and reuse `Ray`
  objects.
- Check with the debug overlay (`` ` `` key, or `?debug` in the URL): frame time, tick time, render
  CPU time, draw calls, heap, physics queries per tick.

### Rendering and art direction

- Stylized low-poly, flat-shaded, vertex colors, no textures. Cheap fake AO darkens wall bases.
- Team color language: Attackers are "Ember" (warm orange `#ff6b2c`), Defenders are "Tide" (cyan
  `#1fc8e8`). Environment stays neutral and lower contrast so players and team colors read first.
  Palette lives in `src/client/render/palette.ts`.
- Tone mapping: `NeutralToneMapping` (keeps team colors faithful). Shadows: `PCFShadowMap`.
- FOV setting is horizontal at 16:9 ("Hor+": wider screens see more). No head bob. Steps are
  smoothed in the view; landings dip the view by a few centimeters.

## Gotchas

- Rapier: scene queries (raycasts, shape casts) only see new or moved colliders after
  `world.step()`. Call `PhysicsWorld.syncQueries()` after changing colliders.
- Rapier's built-in `KinematicCharacterController` (0.21) projects onto one contact plane per
  iteration: running diagonally along a wall while touching the floor loses all movement for a
  tick every second or two, and with small offsets it sinks into the floor. Hence `CharacterMotor`.
- Rapier shape casts lose precision near the middle of very large boxes (a 100 m floor slab gave
  centimeter errors and outright misses). `PhysicsWorld` splits boxes into colliders of at most
  8 m (`MAX_COLLIDER_EXTENT`); ramps are not split, so `validateMap` rejects ramps over 8 m.
- Rapier shape casts report false contacts when a face slides parallel to another within about
  2 mm (seams in walls and floors), and flat faces are worse (plain cylinders up to about 1 cm).
  Never let a body rest closer than the motor's contact gap; capsules balance on ledge edges, so
  the body is a rounded cylinder.
- `intersectionWithShape` can report a hit at a 2 mm gap; fit tests use a body shrunk by 5 mm.
- Pointer lock: raw (unaccelerated) input exists only in Chromium; elsewhere, and in headless Linux
  Chromium, the request is rejected and `PointerLock` falls back to standard input. The first
  mousemove after locking is a bogus jump (dropped). Chromium fires the failed raw attempt's
  `pointerlockerror` late, after the fallback already locked, so only the latest attempt's promise
  counts. Re-locking needs a click and is refused for about a second after Esc.
- Rapier 0.21 compat inlines a 3 MB WASM as base64, so the `rapier` chunk is 4.3 MB (1.6 MB
  gzipped). Vendor chunks (`rapier`, `three`) are split so game-code deploys stay small for cached
  browsers.
- three r186 removed `PCFSoftShadowMap`; use `PCFShadowMap`.
- TypeScript is pinned to 6.0.x because typescript-eslint does not support TypeScript 7 yet.
- npm 10 (bundled with Node 22) crashes with `Cannot read properties of null (reading 'edgesOut')`
  when adding packages, due to Vitest 5's optional peer chain. Use `npx npm@11 install <pkg>`.
  `npm ci` from the lockfile works on npm 10 (CI uses it).
- The Vite `base` is `/Riftline/` in dev as well, so local URLs match GitHub Pages.
- Browsers cannot block Ctrl+W (closes the tab), so crouch defaults to C, not Ctrl. Bound keys
  with Ctrl/Cmd/Alt held are passed through so browser shortcuts keep working.
- The app tsconfig has no Node types: tests under `src/` cannot use `node:fs` or `process`. The
  layout images are Vitest file snapshots (`toMatchFileSnapshot`) for that reason.
- Headless Chromium uses software WebGL (about 4 FPS); `npm run smoke` checks correctness, never
  performance.
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

Runtime: `three` (rendering), `@dimforge/rapier3d-compat` (collision queries for the character
motor; compat build needs no bundler WASM plugin).
Dev: `vite`, `typescript`, `vitest`, `eslint`, `@eslint/js`, `typescript-eslint`, `prettier`,
`@types/three`, `@types/node` (Vite config and Node scripts). Versions are pinned exactly.

## Conventions

- TypeScript strict; `import type` for type-only imports; Prettier (single quotes, width 100).
- Class modules are PascalCase (`Sim.ts`), function modules camelCase (`mapMesh.ts`). Tests sit
  next to the code as `*.test.ts`.
- Data definitions use `as const satisfies Type` so balance edits are one-line and type-checked.
- Commit messages: imperative summary line, body explains why.

## Current status

- **M0 Foundation: complete, on `main`, tagged `m0`.**
- **M1 Movement & camera: complete, on `main`** (tag `m1` pending, created by the owner).
  Character motor and movement rules with tests and fuzzing, Foundry blockout and movement gym,
  pointer lock and input sampling, first-person camera, settings, live movement tuning with speed
  telemetry, layout images.
- **Next: M2 Weapons**, waiting for the owner's go-ahead and M1 playtest feedback.
