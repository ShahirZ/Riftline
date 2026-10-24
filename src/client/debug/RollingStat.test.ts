import { describe, expect, it } from 'vitest';
import { RollingStat } from './RollingStat';

describe('RollingStat', () => {
  it('is zero when empty', () => {
    const s = new RollingStat(4);
    expect(s.mean()).toBe(0);
    expect(s.max()).toBe(0);
  });

  it('tracks mean and max over the window only', () => {
    const s = new RollingStat(3);
    s.push(10);
    s.push(2);
    s.push(3);
    expect(s.mean()).toBe(5);
    expect(s.max()).toBe(10);
    s.push(4); // evicts the 10
    expect(s.mean()).toBe(3);
    expect(s.max()).toBe(4);
    expect(s.size).toBe(3);
  });
});
