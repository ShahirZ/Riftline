import { beforeAll, describe, expect, it } from 'vitest';
import { SHOWCASE_MAP } from '../data/maps/showcase';
import { TICK_RATE } from './core/constants';
import type { MapDef } from './map/MapDef';
import { initPhysics } from './physics/PhysicsWorld';
import { Sim } from './Sim';

beforeAll(async () => {
  await initPhysics();
});

function run(seed: number, ticks: number): Sim {
  const sim = new Sim({ seed, map: SHOWCASE_MAP });
  for (let i = 0; i < ticks; i++) sim.step();
  return sim;
}

describe('Sim', () => {
  it('advances one tick per step', () => {
    const sim = run(1, TICK_RATE);
    expect(sim.tick).toBe(TICK_RATE);
    sim.dispose();
  });

  it('is deterministic for a given seed', () => {
    const a = run(77, 300);
    const b = run(77, 300);
    expect([a.showcase.droneX, a.showcase.droneY, a.showcase.droneZ]).toEqual([
      b.showcase.droneX,
      b.showcase.droneY,
      b.showcase.droneZ,
    ]);
    expect(a.showcase.relayAngle).toBe(b.showcase.relayAngle);
    a.dispose();
    b.dispose();
  });

  it('keeps previous-tick state for render interpolation', () => {
    const sim = run(3, 10);
    const { showcase } = sim;
    expect(showcase.relayAngle).toBeGreaterThan(showcase.prevRelayAngle);
    sim.step();
    expect(showcase.prevRelayAngle).toBeLessThan(showcase.relayAngle);
    sim.dispose();
  });

  it('settles the drone at hover height above the geometry below it', () => {
    const sim = run(5, TICK_RATE * 20);
    const { showcase } = sim;
    const ground = sim.physics.groundHeight(showcase.droneX, showcase.droneZ, 12);
    // The spring lags slightly behind height changes, so allow some slack.
    expect(showcase.droneY - ground).toBeGreaterThan(0.6);
    expect(showcase.droneY - ground).toBeLessThan(2.4);
    sim.dispose();
  });

  it('rejects an invalid map', () => {
    const broken: MapDef = {
      id: 'broken',
      name: 'Broken',
      bounds: { min: [0, 0, 0], max: [1, 1, 1] },
      solids: [{ kind: 'box', min: [0, 0, 0], max: [5, 1, 1], material: 'concrete' }],
    };
    expect(() => new Sim({ seed: 1, map: broken })).toThrow(/invalid/);
  });
});
