# RIFTLINE design spec and workflow rules

This is the project owner's original brief, preserved verbatim in substance (only headings and
list formatting added). It is the source of truth for scope and process. Interpretations,
technical decisions and progress live in [ROADMAP.md](ROADMAP.md) and [../CLAUDE.md](../CLAUDE.md);
where they disagree with this document, this document wins unless the owner has amended it below.

## Vision and priorities

You are building "RIFTLINE", an original browser-based tactical FPS (round-based 4v4
attack/defend vs. bots), in this repository. Priority one is game quality and game feel. Priority
two is efficient use of my time. Never trade quality for speed. The reference for feel and
structure is tactical shooters like Valorant and Fortnite, but everything (names, agents, map,
weapons, art) must be fully original. Do not copy any existing game's characters, maps, logos, or
layouts.

## Tech stack

- Vite + TypeScript (strict), three.js, @dimforge/rapier3d-compat for the character controller
  and collision, WebAudio for fully synthesized sound. No external art or audio assets.
  Everything is procedural or in code.
- Vitest for unit tests of game logic. ESLint + Prettier. `npm run dev`, `build`, `test`, `lint`.
- Deploy to GitHub Pages via a GitHub Actions workflow. Set Vite `base` to the repo name. Include
  the workflow file and a README with live-URL instructions.

## Architecture rules

- Game simulation logic is separate from rendering. Sim runs at a fixed timestep (60 Hz) with a
  clean input-command struct per tick, so multiplayer can be added later. three.js code never
  holds game state.
- Systems as modules: Input, Movement, Weapons, Health, Abilities, Economy, RoundManager, Bots,
  Nav, Map, Renderer, Audio, HUD, Menu, Settings.
- Data-driven definitions for weapons, abilities, agents, and the map layout (JSON/TS config), so
  balance changes are one-line edits.
- Seeded RNG for recoil patterns and bot behavior. Include a debug overlay (FPS, tick time, bot
  states, nav graph, hitboxes) toggled by a key.
- Performance budget: 60 FPS on a mid-range laptop. Use instancing, merged static geometry, and no
  per-frame allocations in hot paths.

## Game design

### Round flow

First to 5 round wins. Buy phase 20 s, live round 100 s. Attackers must carry and arm a "relay"
at one of two sites (4 s to arm, 35 s fuse); defenders can disarm (7 s). Win by elimination, by
relay detonation, by disarm, or by time (defenders win).

### Economy

Credits per round, win/loss bonus with a loss-streak bonus, kill rewards, carry-over,
weapon/armor/ability purchases in a buy menu.

### Weapons

Original names/stats, all in data: sidearm, SMG, rifle, marksman/sniper, knife. Hitscan with
damage falloff, headshot multiplier, armor, penetration of thin cover optional. Deterministic
recoil pattern per weapon, movement inaccuracy (accurate when standing/counter-strafed,
inaccurate when moving/airborne), first-shot accuracy, reload, swap timing, viewmodel animations.

### Movement

Tight and responsive. Walk/run/crouch/jump, fast acceleration and deceleration so
counter-strafing works, slight air control, no bunny-hop abuse. Rapier kinematic character
controller with step-up and slide.

### Agents and abilities

3 original agents, 2 abilities each (charges or credits, cooldowns/limited per round). Examples to
start from, but redesign freely: a short phase-dash, a vision-blocking smoke-rift, a scan pulse
revealing enemies briefly. Abilities affect bots as well.

### Map "Foundry"

One compact, readable map with two sites, mid area, three lanes, chokepoints, long sightlines,
cover, verticality. Defined as data (boxes/ramps/props) with a hand-authored waypoint graph for
navigation. Include a top-down layout PNG-generator or debug view so we can discuss the layout.

### Bots

Waypoint A\* navigation, line-of-sight perception with a field of view and hearing (footsteps,
gunshots), reaction time, aim error that shrinks with exposure time, cover use, peeking, strafing
while shooting, role behavior (attackers push sites and plant, defenders hold angles and rotate on
information), use of abilities, simple text callouts in the HUD feed. Three difficulty levels
with clearly different aim/reaction/decision parameters.

### Presentation

Stylized low-poly flat-shaded art with strong team color language, readable silhouettes, tasteful
post-processing (bloom, mild vignette, optional FXAA/SMAA), muzzle flash, tracers, impact decals,
hit markers with distinct headshot feedback, damage direction indicators, kill feed, death cam,
round-end summary. Positional audio: synthesized gunshots, footsteps by surface, reloads, ability
sounds, UI sounds, relay beep that accelerates.

### HUD and UI

Crosshair (customizable), health/armor, ammo, credits, ability icons with cooldowns, round timer,
score, minimap, scoreboard, buy menu, pause menu. Settings: mouse sensitivity, FOV, volume,
graphics quality, key bindings. Persist settings in localStorage wrapped in try/catch.

## Milestones

Build ONE at a time, in this order.

- **M0 Foundation:** scaffold, tooling, CI, GitHub Pages deploy, CLAUDE.md (architecture,
  conventions, how to run/test, current status), docs/ROADMAP.md, placeholder scene deployed and
  verified.
- **M1 Movement & camera:** pointer lock, controller, collision against a blockout version of
  Foundry, FPS camera, settings basics. Done when movement feels crisp and has no tunneling,
  jitter, or stuck states.
- **M2 Weapons:** all weapons, recoil/spread, ammo/reload, viewmodels, hit detection, hitboxes,
  damage, target dummies for testing, hit/kill feedback. Done when shooting feels good at every
  range.
- **M3 Map:** full Foundry layout with final geometry, lighting, props, nav graph, minimap source
  data.
- **M4 Bots:** full AI as specified, difficulty levels, debug visualization. Done when bots play a
  believable round without getting stuck.
- **M5 Round loop & economy:** the full state machine, relay mechanics, buy menu, scoreboard,
  win/loss flow, restart. Unit tests for the economy and round state machine.
- **M6 Agents & abilities:** 3 agents, 6 abilities, bot ability use.
- **M7 Polish:** art pass, post-processing, audio pass, particles, menus, performance pass,
  settings, README with controls.
- **M8 (later, separate):** Online multiplayer.

## Workflow rules

- Before writing code, give me a short plan: architecture summary, risks, and your interpretation
  of M0.
- After each milestone: run build + lint + tests, fix everything, commit with a clear message,
  push, update CLAUDE.md and docs/ROADMAP.md, then STOP and give me (a) what changed, (b) the
  live/preview URL or run command, and (c) a short playtest checklist of specific things for me
  to try and report on. Do not start the next milestone until I say so.
- You cannot playtest feel yourself, so write headless tests for logic (economy, round state, nav
  pathfinding, damage math, recoil determinism) and tell me honestly what only I can judge.
- If a requirement is ambiguous or impossible, say so and propose the best alternative instead of
  silently simplifying. Never fake a feature. If something is stubbed, mark it clearly and list
  it.
- Keep dependencies minimal and justify any addition.

## Owner amendments

Later decisions by the owner, newest last. These extend or override the brief above.

- **2026-10-24:** Push to `main` now and at each milestone. Save the complete game design spec
  and workflow rules into docs/DESIGN.md and reference it from CLAUDE.md. Tag the M0 result `m0`.
