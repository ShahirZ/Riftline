import { createInputCommand } from '../input/InputCommand';
import type { InputCommand } from '../input/InputCommand';

export type Team = 'attacker' | 'defender';

/**
 * One character in the match (the local player now; bots and remote players later). Driven only
 * by the InputCommand stored in `input` each tick.
 *
 * The position is the feet point: the bottom of the collision capsule, resting on the ground
 * when standing (plus the motor's 1 cm skin gap). `prev*` copies hold the previous tick for
 * render interpolation.
 */
export class Player {
  /** The command for the next tick, written by the controller via Sim.setInput. */
  readonly input: InputCommand = createInputCommand();
  /** Buttons held on the previous tick, for press-edge detection. */
  prevButtons = 0;

  x = 0;
  y = 0;
  z = 0;
  prevX = 0;
  prevY = 0;
  prevZ = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  /** View angles from the last command, radians. Yaw 0 looks toward -Z (north). */
  yaw = 0;
  pitch = 0;

  /** Collision stance. The eye height follows it smoothly. */
  crouched = false;
  /** Eye height above the feet, m. */
  eyeHeight: number;
  prevEyeHeight: number;

  onGround = false;
  /** Normal of the walkable surface under the player (valid while onGround). */
  groundNx = 0;
  groundNy = 1;
  groundNz = 0;
  /** Seconds since the player last stood on the ground. */
  airTime = 0;
  /** True from a jump until the next landing; blocks coyote-time jumps. */
  jumping = false;
  /** Seconds a buffered jump press stays valid. */
  jumpBuffer = 0;
  /** Top-speed multiplier from the last landing, recovering to 1. */
  landingFactor = 1;

  // Per-tick presentation cues, valid for the most recent tick only.
  /** Downward speed at touchdown on the tick the player landed, else 0, m/s. */
  landedImpact = 0;
  /** True on the tick a jump started. */
  jumped = false;
  /** Vertical position change this tick caused by stepping up or snapping down, m. */
  stepDelta = 0;

  constructor(
    readonly id: number,
    readonly team: Team,
    standEyeHeight: number,
  ) {
    this.eyeHeight = standEyeHeight;
    this.prevEyeHeight = standEyeHeight;
  }

  /** Horizontal speed, m/s. */
  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  /** Puts the player at a spawn point, standing still. */
  place(x: number, y: number, z: number, yaw: number, standEyeHeight: number): void {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.z = this.prevZ = z;
    this.vx = this.vy = this.vz = 0;
    this.yaw = yaw;
    this.pitch = 0;
    this.input.yaw = yaw;
    this.input.pitch = 0;
    this.crouched = false;
    this.eyeHeight = this.prevEyeHeight = standEyeHeight;
    this.onGround = false;
    this.airTime = 0;
    this.jumping = false;
    this.jumpBuffer = 0;
    this.landingFactor = 1;
    this.landedImpact = 0;
    this.jumped = false;
    this.stepDelta = 0;
  }

  storePrevious(): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevZ = this.z;
    this.prevEyeHeight = this.eyeHeight;
  }
}
