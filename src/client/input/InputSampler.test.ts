import { describe, expect, it } from 'vitest';
import { Button, createInputCommand, isDown } from '../../sim/input/InputCommand';
import { PITCH_LIMIT } from '../../sim/movement/PlayerMovement';
import { DEFAULT_BINDINGS } from './bindings';
import { InputSampler } from './InputSampler';

function sampler(): InputSampler {
  const s = new InputSampler(DEFAULT_BINDINGS);
  s.enabled = true;
  s.setLook(0.05, false);
  return s;
}

describe('InputSampler', () => {
  it('maps held keys to movement axes and buttons', () => {
    const s = sampler();
    s.press('KeyW');
    s.press('KeyD');
    s.press('Space');
    const cmd = s.sample(createInputCommand(), 7);
    expect(cmd).toMatchObject({ tick: 7, forward: 1, strafe: 1 });
    expect(isDown(cmd, Button.Jump)).toBe(true);
    expect(isDown(cmd, Button.Crouch)).toBe(false);
  });

  it('cancels opposite keys', () => {
    const s = sampler();
    s.press('KeyA');
    s.press('KeyD');
    expect(s.sample(createInputCommand(), 0).strafe).toBe(0);
  });

  it('keeps a tap shorter than a tick for exactly one tick', () => {
    const s = sampler();
    s.press('KeyA');
    s.release('KeyA');
    s.press('Space');
    s.release('Space');
    const first = s.sample(createInputCommand(), 0);
    expect(first.strafe).toBe(-1);
    expect(isDown(first, Button.Jump)).toBe(true);
    const second = s.sample(createInputCommand(), 1);
    expect(second.strafe).toBe(0);
    expect(isDown(second, Button.Jump)).toBe(false);
  });

  it('holds an action while any of its keys is down', () => {
    const s = sampler();
    s.press('ShiftLeft');
    s.press('ShiftRight');
    s.release('ShiftLeft');
    expect(isDown(s.sample(createInputCommand(), 0), Button.Walk)).toBe(true);
    s.release('ShiftRight');
    expect(isDown(s.sample(createInputCommand(), 1), Button.Walk)).toBe(false);
  });

  it('ignores input while disabled and releases everything on demand', () => {
    const s = sampler();
    s.enabled = false;
    expect(s.press('KeyW')).toBe(false);
    s.look(100, 0);
    expect(s.sample(createInputCommand(), 0).forward).toBe(0);
    expect(s.yaw).toBe(0);
    s.enabled = true;
    s.press('KeyW');
    s.releaseAll();
    expect(s.sample(createInputCommand(), 1).forward).toBe(0);
  });

  it('turns by the configured degrees per count, right and down being positive', () => {
    const s = sampler();
    s.look(100, 0); // 5 degrees to the right: yaw decreases
    expect(s.yaw).toBeCloseTo((-5 * Math.PI) / 180);
    s.look(0, -100); // mouse up looks up
    expect(s.pitch).toBeCloseTo((5 * Math.PI) / 180);
    s.setLook(0.05, true);
    s.look(0, -100);
    expect(s.pitch).toBeCloseTo(0);
    const cmd = s.sample(createInputCommand(), 0);
    expect(cmd.yaw).toBeCloseTo(s.yaw);
  });

  it('clamps pitch and wraps yaw', () => {
    const s = sampler();
    s.look(0, -1e6);
    expect(s.pitch).toBe(PITCH_LIMIT);
    s.look(1e5 + 3, 0);
    expect(s.yaw).toBeGreaterThanOrEqual(-Math.PI);
    expect(s.yaw).toBeLessThan(Math.PI);
  });
});
