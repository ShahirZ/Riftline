import type { PerspectiveCamera } from 'three';
import { DT } from '../../sim/core/constants';
import { lerp } from '../../sim/core/math';
import type { Player } from '../../sim/player/Player';

/** The FOV setting is the horizontal FOV on a 16:9 screen; wider screens see more ("Hor+"). */
const REFERENCE_ASPECT = 16 / 9;

/** Vertical FOV in degrees (what three.js wants) for a horizontal FOV measured at 16:9. */
export function verticalFov(horizontalDeg: number): number {
  const h = (horizontalDeg * Math.PI) / 180;
  return (2 * Math.atan(Math.tan(h / 2) / REFERENCE_ASPECT) * 180) / Math.PI;
}

/** Time constant for the view to catch up after a step up or down, s. Stairs read as a ramp. */
const STEP_SMOOTH_TIME = 0.05;
const STEP_DECAY = Math.exp(-DT / STEP_SMOOTH_TIME);
/** Landing dip spring: critically damped, angular frequency in rad/s. */
const DIP_OMEGA = 14;
/** Landings softer than this (m/s) cause no dip. */
const DIP_MIN_IMPACT = 2;
/** Initial dip speed (m/s) per m/s of impact above the minimum. */
const DIP_PER_IMPACT = 0.33;
/** Cap on the initial dip speed, m/s: the deepest dip is about 8 cm. */
const DIP_MAX_SPEED = 3;

/**
 * The first-person view. Position comes from the sim, interpolated between ticks; view angles come
 * straight from the input sampler, so turning never waits for a tick. Adds two purely cosmetic
 * effects: step smoothing (stairs and snaps down do not jolt the view) and a subtle landing dip.
 * No head bob.
 */
export class FirstPersonCamera {
  /** Horizontal FOV at 16:9, degrees. */
  fov = 100;
  private stepOffset = 0;
  private prevStepOffset = 0;
  private dip = 0;
  private dipSpeed = 0;

  /** Call after every sim tick, with the player the camera follows. */
  afterTick(player: Player): void {
    this.prevStepOffset = this.stepOffset;
    // Cancel this tick's step in the view, then let the view catch up.
    this.stepOffset = this.stepOffset * STEP_DECAY - player.stepDelta;
    if (player.landedImpact > DIP_MIN_IMPACT) {
      this.dipSpeed -= Math.min(
        (player.landedImpact - DIP_MIN_IMPACT) * DIP_PER_IMPACT,
        DIP_MAX_SPEED,
      );
    }
  }

  /** Forgets cosmetic offsets (after a respawn or teleport). */
  reset(): void {
    this.stepOffset = 0;
    this.prevStepOffset = 0;
    this.dip = 0;
    this.dipSpeed = 0;
  }

  /** Current vertical offset of the view from cosmetic effects, m (for tests and the overlay). */
  get offset(): number {
    return this.stepOffset + this.dip;
  }

  update(
    camera: PerspectiveCamera,
    player: Player,
    alpha: number,
    yaw: number,
    pitch: number,
    frameSeconds: number,
  ): void {
    // Semi-implicit Euler on the dip spring; long frames are clamped so it cannot blow up.
    const dt = Math.min(frameSeconds, 1 / 30);
    const accel = -DIP_OMEGA * DIP_OMEGA * this.dip - 2 * DIP_OMEGA * this.dipSpeed;
    this.dipSpeed += accel * dt;
    this.dip += this.dipSpeed * dt;

    const eye = lerp(player.prevEyeHeight, player.eyeHeight, alpha);
    const step = lerp(this.prevStepOffset, this.stepOffset, alpha);
    camera.position.set(
      lerp(player.prevX, player.x, alpha),
      lerp(player.prevY, player.y, alpha) + eye + step + this.dip,
      lerp(player.prevZ, player.z, alpha),
    );
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    const fov = verticalFov(this.fov);
    if (Math.abs(camera.fov - fov) > 1e-6) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }
}
