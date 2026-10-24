# RIFTLINE roadmap

One milestone at a time. Each ends with build + lint + tests green, a pushed commit on `main`
tagged `mN`, updated docs, and a playtest checklist for the project owner. The next milestone
starts only on the owner's go-ahead. The owner's full spec is [DESIGN.md](DESIGN.md).

Status legend: ✅ done · 🟡 in progress · ⬜ not started

| Milestone               | Status | Summary                                                                                              |
| ----------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| M0 Foundation           | ✅     | Tooling, CI, Pages workflow, sim/render skeleton, debug overlay, placeholder scene                   |
| M1 Movement & camera    | ⬜     | Pointer lock, character controller, Foundry blockout, FPS camera, settings basics                    |
| M2 Weapons              | ⬜     | All weapons, recoil/spread, reload/swap, viewmodels, hitboxes, damage, dummies, hit/kill feedback    |
| M3 Map                  | ⬜     | Final Foundry geometry, lighting, props, nav graph, minimap data, layout image generator             |
| M4 Bots                 | ⬜     | Full AI: nav, perception, aim model, roles, abilities hooks, callouts, 3 difficulties, debug viz     |
| M5 Round loop & economy | ⬜     | Round state machine, relay arm/disarm, buy menu, scoreboard, win/loss flow, restart                  |
| M6 Agents & abilities   | ⬜     | 3 agents, 6 abilities, bot ability use                                                               |
| M7 Polish               | ⬜     | Art pass, post-processing, audio pass, particles, menus, performance pass, settings, README controls |
| M8 Online multiplayer   | ⬜     | Later, separate project phase                                                                        |

## M0 Foundation ✅

Delivered:

- Vite 8 + TypeScript 6 (strict) + three r186 + Rapier 0.21 (compat build), Vitest, ESLint
  (type-aware) + Prettier. Scripts: `dev`, `build`, `test`, `lint`, `typecheck`, `format`, `smoke`.
- Architecture skeleton: fixed 60 Hz sim with render interpolation (`FixedStepper`), seeded RNG with
  independent streams, the `InputCommand` per-tick contract, data-driven map format (boxes + ramps)
  built into Rapier colliders and merged meshes from one definition.
- ESLint enforces the sim boundary: `src/sim` and `src/data` cannot import three.js or client code,
  or touch DOM, timers, wall-clock time or `Math.random`.
