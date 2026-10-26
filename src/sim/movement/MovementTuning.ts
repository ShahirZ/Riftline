/**
 * Movement feel parameters. Defaults live in src/data/movement.ts; the debug tuning panel can
 * override them live. Units: meters, seconds, m/s, m/s², degrees where noted.
 */
export interface MovementTuning {
  /** Top ground speed when running, m/s. */
  runSpeed: number;
  /** Top ground speed while holding walk (slow, quiet movement), m/s. */
  walkSpeed: number;
  /** Top ground speed while crouched, m/s. */
  crouchSpeed: number;
  /** Ground acceleration: speed gained per second is groundAccel × target speed (1/s). */
  groundAccel: number;
  /** Ground friction: the fraction of speed lost per second (1/s). */
  friction: number;
  /** Below this speed friction acts as if moving at it, so stops end crisply instead of creeping. */
  stopSpeed: number;
  /** How quickly air control changes horizontal velocity, m/s². */
  airAccel: number;
  /** Air control builds speed up to this from a standing jump, and never past the takeoff speed. */
  airDriftSpeed: number;
  gravity: number;
  maxFallSpeed: number;
  /** Height of a standing jump, measured at the feet, m. */
  jumpHeight: number;
  /** A jump pressed up to this long before landing fires on landing, s. */
  jumpBufferTime: number;
  /** A jump pressed up to this long after leaving the ground still fires, s. */
  coyoteTime: number;
  /** Landing impact speed (m/s) at which the landing slowdown starts. */
  landingSoftImpact: number;
  /** Landing impact speed (m/s) at which the landing slowdown reaches full strength. */
  landingHardImpact: number;
  /** Horizontal speed multiplier on a full-strength landing (also the top-speed cap right after). */
  landingSpeedFactor: number;
  /** Seconds for the top-speed cap to recover after a full-strength landing. */
  landingRecoveryTime: number;
  /** Seconds for the eye to travel between standing and crouched height. */
  crouchTime: number;
  /** Tallest ledge climbed automatically while walking, m. */
  stepHeight: number;
  /** Steepest walkable slope, degrees. Steeper surfaces behave like walls. */
  maxSlopeDeg: number;
}

/** Fixed body dimensions. Not live-tunable: map spaces and hitboxes are designed around them. */
export interface PlayerBody {
  /** Capsule radius, m. */
  radius: number;
  /** Total capsule height when standing, m. */
  standHeight: number;
  /** Total capsule height when crouched, m. */
  crouchHeight: number;
  /** Eye height above the feet when standing, m. */
  standEyeHeight: number;
  /** Eye height above the feet when crouched, m. */
  crouchEyeHeight: number;
}

/** Vertical takeoff speed that reaches `jumpHeight` under `gravity`. */
export function jumpSpeed(t: Pick<MovementTuning, 'jumpHeight' | 'gravity'>): number {
  return Math.sqrt(2 * t.gravity * t.jumpHeight);
}
