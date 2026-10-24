import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed } from './rng';

function draw(rng: Rng, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(rng.nextU32());
  return out;
}

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    expect(draw(new Rng(1234), 64)).toEqual(draw(new Rng(1234), 64));
  });

  it('produces different sequences for adjacent seeds', () => {
    const a = draw(new Rng(1), 16);
    const b = draw(new Rng(2), 16);
    const shared = a.filter((v, i) => v === b[i]).length;
    expect(shared).toBe(0);
  });

  it('keeps next() within [0, 1)', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('keeps int() within [min, maxExclusive) and hits every value', () => {
    const rng = new Rng(7);
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 60_000; i++) {
      const v = rng.int(0, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    // Roughly uniform: each bucket within 5% of the expected 10k.
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(500);
  });

  it('has a mean near 0.5', () => {
    const rng = new Rng(2024);
    let sum = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) sum += rng.next();
    expect(Math.abs(sum / n - 0.5)).toBeLessThan(0.005);
  });

  it('restores an exact sequence from saved state', () => {
    const rng = new Rng(555);
    draw(rng, 10);
    const state = rng.getState(new Uint32Array(4));
    const expected = draw(rng, 32);
    const restored = new Rng(0);
    restored.setState(state);
    expect(draw(restored, 32)).toEqual(expected);
  });
});

describe('deriveSeed', () => {
  it('gives independent, stable streams per label', () => {
    const recoil = deriveSeed(42, 'recoil');
    const bots = deriveSeed(42, 'bots');
    expect(recoil).not.toBe(bots);
    expect(deriveSeed(42, 'recoil')).toBe(recoil);
    expect(draw(new Rng(recoil), 8)).not.toEqual(draw(new Rng(bots), 8));
  });

  it('depends on the match seed', () => {
    expect(deriveSeed(1, 'recoil')).not.toBe(deriveSeed(2, 'recoil'));
  });
});
