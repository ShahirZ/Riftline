# RIFTLINE roadmap

One milestone at a time. Each ends with build + lint + tests green, a pushed commit on `main`
tagged `mN`, updated docs, and a playtest checklist for the project owner. The next milestone
starts only on the owner's go-ahead. The owner's full spec is [DESIGN.md](DESIGN.md).

Status legend: ✅ done · 🟡 in progress · ⬜ not started

| Milestone               | Status | Summary                                                                                              |
| ----------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| M0 Foundation           | ✅     | Tooling, CI, Pages workflow, sim/render skeleton, debug overlay, placeholder scene                   |
| M1 Movement & camera    | ✅     | Pointer lock, character controller, Foundry blockout, FPS camera, settings basics                    |
| M2 Weapons              | ⬜     | All weapons, recoil/spread, reload/swap, viewmodels, hitboxes, damage, dummies, hit/kill feedback    |
| M3 Map                  | ⬜     | Final Foundry geometry, lighting, props, nav graph, minimap data                                     |
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

Released on `main` (milestone tag `m0`, created by the owner) and deployed to GitHub Pages by CI;
the deploy job reported success. The cloud sandbox cannot reach `*.github.io`, so the live page
itself is checked by the owner.

## M1 Movement & camera ✅

Done when movement feels crisp and has no tunneling, jitter, or stuck states.

Delivered:

- **Movement rules** (`sim/movement/PlayerMovement.ts`, numbers in `data/movement.ts`): run 6.0,
  walk 3.1, crouch 2.0 m/s. Ground friction + acceleration: 0 to 95% speed in about 133 ms;
  releasing reaches 1.5 m/s in about 150 ms (stop about 217 ms), counter-strafing in about 50 ms
  (stop about 67 ms). Air control steers and brakes but never exceeds the takeoff speed, and hard
  landings cut speed, so bunny-hopping and air-strafing gain nothing. Jump 1.05 m (crouch-jump
  about 1.6 m: crouching in the air tucks the feet), jump buffer 0.1 s, ledge grace 0.08 s. Crouch
  with headroom checks; eye height transitions over 0.12 s.
- **Character motor** (`sim/movement/CharacterMotor.ts`): own collide-and-slide on Rapier shape
  casts with crease handling, step-up to 0.45 m, slopes walkable to 45°, ground snapping, ground
  probe, overlap tests and a depenetration safety net. Upright rounded-cylinder body with a 1.5 cm
  skin that never creeps into contact (no wall jitter).
- **Input**: pointer lock with raw mouse input where supported and a fallback elsewhere; one
  `InputCommand` per tick with latched taps; mouse look at display rate; Esc pauses (the sim
  stops), click to resume. Crouch on C (Ctrl+W would close the tab).
- **Camera**: horizontal FOV at 16:9 (wider screens see more), interpolated position, crouch
  transition, step smoothing, subtle landing dip, no head bob.
- **Foundry blockout** (`data/maps/foundry.ts`): full original layout on a 1 m grid with two sites,
  mid, three lanes, chokes, long sightlines, cover at walk/jump/crouch-jump heights, a raised
  ledge, a balcony, a gantry with stairs and a roofed tunnel; spawn points and callout regions in
  the data. Attackers reach a site in about 11-14 s, defenders in about 8 s.
- **Movement gym** (`?map=gym`): measured steps, slopes, jump boxes, crouch tunnels, gap jumps,
  stairs, a seamed wall, a narrow corridor and a thin wall.
- **Dev grid**: 1 m and 5 m lines on every surface, drawn in the map shader (toggle in Settings).
- **Layout images** (`docs/maps/*.svg`, `npm run maps`): top-down views with heights, ramps,
  callouts and spawns; a test keeps them in sync with the map data. (Pulled forward from M3.)
- **Settings**: sensitivity (with cm/360 readout), invert Y, FOV, volume (no audio yet), dev grid,
  speed graph; saved in localStorage, validated on load, safe when storage is blocked.
- **Live movement tuning** (pause menu): every movement constant with sliders, reset, persistence
  across reloads and "Copy as JSON". The speed graph HUD measures stop times (release vs
  counter-strafe), time to full speed and jump height, air time and distance.
- **Tests**: 129 in total. Movement: speeds, counter-strafe vs release, jump height and air
  time, buffer and ledge grace, no double jump, landing slowdown, bunny-hop and air-strafe give no
  gain, crouch and headroom, crouch-jump, ledge edges, steps (0.45 m climbs, 0.55 m blocks),
  stairs up and down without leaving the ground, 30° ramps at full speed, 50° blocked, no
  tunneling through 5 cm walls/floors at any speed, wall slides without a single stalled tick on
  seamed walls and tiled floors, corners without jitter, determinism. Fuzz: random play on
  Foundry and the gym never touches geometry, falls out or gets stuck.
- **Smoke test** plays both maps in headless Chromium: click Play, walk, jump, pause.

Decisions and deviations:

- The spec names "Rapier kinematic character controller". Rapier's built-in
  `KinematicCharacterController` stalls for a tick when sliding along a wall while touching the
  floor (reproduced: one or two stalls per 10 s of wall-running) and sinks into floors with small
  offsets. The controller is instead our own kinematic motor built on Rapier's scene queries
  (shape casts), with the same features: step-up, slide, slopes, snapping.
- Capsule bodies balance on ledge edges and reject step-ups; plain cylinders and boxes trigger
  false contacts in Rapier's casts. The body is a cylinder with rounded rims (see CLAUDE.md
  Gotchas for the measurements).

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
  verticality. Original layout, starting from the M1 blockout and the owner's layout feedback.
- Lighting, props (instanced), surface materials (for footsteps and penetration).
- Hand-authored waypoint graph; minimap source data (callout regions exist since M1).
- Top-down layout images exist since M1 (`docs/maps/`); extend them with the nav graph.
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

| Where                                                         | What                                       | Replaced in |
| ------------------------------------------------------------- | ------------------------------------------ | ----------- |
| `client/settings/Settings.ts`, `client/menu/SettingsPanel.ts` | Volume is saved and shown; no sound exists | M7          |
