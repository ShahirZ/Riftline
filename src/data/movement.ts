import type { MovementTuning, PlayerBody } from '../sim/movement/MovementTuning';

/**
 * Movement feel. Ground movement is friction plus acceleration, so pressing the opposite key
 * (counter-strafing) stops about three times faster than releasing:
 *   0 -> 95% run speed      ~133 ms
 *   release -> 1.5 m/s      ~150 ms    (fully stopped ~217 ms)
 *   counter-strafe -> 1.5   ~50 ms     (fully stopped ~67 ms)
 * The movement tests pin these properties; the tuning panel (pause menu) edits them live.
 */
export const MOVEMENT = {
  runSpeed: 6.0,
  walkSpeed: 3.1,
  crouchSpeed: 2.0,
  groundAccel: 12,
  friction: 8,
  stopSpeed: 3,
  airAccel: 4,
  airDriftSpeed: 2,
  gravity: 20,
  maxFallSpeed: 40,
  jumpHeight: 1.05,
  jumpBufferTime: 0.1,
  coyoteTime: 0.08,
  landingSoftImpact: 3,
  landingHardImpact: 7,
  landingSpeedFactor: 0.6,
  landingRecoveryTime: 0.3,
  crouchTime: 0.12,
  stepHeight: 0.45,
  maxSlopeDeg: 45,
} as const satisfies MovementTuning;

/**
 * Body size. A standing jump clears about 1.05 m and a crouch-jump (crouch at the top of the jump
 * to tuck the feet) about 1.6 m; map heights are chosen around these numbers.
 */
export const PLAYER_BODY = {
  radius: 0.32,
  standHeight: 1.8,
  crouchHeight: 1.25,
  standEyeHeight: 1.62,
  crouchEyeHeight: 1.07,
} as const satisfies PlayerBody;
