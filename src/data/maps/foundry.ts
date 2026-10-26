import { box, buildBlockout, ramp, spawn, stairs } from '../../sim/map/blockout';
import type { BlockoutDef } from '../../sim/map/blockout';

/**
 * Foundry blockout (M1): the full layout in boxes and ramps, for movement and layout review.
 * Final geometry, props and lighting come in M3. A top-down image of this layout is generated
 * into docs/maps/foundry.svg by `npm run maps`.
 *
 * Layout: attackers (Ember) spawn in the south, defenders (Tide) in the north. Three lanes run
 * north: Long Belt to site A in the west, Ember Hall into the Crane Court in the middle (with links
 * to both sites), and the roofed Coolant Tunnel to site B in the east. Walking times at 6 m/s:
 * attackers reach a site in about 11-14 s, defenders in about 8 s; site to site is about 10 s.
 *
 * Heights are chosen around the movement numbers: walls 6 m (nobody sees over them, even jumping
 * on the gantry), cover 1.0 m (jump onto), 1.5 m (crouch-jump onto), 2.2 m and up (not climbable).
 */
const FOUNDRY_BLOCKOUT = {
  id: 'foundry',
  name: 'Foundry (blockout)',
  min: [-46, -48],
  max: [46, 46],
  wallHeight: 6,
  ceiling: 12,
  wallMaterial: 'concrete',
  floorMaterial: 'concrete',
  areas: [
    // Attackers (south).
    { name: 'Ember Yard', min: [-12, 32], max: [12, 42] },
    { name: 'West Gate', min: [-22, 34], max: [-12, 40] },
    { name: 'Slag Yard', min: [-40, 20], max: [-22, 40] },
    { name: 'Long Belt', min: [-40, -6], max: [-31, 20] },
    { name: 'A Gate', min: [-38, -12], max: [-32, -6] },
    { name: 'Ember Hall', min: [-8, 12], max: [-2, 32] },
    { name: 'East Gate', min: [12, 34], max: [22, 40] },
    { name: 'Pump Room', min: [22, 22], max: [40, 40] },
    { name: 'Coolant Tunnel', min: [33, 0], max: [40, 22] },
    { name: 'Valve Bend', min: [26, -6], max: [40, 0] },
    { name: 'B Door', min: [27, -12], max: [32, -6] },
    // Middle.
    { name: 'Crane Court', min: [-12, -12], max: [12, 12] },
    { name: 'Furnace Link', min: [-20, -10], max: [-12, -4] },
    { name: 'Furnace Link', min: [-20, -20], max: [-15, -10] },
    { name: 'Ladle Link', min: [12, -6], max: [20, 0] },
    { name: 'Ladle Link', min: [15, -20], max: [20, -6] },
    // Sites.
    { name: 'A Site', min: [-40, -32], max: [-20, -12] },
    { name: 'B Site', min: [20, -32], max: [42, -12] },
    // Defenders (north).
    { name: 'Tide Dock', min: [-10, -44], max: [10, -36] },
    { name: 'Dock West', min: [-30, -42], max: [-10, -36] },
    { name: 'Dock West', min: [-30, -36], max: [-24, -32] },
    { name: 'Dock East', min: [10, -42], max: [32, -36] },
    { name: 'Dock East', min: [26, -36], max: [32, -32] },
    { name: 'Upper Court', min: [2, -36], max: [8, -12] },
  ],
  solids: [
    // --- Ember Yard: supply crates split the long east-west line through the spawn.
    box(-3, 0, 36, 3, 2.5, 39, 'metal'),
    box(-11, 0, 41.4, 11, 0.02, 42, 'attacker'),

    // --- Slag Yard: slag heaps at three heights.
    box(-33, 0, 28, -30, 1.5, 31),
    box(-27, 0, 24, -25, 1, 26),
    box(-37, 0, 33, -35, 2.2, 35),
    box(-26, 0, 35, -24.8, 1.2, 36.2, 'wood'),

    // --- Long Belt: a broken conveyor down the middle (jump over it), crates by the gate.
    box(-36, 0, -2, -35, 1, 4, 'metal'),
    box(-36, 0, 8, -35, 1, 14, 'metal'),
    box(-39.4, 0, 16, -38.2, 1.2, 17.2, 'wood'),
    box(-33.4, 0, -5, -32, 1.5, -3.6, 'wood'),

    // --- A Site: the furnace (center), the raised kiln ledge (north-west) with a ramp, crates.
    box(-31, 0, -26, -26, 4, -21, 'metal'),
    box(-40, 0, -32, -30, 1.5, -28),
    ramp(-36, -28, -33, -23, 0, 1.5, '-z'),
    box(-36.4, 0, -17.4, -35, 1, -16, 'wood'),
    box(-24, 0, -17, -22.5, 1.5, -15.5, 'wood'),
    box(-24, 0, -30.4, -22.8, 1.2, -29.2, 'wood'),

    // --- Crane Court: crane base (blocks the spawn-to-spawn line), defender balcony, crates.
    box(-2, 0, -3, 3, 3.5, 2, 'metal'),
    box(-12, 0, -12, 1, 1.5, -9),
    ramp(-6, -9, -3, -4, 0, 1.5, '-z'),
    box(-9, 0, 4, -7.6, 1.2, 5.4, 'wood'),
    box(6, 0, -8, 7.4, 1, -6.6, 'wood'),
    box(7, 0, 6, 9, 1.5, 7.2, 'wood'),

    // --- Upper Court: a low barrier to vault.
    box(4, 0, -26, 6, 1, -25),

    // --- B Site: the ladle (center), the gantry along the east wall with stairs, low wall.
    box(29, 0, -25, 33, 2.2, -21, 'metal'),
    box(37, 0, -32, 42, 3, -18, 'metal'),
    ...stairs(37, -18, 42, -13, 0, 3, 10, '-z'),
    box(26, 0, -16, 30, 1, -15),
    box(22, 0, -26, 23.5, 1.5, -24.5, 'wood'),

    // --- Coolant Tunnel: roofed, with a pipe ledge along the east wall. Pump Room and Valve Bend
    // cover.
    box(33, 4, 2, 40, 4.6, 20),
    box(38.5, 0, 4, 40, 1, 18, 'metal'),
    box(28, 0, 28, 31, 2, 31, 'metal'),
    box(34, 0, 34, 37, 1.2, 37, 'metal'),
    box(35, 0, -5, 37, 1.2, -3, 'metal'),

    // --- Tide Dock: cargo splits the east-west line through the spawn; dock crates.
    box(-3, 0, -41, 3, 2.5, -38, 'metal'),
    box(-9, 0, -44, 9, 0.02, -43.4, 'defender'),
    box(-22, 0, -41, -20.8, 1.2, -39.8, 'wood'),
    box(20, 0, -38.2, 21.2, 1.2, -37, 'wood'),
  ],
  // Spawns face their team's exits: attackers look up Ember Hall (mid) with the side gates to
  // either side; defenders look toward Upper Court and the dock corridors.
  spawns: {
    attacker: [spawn(-5, 39.5, 0), spawn(-9.5, 37, 25), spawn(9.5, 37, -25), spawn(5, 40.5, 0)],
    defender: [
      spawn(5, -40.5, 180),
      spawn(-6.5, -39.5, 125),
      spawn(7.5, -42.5, 200),
      spawn(-7.5, -42.5, 150),
    ],
  },
} as const satisfies BlockoutDef;

export const FOUNDRY_MAP = buildBlockout(FOUNDRY_BLOCKOUT);
