import { DT } from '../../sim/core/constants';
import { Button } from '../../sim/input/InputCommand';
import type { InputCommand } from '../../sim/input/InputCommand';
import type { MovementTuning } from '../../sim/movement/MovementTuning';
import type { Player } from '../../sim/player/Player';

/** Ticks of horizontal speed kept for the graph (3 s). */
export const SPEED_HISTORY = 180;
/**
 * Speed treated as "accurate" for stop timing: a quarter of run speed. Weapons (M2) define real
 * accuracy; this only makes stop times comparable between tuning changes.
 */
export const ACCURATE_FRACTION = 0.25;

export interface StopMeasurement {
  /** 'counter': the opposite direction was pressed; 'release': all movement keys let go. */
  readonly kind: 'counter' | 'release';
  /** Milliseconds until speed fell below ACCURATE_FRACTION of run speed. */
  readonly toAccurateMs: number;
  /** Milliseconds until motion along the old direction stopped. */
  readonly toStopMs: number;
}

export interface JumpMeasurement {
  /** Apex height above the takeoff point, m. */
  readonly height: number;
  readonly airTimeMs: number;
  /** Horizontal distance from takeoff to touchdown, m. */
  readonly distance: number;
  /** Downward speed at touchdown, m/s. */
  readonly impact: number;
}

/**
 * Watches the local player tick by tick and measures what movement tuning is about: how fast
 * stops and starts are and what jumps do. Shown in the speed HUD so feel feedback comes back as
 * numbers. Presentation-side only; it never touches the sim.
 */
export class MovementTelemetry {
  /** Ring buffer of horizontal speed per tick; `head` is the next slot to write. */
  readonly speeds = new Float32Array(SPEED_HISTORY);
  head = 0;
  lastStop: StopMeasurement | null = null;
  /** Milliseconds from standing still to 95% of run speed, for the latest start. */
  lastStartMs: number | null = null;
  lastJump: JumpMeasurement | null = null;

  private wasMoving = false;
  // Velocity at the end of the previous tick: stops and starts are judged against it.
  private prevVx = 0;
  private prevVz = 0;
  private stop: {
    kind: 'counter' | 'release';
    ticks: number;
    dirX: number;
    dirZ: number;
    accurateTicks: number;
  } | null = null;
  private start: { ticks: number } | null = null;
  private jump: { ticks: number; x: number; y: number; z: number; apex: number } | null = null;

  afterTick(p: Player, cmd: InputCommand, tuning: MovementTuning): void {
    const speed = p.speed;
    this.speeds[this.head] = speed;
    this.head = (this.head + 1) % SPEED_HISTORY;

    const moving = cmd.forward !== 0 || cmd.strafe !== 0;
    const wishX = -Math.sin(cmd.yaw) * cmd.forward + Math.cos(cmd.yaw) * cmd.strafe;
    const wishZ = -Math.cos(cmd.yaw) * cmd.forward - Math.sin(cmd.yaw) * cmd.strafe;
    const running = (cmd.buttons & (Button.Walk | Button.Crouch)) === 0;

    this.trackStop(p, speed, moving, wishX, wishZ, tuning);
    this.trackStart(p, speed, moving, running, tuning);
    this.trackJump(p);
    this.wasMoving = moving;
    this.prevVx = p.vx;
    this.prevVz = p.vz;
  }

  private trackStop(
    p: Player,
    speed: number,
    moving: boolean,
    wishX: number,
    wishZ: number,
    tuning: MovementTuning,
  ): void {
    // A stop begins when a fast-moving player releases the keys or presses against the motion.
    const before = Math.hypot(this.prevVx, this.prevVz);
    if (!this.stop && p.onGround && before > tuning.runSpeed * 0.8 && this.wasMoving) {
      const along = (wishX * this.prevVx + wishZ * this.prevVz) / before;
      const kind = !moving ? 'release' : along < -0.5 ? 'counter' : null;
      if (kind) {
        const dirX = this.prevVx / before;
        const dirZ = this.prevVz / before;
        this.stop = { kind, ticks: 0, dirX, dirZ, accurateTicks: -1 };
      }
    }
    const stop = this.stop;
    if (!stop) return;
    stop.ticks++;
    if (stop.accurateTicks < 0 && speed < tuning.runSpeed * ACCURATE_FRACTION) {
      stop.accurateTicks = stop.ticks;
    }
    const along = p.vx * stop.dirX + p.vz * stop.dirZ;
    if (along <= 0.05) {
      this.lastStop = {
        kind: stop.kind,
        toAccurateMs: (stop.accurateTicks < 0 ? stop.ticks : stop.accurateTicks) * DT * 1000,
        toStopMs: stop.ticks * DT * 1000,
      };
      this.stop = null;
    } else if (stop.ticks > 120 || (stop.kind === 'release' && moving)) {
      this.stop = null; // Interrupted: not a clean stop.
    }
  }

  private trackStart(
    p: Player,
    speed: number,
    moving: boolean,
    running: boolean,
    tuning: MovementTuning,
  ): void {
    const before = Math.hypot(this.prevVx, this.prevVz);
    if (!this.start && moving && !this.wasMoving && before < 0.5 && p.onGround && running) {
      this.start = { ticks: 0 };
    }
    const start = this.start;
    if (!start) return;
    start.ticks++;
    if (speed >= tuning.runSpeed * 0.95) {
      this.lastStartMs = start.ticks * DT * 1000;
      this.start = null;
    } else if (!moving || !p.onGround || start.ticks > 120) {
      this.start = null;
    }
  }

  private trackJump(p: Player): void {
    if (p.jumped) {
      this.jump = { ticks: 0, x: p.prevX, y: p.prevY, z: p.prevZ, apex: p.y };
      return;
    }
    const jump = this.jump;
    if (!jump) return;
    jump.ticks++;
    jump.apex = Math.max(jump.apex, p.y);
    if (p.landedImpact > 0) {
      this.lastJump = {
        height: jump.apex - jump.y,
        airTimeMs: (jump.ticks + 1) * DT * 1000,
        distance: Math.hypot(p.x - jump.x, p.z - jump.z),
        impact: p.landedImpact,
      };
      this.jump = null;
    } else if (jump.ticks > 600) {
      this.jump = null;
    }
  }
}
