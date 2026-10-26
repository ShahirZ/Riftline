import { describe, expect, it } from 'vitest';
import { FOUNDRY_MAP } from '../../data/maps/foundry';
import { GYM_MAP } from '../../data/maps/gym';
import { rampCorners, rampSlope } from './geometry';
import type { MapDef, RampSolid } from './MapDef';
import { validateMap } from './validateMap';

const spawns: MapDef['spawns'] = {
  attacker: [{ position: [0, 0, 0], yaw: 0 }],
  defender: [{ position: [0, 0, 0], yaw: 0 }],
};

describe('validateMap', () => {
  it('accepts every shipped map', () => {
    expect(validateMap(FOUNDRY_MAP)).toEqual([]);
    expect(validateMap(GYM_MAP)).toEqual([]);
  });

  it('reports inverted, out-of-bounds, too-steep and oversized solids', () => {
    const broken: MapDef = {
      id: 'broken',
      name: 'Broken',
      bounds: { min: [-20, -1, -20], max: [20, 5, 20] },
      solids: [
        { kind: 'box', min: [1, 0, 0], max: [0, 1, 1], material: 'concrete' },
        { kind: 'box', min: [0, 0, 0], max: [29, 1, 1], material: 'metal' },
        { kind: 'ramp', min: [0, 0, 0], max: [1, 3, 1], rise: '+x', material: 'grate' },
        { kind: 'ramp', min: [0, 0, 0], max: [10, 1, 1], rise: '+x', material: 'grate' },
      ],
      spawns,
      regions: [],
    };
    const problems = validateMap(broken);
    expect(problems.some((p) => p.includes('solid #0') && p.includes('axis 0'))).toBe(true);
    expect(problems.some((p) => p.includes('solid #1') && p.includes('outside'))).toBe(true);
    expect(problems.some((p) => p.includes('solid #2') && p.includes('slope'))).toBe(true);
    expect(problems.some((p) => p.includes('solid #3') && p.includes('split'))).toBe(true);
  });

  it('reports missing or misplaced spawns and broken regions', () => {
    const broken: MapDef = {
      id: 'broken',
      name: 'Broken',
      bounds: { min: [-5, -1, -5], max: [5, 5, 5] },
      solids: [],
      spawns: { attacker: [], defender: [{ position: [9, 0, 0], yaw: 0 }] },
      regions: [
        { name: 'Empty', min: [1, 1], max: [1, 2] },
        { name: 'Outside', min: [0, 0], max: [8, 1] },
      ],
    };
    const problems = validateMap(broken);
    expect(problems).toContain('no attacker spawn points');
    expect(problems.some((p) => p.startsWith('defender spawn #0') && p.includes('outside'))).toBe(
      true,
    );
    expect(problems).toContain('region "Empty" is empty');
    expect(problems).toContain('region "Outside" extends outside the map bounds');
  });
});

describe('ramp geometry', () => {
  const ramp: RampSolid = {
    kind: 'ramp',
    min: [0, 0, 0],
    max: [4, 1, 2],
    rise: '+x',
    material: 'grate',
  };

  it('puts the top edge on the rising side', () => {
    const c = rampCorners(ramp, new Float32Array(18));
    // Corners 4 and 5 are the top edge: both at x = max.x and y = max.y.
    expect([c[12], c[13], c[15], c[16]]).toEqual([4, 1, 4, 1]);
    // Bottom corners all sit on y = min.y.
    for (let i = 0; i < 4; i++) expect(c[i * 3 + 1]).toBe(0);
  });

  it('computes the slope angle', () => {
    expect(rampSlope(ramp)).toBeCloseTo(Math.atan2(1, 4));
  });
});
