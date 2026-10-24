/**
 * The per-tick input contract between a controller (local player, bot brain, or later a network
 * peer) and the simulation. The sim reads nothing else from a controller, which is what keeps
 * multiplayer addable: a server can run the same sim from commands received over the wire.
 *
 * Commands are plain data with no references, so they copy, serialize and replay cleanly.
 */

/** Action bits carried in InputCommand.buttons. The bit layout is part of the wire contract. */
export const Button = {
  Fire: 1 << 0,
  /** Aim down sights / scope. */
  AltFire: 1 << 1,
  Reload: 1 << 2,
  Jump: 1 << 3,
  Crouch: 1 << 4,
  /** Slow, quiet movement. */
  Walk: 1 << 5,
  /** Context action: arm or disarm the relay, pick up. */
  Use: 1 << 6,
  Ability1: 1 << 7,
  Ability2: 1 << 8,
  Drop: 1 << 9,
} as const;

export type ButtonName = keyof typeof Button;

export interface InputCommand {
  /** Simulation tick this command applies to. */
  tick: number;
  /** Forward intent in [-1, 1] (back to forward). */
  forward: number;
  /** Strafe intent in [-1, 1] (left to right). */
  strafe: number;
  /** Absolute view yaw in radians. */
  yaw: number;
  /** Absolute view pitch in radians, positive looks up. */
  pitch: number;
  /** Bitfield of Button flags held (or pressed and released) during this tick. */
  buttons: number;
  /** Requested weapon slot, or -1 for no change. */
  weaponSlot: number;
}

export function createInputCommand(): InputCommand {
  return { tick: 0, forward: 0, strafe: 0, yaw: 0, pitch: 0, buttons: 0, weaponSlot: -1 };
}

/** Clears intent but keeps the view angles, which persist between ticks. */
export function clearInputCommand(cmd: InputCommand): void {
  cmd.forward = 0;
  cmd.strafe = 0;
  cmd.buttons = 0;
  cmd.weaponSlot = -1;
}

export function copyInputCommand(dst: InputCommand, src: InputCommand): InputCommand {
  dst.tick = src.tick;
  dst.forward = src.forward;
  dst.strafe = src.strafe;
  dst.yaw = src.yaw;
  dst.pitch = src.pitch;
  dst.buttons = src.buttons;
  dst.weaponSlot = src.weaponSlot;
  return dst;
}

export function isDown(cmd: InputCommand, button: number): boolean {
  return (cmd.buttons & button) !== 0;
}

/** True on the tick a button goes from up to down. */
export function wasPressed(cmd: InputCommand, previousButtons: number, button: number): boolean {
  return (cmd.buttons & button) !== 0 && (previousButtons & button) === 0;
}
