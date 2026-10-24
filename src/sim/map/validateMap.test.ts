import { describe, expect, it } from 'vitest';
import { SHOWCASE_MAP } from '../../data/maps/showcase';
import { rampCorners, rampSlope } from './geometry';
import type { MapDef, RampSolid } from './MapDef';
import { validateMap } from './validateMap';

describe('validateMap', () => {
  it('accepts every shipped map', () => {
    expect(validateMap(SHOWCASE_MAP)).toEqual([]);
  });

  it('reports inverted, out-of-bounds and too-steep solids', () => {
    const broken: MapDef = {
      id: 'broken',
      name: 'Broken',
      bounds: { min: [-5, -1, -5], max: [5, 5, 5] },
      solids: [
        { kind: 'box', min: [1, 0, 0], max: [0, 1, 1], material: 'concrete' },
        { kind: 'box', min: [0, 0, 0], max: [9, 1, 1], material: 'metal' },
        { kind: 'ramp', min: [0, 0, 0], max: [1, 3, 1], rise: '+x', material: 'grate' },
      ],
    };
    const problems = validateMap(broken);
    expect(problems.some((p) => p.includes('solid #0') && p.includes('axis 0'))).toBe(true);
    expect(problems.some((p) => p.includes('solid #1') && p.includes('outside'))).toBe(true);
    expect(problems.some((p) => p.includes('solid #2') && p.includes('slope'))).toBe(true);
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
