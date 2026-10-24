import { describe, expect, it } from 'vitest';
import { clamp, lerp, lerpAngle, wrapAngle } from './math';

describe('math', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('lerps', () => {
    expect(lerp(2, 4, 0.5)).toBe(3);
  });

  it('wraps angles into [-PI, PI)', () => {
    expect(wrapAngle(0)).toBeCloseTo(0);
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(-Math.PI);
    expect(wrapAngle(-Math.PI * 2.5)).toBeCloseTo(-Math.PI / 2);
    for (let a = -20; a <= 20; a += 0.37) {
      const w = wrapAngle(a);
      expect(w).toBeGreaterThanOrEqual(-Math.PI);
      expect(w).toBeLessThan(Math.PI);
      expect(Math.sin(w)).toBeCloseTo(Math.sin(a));
      expect(Math.cos(w)).toBeCloseTo(Math.cos(a));
    }
  });

  it('interpolates angles along the shortest arc', () => {
    // From just below +PI to just above -PI is a short hop across the seam, not a full turn.
    const a = Math.PI - 0.1;
    const b = -Math.PI + 0.1;
    const mid = lerpAngle(a, b, 0.5);
    expect(Math.abs(wrapAngle(mid - Math.PI))).toBeCloseTo(0, 5);
  });
});
