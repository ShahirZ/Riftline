import { beforeAll, describe, expect, it } from 'vitest';
import type { MapDef } from '../map/MapDef';
import { PhysicsWorld, initPhysics, physicsVersion } from './PhysicsWorld';

const MAP: MapDef = {
  id: 'test',
  name: 'Test',
  bounds: { min: [-10, -2, -10], max: [10, 10, 10] },
  solids: [
    { kind: 'box', min: [-10, -1, -10], max: [10, 0, 10], material: 'concrete' },
    { kind: 'box', min: [2, 0, 2], max: [4, 2, 4], material: 'wood' },
    { kind: 'ramp', min: [-4, 0, -2], max: [0, 1, 2], rise: '+x', material: 'grate' },
  ],
};

beforeAll(async () => {
  await initPhysics();
});

describe('PhysicsWorld', () => {
  it('loads the Rapier WASM module', () => {
    expect(physicsVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('builds colliders from map data that scene queries can see immediately', () => {
    const physics = new PhysicsWorld(MAP);
    expect(physics.groundHeight(0, 8, 5)).toBeCloseTo(0, 3); // open floor
    expect(physics.groundHeight(3, 3, 5)).toBeCloseTo(2, 3); // on top of the crate
    physics.dispose();
  });

  it('builds ramps as wedges rising toward their rise side', () => {
    const physics = new PhysicsWorld(MAP);
    const low = physics.groundHeight(-3.5, 0, 5);
    const mid = physics.groundHeight(-2, 0, 5);
    const high = physics.groundHeight(-0.5, 0, 5);
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
    expect(mid).toBeCloseTo(0.5, 2);
    physics.dispose();
  });

  it('returns Infinity when a ray misses', () => {
    const physics = new PhysicsWorld(MAP);
    expect(physics.castRay(0, 5, 0, 0, 1, 0, 100)).toBe(Infinity);
    expect(physics.groundHeight(50, 50, 5)).toBe(-Infinity);
    physics.dispose();
  });
});
