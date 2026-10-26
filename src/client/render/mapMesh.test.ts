import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import type { MapDef } from '../../sim/map/MapDef';
import { buildMapGeometry } from './mapMesh';

function triangles(g: BufferGeometry): number {
  return g.getAttribute('position').count / 3;
}

/** Every triangle's stored normal must match its winding and point away from `center`. */
function expectOutward(g: BufferGeometry, center: [number, number, number]): void {
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  for (let t = 0; t < pos.count; t += 3) {
    const ax = pos.getX(t);
    const ay = pos.getY(t);
    const az = pos.getZ(t);
    const ux = pos.getX(t + 1) - ax;
    const uy = pos.getY(t + 1) - ay;
    const uz = pos.getZ(t + 1) - az;
    const vx = pos.getX(t + 2) - ax;
    const vy = pos.getY(t + 2) - ay;
    const vz = pos.getZ(t + 2) - az;
    const cross = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx] as const;
    const n = [nrm.getX(t), nrm.getY(t), nrm.getZ(t)] as const;
    // Counter-clockwise winding agrees with the normal.
    expect(cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2]).toBeGreaterThan(0);
    const mid = [
      (ax + pos.getX(t + 1) + pos.getX(t + 2)) / 3 - center[0],
      (ay + pos.getY(t + 1) + pos.getY(t + 2)) / 3 - center[1],
      (az + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3 - center[2],
    ] as const;
    expect(mid[0] * n[0] + mid[1] * n[1] + mid[2] * n[2]).toBeGreaterThan(0);
  }
}

function single(solid: MapDef['solids'][number]): MapDef {
  return {
    id: 'mesh-test',
    name: 'Mesh test',
    bounds: { min: [-10, -10, -10], max: [10, 10, 10] },
    solids: [solid],
    spawns: { attacker: [], defender: [] },
    regions: [],
  };
}

describe('buildMapGeometry', () => {
  it('builds a closed, outward-facing box', () => {
    const { lit, glow } = buildMapGeometry(
      single({ kind: 'box', min: [1, 1, 1], max: [3, 2, 4], material: 'concrete' }),
    );
    expect(triangles(lit)).toBe(12);
    expect(triangles(glow)).toBe(0);
    expectOutward(lit, [2, 1.5, 2.5]);
  });

  it('skips bottom faces resting on the ground', () => {
    const { lit } = buildMapGeometry(
      single({ kind: 'box', min: [0, 0, 0], max: [1, 1, 1], material: 'wood' }),
    );
    expect(triangles(lit)).toBe(10);
  });

  it.each(['+x', '-x', '+z', '-z'] as const)('builds an outward-facing ramp rising %s', (rise) => {
    const { lit } = buildMapGeometry(
      single({ kind: 'ramp', min: [0, 1, 0], max: [4, 2, 2], rise, material: 'grate' }),
    );
    // bottom 2 + slope 2 + tall side 2 + two end triangles.
    expect(triangles(lit)).toBe(8);
    // The wedge's centroid: average of its 6 corners.
    const highX = rise === '+x' ? 4 : rise === '-x' ? 0 : null;
    const highZ = rise === '+z' ? 2 : rise === '-z' ? 0 : null;
    const cx = highX === null ? 2 : (0 + 4 + 4 + 0 + highX * 2) / 6;
    const cz = highZ === null ? 1 : (0 + 0 + 2 + 2 + highZ * 2) / 6;
    expectOutward(lit, [cx, (1 * 4 + 2 * 2) / 6, cz]);
  });

  it('routes team-colored surfaces to the glow geometry', () => {
    const { lit, glow } = buildMapGeometry(
      single({ kind: 'box', min: [0, 1, 0], max: [1, 2, 1], material: 'attacker' }),
    );
    expect(triangles(lit)).toBe(0);
    expect(triangles(glow)).toBe(12);
  });
});