- Debug overlay (`` ` `` key or `?debug` in the URL): FPS, frame time, tick time, steps per frame,
  dropped steps, render CPU time, draw calls, triangles, heap, build hash, library versions.
- Placeholder scene: a small dusk-lit diorama built from map data; the sim spins the relay and flies
  a drone whose hover height comes from Rapier raycasts.
- CI on every push (lint, tests, typecheck, build); deploy to GitHub Pages on `main`.
- Headless smoke test (`npm run smoke`) of the production build under the `/Riftline/` base path.

Released as tag `m0` on `main`, deployed to GitHub Pages by CI. The cloud sandbox cannot reach
`*.github.io`, so the live page itself is checked by the owner.

## M1 Movement & camera ⬜

Done when movement feels crisp and has no tunneling, jitter, or stuck states.

- Pointer lock with raw (unaccelerated) mouse input where supported; Esc releases and pauses.
- Input sampler builds one `InputCommand` per tick; press edges are latched so taps shorter than a
  tick are never lost. Mouse look applies at display rate (no tick latency).
- Rapier kinematic character controller (capsule) with our own acceleration/friction model: walk,
  run, crouch, jump; fast accel/decel so counter-strafing works; limited air control; no
  bunny-hop gain (landing speed penalty, air speed cap). Step-up, slope limits, slide along walls.
- Own ground probe with a short grace period to stop grounded-state flicker on seams and edges.
- Foundry blockout: full layout in boxes/ramps with a dev grid so speed and distances are readable.
- FPS camera: FOV setting, crouch height transition, subtle landing dip. No head bob by default.
- Settings basics (sensitivity, FOV, volume placeholder, invert Y), persisted in localStorage with
  try/catch.
- Live tuning panel for movement constants with "copy as JSON" so feel feedback comes back as
  numbers.
- Tests: no tunneling at max speed into thin walls, step-up works, no stuck states at seams and
  corners, counter-strafe stop time, jump height, bunny-hop gives no speed gain.

## M2 Weapons ⬜

Done when shooting feels good at every range.

- Weapons defined in data: sidearm, SMG, rifle, marksman/sniper, knife. Original names and stats.
- Hitscan with damage falloff, headshot multiplier, armor, optional thin-cover penetration.
- Deterministic recoil pattern per weapon; spread from movement/airborne/crouch; first-shot accuracy;
  recovery. Shot direction latched at the instant of the click so flicks are not affected by tick
  timing.
- Ammo, reload, swap timing, viewmodel animations; hitboxes (head/body/legs); target dummies.
- Feedback: muzzle flash, tracers, impact decals, hit markers with distinct headshot feedback,
  damage direction indicator, kill feed.
- Pooled sim event queue (shots, hits, kills) consumed by render/audio/HUD.
- Tests: damage math, falloff, armor, recoil determinism, spread model.

## M3 Map ⬜

- Final Foundry geometry: two sites, mid, three lanes, chokepoints, long sightlines, cover,
  verticality. Original layout.
- Lighting, props (instanced), surface materials (for footsteps and penetration).
- Hand-authored waypoint graph; minimap source data; callout regions.
- Top-down layout generator (image committed to `docs/`) for layout discussions.
- Tests: every nav edge traversable by the character controller; map validation.

## M4 Bots ⬜

Done when bots play a believable round without getting stuck.

- A\* over the waypoint graph; stuck detection and recovery.
- Perception: FOV cone, line of sight, hearing (footsteps, gunshots); reaction time; aim error that
  shrinks with exposure time; cover use, peeking, strafing while shooting.
- Roles: attackers push sites and arm the relay; defenders hold angles and rotate on information.
- HUD text callouts. Three difficulty levels with clearly different aim, reaction and decision
  parameters. Debug view: bot states, paths, perception.
- Bots produce `InputCommand`s exactly like a player.

## M5 Round loop & economy ⬜

- First to 5 round wins. Buy phase 20 s, live round 100 s.
- Relay: carried by an attacker, 4 s to arm at a site, 35 s fuse, 7 s to disarm. Win by elimination,
  detonation, disarm, or time (defenders).
- Economy: round income, win/loss bonus with loss streak, kill rewards, carry-over; buy menu for
  weapons, armor and abilities. Scoreboard, round-end summary, restart.
- Tests: economy rules and the round state machine.

## M6 Agents & abilities ⬜

- 3 original agents, 2 abilities each (charges or credits, cooldowns or per-round limits). Starting
  ideas: short phase-dash, vision-blocking smoke-rift, scan pulse revealing enemies briefly.
- Abilities affect bots (smokes block bot vision, reveals feed bot knowledge). Bots use abilities.

## M7 Polish ⬜

- Art pass, post-processing (bloom, mild vignette, FXAA/SMAA option), particles.
- Audio pass: synthesized positional gunshots, footsteps by surface, reloads, ability sounds, UI,
  relay beep that accelerates.
- Menus, settings (graphics quality, key bindings), performance pass, README controls.
- Handle WebGL context loss gracefully.

## M8 Online multiplayer ⬜

Later and separate. The sim already runs from per-tick `InputCommand`s with no DOM or three.js
dependency, so a server can run it. Expected approach: server-authoritative with client prediction
and reconciliation (Rapier is deterministic per platform but not bit-identical across machines, so
lockstep is not planned).

## Known stubs and placeholders

| Where                                                    | What                                     | Replaced in |
| -------------------------------------------------------- | ---------------------------------------- | ----------- |
| `src/sim/showcase/`, `src/client/render/ShowcaseView.ts` | Placeholder diorama content and camera   | M1          |
| `src/data/maps/showcase.ts`                              | Placeholder map                          | M1          |
| `InputCommand`                                           | Defined and tested, not yet fed by input | M1          |
