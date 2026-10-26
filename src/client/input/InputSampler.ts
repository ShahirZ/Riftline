import { clamp, wrapAngle } from '../../sim/core/math';
import { Button } from '../../sim/input/InputCommand';
import type { InputCommand } from '../../sim/input/InputCommand';
import { PITCH_LIMIT } from '../../sim/movement/PlayerMovement';
import { ACTIONS } from './bindings';
import type { Action, Bindings } from './bindings';

const ACTION_INDEX = new Map<Action, number>(ACTIONS.map((a, i) => [a, i]));
const FORWARD = ACTION_INDEX.get('forward') ?? 0;
const BACK = ACTION_INDEX.get('back') ?? 0;
const LEFT = ACTION_INDEX.get('left') ?? 0;
const RIGHT = ACTION_INDEX.get('right') ?? 0;
/** InputCommand button bit for each action index (0 for movement axes). */
const ACTION_BITS = ACTIONS.map((a) => (a in Button ? Button[a as keyof typeof Button] : 0));

/**
 * Turns raw keyboard and mouse input into one InputCommand per sim tick.
 *
 * - Mouse look is applied immediately on every mouse event, so the camera turns at display rate;
 *   each command carries the absolute view angles at the moment it is built.
 * - Presses are latched: a key that goes down and up again between two ticks still shows as held
 *   for one tick, so quick taps (counter-strafes, jump taps) are never lost.
 *
 * The event methods take plain values, so the logic is testable without a browser; `attach`
 * wires them to DOM events.
 */
export class InputSampler {
  yaw = 0;
  pitch = 0;
  /** When false, key and mouse events are ignored (menus open, pointer unlocked). */
  enabled = false;
  private radiansPerCount = 0;
  private invertY = false;
  private readonly bound = new Map<string, number[]>();
  /** How many bound inputs hold each action down right now. */
  private readonly holdCount = new Uint8Array(ACTIONS.length);
  /** Actions pressed since the last sample. */
  private readonly pressed = new Uint8Array(ACTIONS.length);
  private readonly heldInputs = new Set<string>();

  constructor(bindings: Bindings) {
    this.setBindings(bindings);
  }

  setBindings(bindings: Bindings): void {
    this.bound.clear();
    for (const action of ACTIONS) {
      const index = ACTION_INDEX.get(action) ?? 0;
      for (const input of bindings[action]) {
        const list = this.bound.get(input) ?? [];
        list.push(index);
        this.bound.set(input, list);
      }
    }
    this.releaseAll();
  }

  /** Mouse sensitivity in degrees per mouse count. */
  setLook(degreesPerCount: number, invertY: boolean): void {
    this.radiansPerCount = (degreesPerCount * Math.PI) / 180;
    this.invertY = invertY;
  }

  setView(yaw: number, pitch: number): void {
    this.yaw = wrapAngle(yaw);
    this.pitch = clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
  }

  /** Returns true if the input is bound (so the caller can suppress the browser default). */
  press(input: string): boolean {
    const actions = this.bound.get(input);
    if (!actions || !this.enabled) return false;
    if (this.heldInputs.has(input)) return true;
    this.heldInputs.add(input);
    for (const a of actions) {
      this.holdCount[a] = (this.holdCount[a] ?? 0) + 1;
      this.pressed[a] = 1;
    }
    return true;
  }

  release(input: string): void {
    if (!this.heldInputs.delete(input)) return;
    const actions = this.bound.get(input);
    if (!actions) return;
    for (const a of actions) this.holdCount[a] = Math.max((this.holdCount[a] ?? 0) - 1, 0);
  }

  /** Applies raw mouse movement (counts). Right and down are positive. */
  look(dx: number, dy: number): void {
    if (!this.enabled) return;
    this.yaw = wrapAngle(this.yaw - dx * this.radiansPerCount);
    const dir = this.invertY ? 1 : -1;
    this.pitch = clamp(this.pitch + dir * dy * this.radiansPerCount, -PITCH_LIMIT, PITCH_LIMIT);
  }

  /** Lets go of everything (focus loss, pause): no key stays stuck down. */
  releaseAll(): void {
    this.heldInputs.clear();
    this.holdCount.fill(0);
    this.pressed.fill(0);
  }

  /** Fills `cmd` for the given tick and clears the press latches. Allocation-free. */
  sample(cmd: InputCommand, tick: number): InputCommand {
    cmd.tick = tick;
    cmd.forward = this.active(FORWARD) - this.active(BACK);
    cmd.strafe = this.active(RIGHT) - this.active(LEFT);
    cmd.yaw = this.yaw;
    cmd.pitch = this.pitch;
    let buttons = 0;
    for (let i = 0; i < ACTION_BITS.length; i++) {
      const bit = ACTION_BITS[i] ?? 0;
      if (bit !== 0 && this.active(i) === 1) buttons |= bit;
    }
    cmd.buttons = buttons;
    cmd.weaponSlot = -1;
    this.pressed.fill(0);
    return cmd;
  }

  /** 1 if the action is held now or was pressed since the last sample. */
  private active(index: number): number {
    return (this.holdCount[index] ?? 0) > 0 || this.pressed[index] === 1 ? 1 : 0;
  }

  /** Wires DOM keyboard and mouse-button events. Mouse movement comes from PointerLock. */
  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      // Leave browser shortcuts (Ctrl+R, Cmd+L...) alone.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (this.press(e.code)) e.preventDefault();
    });
    target.addEventListener('keyup', (e) => this.release(e.code));
    target.addEventListener('mousedown', (e) => {
      if (this.press(`Mouse${e.button}`)) e.preventDefault();
    });
    target.addEventListener('mouseup', (e) => this.release(`Mouse${e.button}`));
    target.addEventListener('blur', () => this.releaseAll());
  }
}
