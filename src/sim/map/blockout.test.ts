import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { box, buildBlockout, mergeCells, spawn, stairs } from './blockout';
import type { BlockoutDef } from './blockout';
import { validateMap } from './validateMap';

describe('mergeCells', () => {
  it('covers exactly the set cells, each once', () => {
    const rng = new Rng(5);
    for (let trial = 0; trial < 60; trial++) {
      const w = rng.int(1, 24);
      const d = rng.int(1, 24);
      const cells = new Uint8Array(w * d);
      // Blobby random fill: rectangles of set cells on a mostly empty grid.
      for (let i = 0; i < 6; i++) {
        const x0 = rng.int(0, w);
        const z0 = rng.int(0, d);
        const x1 = Math.min(w, x0 + rng.int(1, 8));
        const z1 = Math.min(d, z0 + rng.int(1, 8));
        for (let z = z0; z < z1; z++) cells.fill(1, z * w + x0, z * w + x1);
      }
      const cover = new Uint8Array(w * d);
      for (const r of mergeCells(cells, w, d)) {
        for (let z = r.z; z < r.z + r.d; z++) {
          for (let x = r.x; x < r.x + r.w; x++) {
            expect(cells[z * w + x]).toBe(1);
            expect(cover[z * w + x]).toBe(0);
            cover[z * w + x] = 1;
          }
        }
      }
      expect(cover).toEqual(cells);
    }
  });

  it('turns a full grid into a single rectangle', () => {
    expect(mergeCells(new Uint8Array(12).fill(1), 4, 3)).toEqual([{ x: 0, z: 0, w: 4, d: 3 }]);
  });
});

describe('buildBlockout', () => {
  const def: BlockoutDef = {
    id: 'mini',
    name: 'Mini',
    min: [-5, -5],
    max: [5, 5],
    wallHeight: 4,
    ceiling: 8,
    wallMaterial: 'concrete',
    floorMaterial: 'concrete',
    areas: [
      { name: 'Room', min: [-4, -4], max: [0, 4] },
      { name: 'Hall', min: [0, -1], max: [4, 1] },
    ],
    solids: [box(-3, 0, -3, -2, 1, -2, 'wood')],
    spawns: { attacker: [spawn(-2, 0, 0)], defender: [spawn(3, 0, 90)] },
  };

  it('builds a valid map: ground slab, solid mass around the areas, extra solids, regions', () => {
    const map = buildBlockout(def);
    expect(validateMap(map)).toEqual([]);
    expect(map.solids[0]).toMatchObject({ min: [-5, -1, -5], max: [5, 0, 5] });
    expect(map.regions.map((r) => r.name)).toEqual(['Room', 'Hall']);
    // Wall boxes cover exactly the 100 - 32 - 8 = 60 cells outside the areas.
    let wallArea = 0;
    for (const s of map.solids) {
      if (s.min[1] === 0 && s.max[1] === 4)
        wallArea += (s.max[0] - s.min[0]) * (s.max[2] - s.min[2]);
    }
    expect(wallArea).toBe(60);
    expect(map.spawns.defender[0]?.yaw).toBeCloseTo(Math.PI / 2);
  });

  it('rejects areas off the 1 m grid', () => {
    expect(() =>
      buildBlockout({ ...def, areas: [{ name: 'Bad', min: [0.5, 0], max: [2, 2] }] }),
    ).toThrow(/whole meters/);
  });

  it('builds stairs as rising solid steps', () => {
    const steps = stairs(0, 0, 2, 5, 0, 3, 10, '-z');
    expect(steps).toHaveLength(10);
    // The first step is at the south (+z) end and the steps climb northward.
    expect(steps[0]).toMatchObject({ min: [0, 0, 4.5], max: [2, 0.3, 5] });
    expect(steps[9]?.max[1]).toBeCloseTo(3);
    expect(steps[9]?.min[2]).toBeCloseTo(0);
  });
});
