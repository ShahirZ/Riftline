import { box, buildBlockout, ramp, spawn, stairs } from '../../sim/map/blockout';
import type { BlockoutDef } from '../../sim/map/blockout';
import type { SolidDef } from '../../sim/map/MapDef';

/** Step test blocks along the north wall: walkable up to the 0.45 m step height. */
const STEP_HEIGHTS = [0.2, 0.3, 0.4, 0.45, 0.5, 0.6];
/** Jump test boxes: a standing jump clears ~1.05 m, a crouch-jump ~1.6 m. */
const JUMP_HEIGHTS = [0.9, 1.0, 1.1, 1.4, 1.5, 1.6, 1.7];
/** Ramp test slopes in degrees: walkable up to 45°. */
const RAMP_SLOPES = [15, 30, 40, 45, 50];
/** Gaps between 1 m tall platforms, m. A running jump covers about 4 m. */
const GAPS = [2, 3, 4, 5];

function testSolids(): SolidDef[] {
  const out: SolidDef[] = [];
  STEP_HEIGHTS.forEach((h, i) => out.push(box(-27 + i * 4, 0, -19, -24.5 + i * 4, h, -16)));
  JUMP_HEIGHTS.forEach((h, i) => out.push(box(i * 3.8, 0, -19, 2 + i * 3.8, h, -16, 'wood')));

  // Ramps 2 m tall against the south wall; steeper ones are shorter.
  RAMP_SLOPES.forEach((deg, i) => {
    const run = 2 / Math.tan((deg * Math.PI) / 180);
    out.push(ramp(-27 + i * 5, 19 - run, -24 + i * 5, 19, 0, 2, '+z'));
  });

  // Gap jumps: a gentle ramp up, then 1 m platforms with growing gaps.
  out.push(ramp(-24, -4, -20, 0, 0, 1, '+x'));
  let x = -20;
  for (let i = 0; i <= GAPS.length; i++) {
    out.push(box(x, 0, -4, x + 3, 1, 0, 'metal'));
    x += 3 + (GAPS[i] ?? 0);
  }

  // Crouch tunnels (1.4 m: crouch only) and a standing tunnel (1.9 m), 6 m long.
  out.push(box(0, 0, 13, 2, 3, 19), box(3.6, 0, 13, 5.6, 3, 19), box(2, 1.4, 13, 3.6, 3, 19));
  out.push(box(8, 0, 13, 10, 3, 19), box(11.6, 0, 13, 13.6, 3, 19), box(10, 1.9, 13, 11.6, 3, 19));

  // Stairs (0.25 m risers) up to a 2.5 m platform.
  out.push(...stairs(16, -8, 20, -3, 0, 2.5, 10, '-z'));
  out.push(box(16, 0, -12, 20, 2.5, -8));

  // A 0.8 m corridor, a wall built from short segments (seams), and a 10 cm thin wall.
  out.push(box(22, 0, -10, 24, 2, -3), box(24.8, 0, -10, 26.8, 2, -3));
  for (let s = 12; s < 28; s += 0.8) out.push(box(s, 0, 4, s + 0.8, 2, 4.5));
  out.push(box(-27, 0, 4, -26.9, 3, 10));
  return out;
}

const GYM_BLOCKOUT = {
  id: 'gym',
  name: 'Movement gym',
  min: [-30, -20],
  max: [30, 20],
  wallHeight: 6,
  ceiling: 10,
  wallMaterial: 'concrete',
  floorMaterial: 'concrete',
  areas: [{ name: 'Gym', min: [-29, -19], max: [29, 19] }],
  solids: testSolids(),
  spawns: { attacker: [spawn(0, 8, 0)], defender: [spawn(0, 10, 180)] },
} satisfies BlockoutDef;

/** A test course for movement feel: measured steps, slopes, jumps, crouch spaces and gaps. */
export const GYM_MAP = buildBlockout(GYM_BLOCKOUT);
