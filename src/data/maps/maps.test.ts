import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Rng } from '../../sim/core/rng';
import { Button, createInputCommand } from '../../sim/input/InputCommand';
import type { MapDef } from '../../sim/map/MapDef';
import { validateMap } from '../../sim/map/validateMap';
import { SKIN } from '../../sim/movement/CharacterMotor';
import { initPhysics } from '../../sim/physics/PhysicsWorld';
import type { Player } from '../../sim/player/Player';
import { Sim } from '../../sim/Sim';
import { FOUNDRY_MAP } from './foundry';
import { GYM_MAP } from './gym';

beforeAll(async () => {
  await initPhysics();
});

const MAPS: MapDef[] = [FOUNDRY_MAP, GYM_MAP];

describe.each(MAPS)('map $id', (map) => {
  it('is valid', () => {
    expect(validateMap(map)).toEqual([]);
  });

  it('has spawns where a standing player fits and is on the ground at once', () => {
    const sim = new Sim({ seed: 1, map });
    for (const team of ['attacker', 'defender'] as const) {
      map.spawns[team].forEach((spawn, i) => {
        const player = sim.addPlayer(team, i);
        expect(sim.movement.fitsAt(player.x, player.y, player.z, false), `${team} #${i}`).toBe(
          true,
        );
        sim.step();
        expect(player.onGround, `${team} #${i}`).toBe(true);
        expect(player.y, `${team} #${i}`).toBeCloseTo(spawn.position[1] + SKIN, 3);
      });
    }
    sim.dispose();
  });
});

/** True if the player could move at least 0.3 m in one of eight horizontal directions. */
function canMove(sim: Sim, p: Player): boolean {
  const motor = sim.movement.motor;
  const center = { x: p.x, y: p.y + sim.movement.centerOffset(p.crouched), z: p.z };
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    if (
      motor.cast(motor.shapeFor(p.crouched), center, Math.cos(a), 0, Math.sin(a), 0.3) === Infinity
    ) {
      return true;
    }
  }
  return false;
}

/** Overlap test with the full-size body: true if the player touches or penetrates anything. */
function touchesGeometry(sim: Sim, p: Player): boolean {
  const center = { x: p.x, y: p.y + sim.movement.centerOffset(p.crouched), z: p.z };
  return (
    sim.physics.world.intersectionWithShape(
      center,
      { x: 0, y: 0, z: 0, w: 1 },
      sim.movement.motor.shapeFor(p.crouched),
    ) !== null
  );
}

describe('movement fuzz', () => {
  const sims: Sim[] = [];
  afterAll(() => {
    for (const s of sims) s.dispose();
  });

  // Random play: run, jump, crouch and walk toward random spots and in random directions,
  // pressing into walls, corners, stairs, ramps and ledges along the way.
  const cases: [string, number, MapDef][] = [
    ['foundry', 1, FOUNDRY_MAP],
    ['foundry', 2, FOUNDRY_MAP],
    ['foundry', 3, FOUNDRY_MAP],
    ['foundry', 4, FOUNDRY_MAP],
    ['gym', 5, GYM_MAP],
    ['gym', 6, GYM_MAP],
  ];
  it.each(cases)(
    '%s seed %i: never inside geometry, out of the world, or stuck',
    (_, seed, map) => {
      const sim = new Sim({ seed, map });
      sims.push(sim);
      const rng = new Rng(seed * 7919);
      const player = sim.addPlayer(seed % 2 === 0 ? 'attacker' : 'defender', seed);
      const cmd = createInputCommand();
      // Seek toward random spots: region centers, or random points for single-region maps.
      const spots: [number, number][] = map.regions.map((r) => [
        (r.min[0] + r.max[0]) / 2,
        (r.min[1] + r.max[1]) / 2,
      ]);
      for (let i = 0; i < 12; i++) {
        const r = map.regions[i % map.regions.length];
        spots.push([rng.range(r.min[0], r.max[0]), rng.range(r.min[1], r.max[1])]);
      }
      const ticks = 60 * 45;
      const window = 60 * 6;
      const history: [number, number][] = [];
      let holdUntil = 0;
      let targetX = 0;
      let targetZ = 0;
      let seek = false;
      let stuck = 0;
      let touches = 0;

      for (let t = 0; t < ticks; t++) {
        if (t >= holdUntil) {
          holdUntil = t + rng.int(20, 90);
          seek = rng.chance(0.5);
          [targetX, targetZ] = spots[rng.int(0, spots.length)]!;
          cmd.forward = rng.int(-1, 2);
          cmd.strafe = rng.int(-1, 2);
          cmd.yaw = rng.range(-Math.PI, Math.PI);
          cmd.buttons =
            (rng.chance(0.15) ? Button.Crouch : 0) | (rng.chance(0.1) ? Button.Walk : 0);
        }
        if (seek) {
          cmd.yaw = Math.atan2(-(targetX - player.x), -(targetZ - player.z));
          cmd.forward = 1;
          cmd.strafe = 0;
        }
        // Tap jump now and then (a fresh press each time).
        cmd.buttons = rng.chance(0.03) ? cmd.buttons | Button.Jump : cmd.buttons & ~Button.Jump;
        cmd.tick = sim.tick;
        sim.setInput(player.id, cmd);
        sim.step();

        if (touchesGeometry(sim, player)) touches++;
        history.push([player.x, player.z]);
        if (history.length > window) history.shift();
        // Seeking straight at a target behind a wall pins the walker in corners, which is fine; a
        // player who barely moved for 6 s must still have somewhere to go.
        if (history.length === window && t % 30 === 0) {
          const [x0, z0] = history[0];
          let furthest = 0;
          for (const [x, z] of history) furthest = Math.max(furthest, Math.hypot(x - x0, z - z0));
          if (furthest < 1 && !canMove(sim, player)) stuck++;
        }
      }

      expect(touches).toBe(0);
      expect(sim.fallResets).toBe(0);
      expect(sim.movement.motor.depenetrations).toBe(0);
      expect(stuck).toBe(0);
      const [bx0, , bz0] = map.bounds.min;
      const [bx1, by1, bz1] = map.bounds.max;
      expect(player.x).toBeGreaterThan(bx0);
      expect(player.x).toBeLessThan(bx1);
      expect(player.z).toBeGreaterThan(bz0);
      expect(player.z).toBeLessThan(bz1);
      expect(player.y).toBeLessThan(by1);
    },
  );
});
