import { describe, expect, it } from 'vitest';
import {
  Button,
  clearInputCommand,
  copyInputCommand,
  createInputCommand,
  isDown,
  wasPressed,
} from './InputCommand';

describe('Button bits', () => {
  it('are unique single bits', () => {
    const values = Object.values(Button);
    let seen = 0;
    for (const v of values) {
      expect(v & (v - 1)).toBe(0); // power of two
      expect(seen & v).toBe(0); // not reused
      seen |= v;
    }
  });
});

describe('InputCommand helpers', () => {
  it('copies every field', () => {
    const src = createInputCommand();
    src.tick = 9;
    src.forward = 1;
    src.strafe = -1;
    src.yaw = 1.5;
    src.pitch = -0.25;
    src.buttons = Button.Fire | Button.Jump;
    src.weaponSlot = 2;
    expect(copyInputCommand(createInputCommand(), src)).toEqual(src);
  });

  it('clears intent but keeps view angles', () => {
    const cmd = createInputCommand();
    cmd.yaw = 2;
    cmd.pitch = 0.5;
    cmd.forward = 1;
    cmd.buttons = Button.Crouch;
    cmd.weaponSlot = 1;
    clearInputCommand(cmd);
    expect(cmd).toMatchObject({ yaw: 2, pitch: 0.5, forward: 0, buttons: 0, weaponSlot: -1 });
  });

  it('detects held buttons and press edges', () => {
    const cmd = createInputCommand();
    cmd.buttons = Button.Fire;
    expect(isDown(cmd, Button.Fire)).toBe(true);
    expect(isDown(cmd, Button.Jump)).toBe(false);
    expect(wasPressed(cmd, 0, Button.Fire)).toBe(true);
    expect(wasPressed(cmd, Button.Fire, Button.Fire)).toBe(false);
  });
});
