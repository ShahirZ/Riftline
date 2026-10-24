import { describe, expect, it } from 'vitest';
import { DT } from '../sim/core/constants';
import { FixedStepper } from './FixedStepper';

describe('FixedStepper', () => {
  it('runs one step per tick-length frame', () => {
    const s = new FixedStepper(DT, 8);
    expect(s.advance(DT)).toBe(1);
    expect(s.advance(DT)).toBe(1);
    expect(s.alpha).toBeCloseTo(0, 5);
  });

  it('accumulates short frames and exposes the interpolation factor', () => {
    const s = new FixedStepper(DT, 8);
    expect(s.advance(DT / 2)).toBe(0);
    expect(s.alpha).toBeCloseTo(0.5, 5);
    expect(s.advance(DT / 2)).toBe(1);
    expect(s.alpha).toBeCloseTo(0, 5);
  });

  it('keeps exact tick counts at high refresh rates', () => {
    for (const hz of [144, 165, 240, 360]) {
      const s = new FixedStepper(DT, 8);
      let steps = 0;
      for (let frame = 0; frame < hz * 10; frame++) steps += s.advance(1 / hz);
      // Ten seconds of frames is exactly 600 ticks.
      expect(steps).toBe(600);
    }
  });

  it('clamps long stalls and drops excess steps', () => {
    const s = new FixedStepper(DT, 8, 0.25);
    // A 3 s stall is clamped to 0.25 s (15 steps), of which only 8 run.
    expect(s.advance(3)).toBe(8);
    expect(s.droppedSteps).toBe(7);
    expect(s.alpha).toBeGreaterThanOrEqual(0);
    expect(s.alpha).toBeLessThan(1);
    // The dropped backlog is not replayed on the next frame.
    expect(s.advance(DT)).toBe(1);
  });

  it('ignores negative elapsed time', () => {
    const s = new FixedStepper(DT, 8);
    expect(s.advance(-1)).toBe(0);
    expect(s.alpha).toBe(0);
  });
});
