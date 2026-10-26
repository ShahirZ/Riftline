import { DT } from '../core/constants';
import { clamp, lerp, wrapAngle } from '../core/math';
import { Button } from '../input/InputCommand';
import type { InputCommand } from '../input/InputCommand';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { Player } from '../player/Player';
import { CharacterMotor } from './CharacterMotor';
import type { Vec3 } from './CharacterMotor';
import { jumpSpeed } from './MovementTuning';
import type { MovementTuning, PlayerBody } from './MovementTuning';

/** View pitch limit, just short of straight up or down. */
export const PITCH_LIMIT = (89 * Math.PI) / 180;

/**
 * Player movement rules, run once per tick per player from its InputCommand.
 *
 * - Ground: friction plus acceleration toward the input direction (so counter-strafing beats
 *   releasing), moving along the slope underneath at the same speed.
 * - Air: steering and braking toward the input direction, never past the takeoff speed (no
 *   air-strafe speed gain); a standing jump can drift up to airDriftSpeed.
 * - Jumps: a fresh press is buffered briefly and still fires just after leaving a ledge.
 * - Landing: hard landings cut horizontal speed and briefly cap top speed, so chained jumps are
 *   always slower than running.
 * - Crouch: on the ground the head lowers; in the air the feet tuck up (crouch-jumps reach
 *   higher). Standing up needs room for the full body.
 *
 * Collision is the CharacterMotor's job. All state lives on the Player.
 */
export class PlayerMovement {
  readonly motor: CharacterMotor;
  private readonly center: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly probeCenter: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly vel: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly ground: Vec3 = { x: 0, y: 1, z: 0 };
  private readonly face: Vec3 = { x: 0, y: 1, z: 0 };

  constructor(
    physics: PhysicsWorld,
    readonly body: PlayerBody,
  ) {
    this.motor = new CharacterMotor(physics.world, body);
  }

  /** Height of the body's center above the feet. */
  centerOffset(crouched: boolean): number {
    return (crouched ? this.body.crouchHeight : this.body.standHeight) / 2;
  }

  /** True if the player's body for `crouched` would fit with its feet at (x, feetY, z). */
  fitsAt(x: number, feetY: number, z: number, crouched: boolean): boolean {
    const c = this.probeCenter;
    c.x = x;
    c.y = feetY + this.centerOffset(crouched);
    c.z = z;
    return this.motor.fits(crouched, c);
  }

  /** Advances one player by one tick. */
  step(p: Player, cmd: InputCommand, t: MovementTuning): void {
    const dt = DT;
    p.storePrevious();
    p.landedImpact = 0;
    p.jumped = false;
    p.stepDelta = 0;

    p.yaw = wrapAngle(cmd.yaw);
    p.pitch = clamp(cmd.pitch, -PITCH_LIMIT, PITCH_LIMIT);
    const buttons = cmd.buttons;
    const pressed = buttons & ~p.prevButtons;
    p.prevButtons = buttons;
    const walkableNy = Math.cos((t.maxSlopeDeg * Math.PI) / 180);

    // Safety net: never start a move inside geometry. (Nothing should put us there.)
    const center = this.toCenter(p);
    if (this.motor.depenetrate(this.motor.shapeFor(p.crouched), center)) {
      this.fromCenter(p, center);
    }

    if ((pressed & Button.Jump) !== 0) p.jumpBuffer = t.jumpBufferTime;
    const canJump = p.onGround || (!p.jumping && p.airTime <= t.coyoteTime);
    if (p.jumpBuffer > 0 && canJump) {
      p.vy = jumpSpeed(t);
      p.onGround = false;
      p.jumping = true;
      p.jumped = true;
      p.jumpBuffer = 0;
    }

    // After the jump: jump and crouch pressed on the same tick make a crouch-jump (feet tucked).
    this.updateStance(p, (buttons & Button.Crouch) !== 0);
    this.updateEyeHeight(p, t, dt);

    // Wish direction: forward is (-sin yaw, -cos yaw), right is (cos yaw, -sin yaw) on XZ.
    let forward = clamp(cmd.forward, -1, 1);
    let strafe = clamp(cmd.strafe, -1, 1);
    const inputLength = Math.hypot(forward, strafe);
    if (inputLength > 1) {
      forward /= inputLength;
      strafe /= inputLength;
    }
    const sin = Math.sin(p.yaw);
    const cos = Math.cos(p.yaw);
    const wx = -sin * forward + cos * strafe;
    const wz = -cos * forward - sin * strafe;
    const wishAmount = Math.hypot(wx, wz);
    const wdx = wishAmount > 1e-6 ? wx / wishAmount : 0;
    const wdz = wishAmount > 1e-6 ? wz / wishAmount : 0;

    if (p.onGround) {
      const stanceSpeed = p.crouched
        ? t.crouchSpeed
        : (buttons & Button.Walk) !== 0
          ? t.walkSpeed
          : t.runSpeed;
      const wishSpeed = stanceSpeed * p.landingFactor * wishAmount;
      this.groundMove(p, t, wdx, wdz, wishSpeed, walkableNy, dt);
    } else {
      this.airMove(p, t, wdx, wdz, wishAmount, walkableNy, dt);
    }

    p.jumpBuffer = Math.max(p.jumpBuffer - dt, 0);
    if (p.landingFactor < 1) {
      const recovery = (1 - t.landingSpeedFactor) / Math.max(t.landingRecoveryTime, 1e-3);
      p.landingFactor = Math.min(p.landingFactor + recovery * dt, 1);
    }
  }

  private groundMove(
    p: Player,
    t: MovementTuning,
    wdx: number,
    wdz: number,
    wishSpeed: number,
    walkableNy: number,
    dt: number,
  ): void {
    // Friction. With no movement input it bites as if moving at least at stopSpeed, so releases
    // end crisply instead of creeping; with input it never fights acceleration at low speed.
    const speed = Math.hypot(p.vx, p.vz);
    if (speed > 0) {
      const control = wishSpeed === 0 && speed < t.stopSpeed ? t.stopSpeed : speed;
      const k = Math.max(speed - control * t.friction * dt, 0) / speed;
      p.vx *= k;
      p.vz *= k;
    }
    // Accelerate toward the wish direction. Acceleration never lifts the total speed past
    // wishSpeed: otherwise holding a direction into a wall (which keeps removing the into-wall
    // part) would pump the along-wall speed above run speed.
    if (wishSpeed > 0) {
      const add = wishSpeed - (p.vx * wdx + p.vz * wdz);
      if (add > 0) {
        const before = Math.hypot(p.vx, p.vz);
        const accel = Math.min(t.groundAccel * wishSpeed * dt, add);
        p.vx += wdx * accel;
        p.vz += wdz * accel;
        const after = Math.hypot(p.vx, p.vz);
        const limit = Math.max(before, wishSpeed);
        if (after > limit) {
          p.vx *= limit / after;
          p.vz *= limit / after;
        }
      }
    }

    // Move along the surface underneath, at the same speed as on flat ground.
    const ground = this.ground;
    ground.x = p.groundNx;
    ground.y = p.groundNy;
    ground.z = p.groundNz;
    const vel = this.vel;
    const flatSpeed = Math.hypot(p.vx, p.vz);
    const into = p.vx * ground.x + p.vz * ground.z;
    vel.x = p.vx - ground.x * into;
    vel.y = -ground.y * into;
    vel.z = p.vz - ground.z * into;
    const alongSurface = Math.hypot(vel.x, vel.y, vel.z);
    if (alongSurface > 1e-9) {
      const k = flatSpeed / alongSurface;
      vel.x *= k;
      vel.y *= k;
      vel.z *= k;
    }

    const motor = this.motor;
    const shape = motor.shapeFor(p.crouched);
    const center = this.toCenter(p);
    let stepDelta = 0;
    if (flatSpeed > 1e-9) {
      stepDelta += motor.stepSlideMove(shape, center, vel, dt, ground, walkableNy, t.stepHeight);
    }
    // Stay on stairs and down slopes instead of skipping off them.
    stepDelta += motor.snapToGround(shape, center, t.stepHeight, walkableNy);
    this.fromCenter(p, center);
    p.stepDelta = stepDelta;

    // Back to a horizontal velocity that keeps the along-surface speed.
    const horizontal = Math.hypot(vel.x, vel.z);
    if (horizontal > 1e-9) {
      const k = Math.hypot(vel.x, vel.y, vel.z) / horizontal;
      p.vx = vel.x * k;
      p.vz = vel.z * k;
    } else {
      p.vx = 0;
      p.vz = 0;
    }

    if (this.probeGround(p, walkableNy)) {
      p.vy = 0;
      p.airTime = 0;
    } else {
      // Walked off a ledge: keep the vertical part of the surface motion.
      p.onGround = false;
      p.vy = vel.y;
      p.airTime = 0;
    }
  }

  private airMove(
    p: Player,
    t: MovementTuning,
    wdx: number,
    wdz: number,
    wishAmount: number,
    walkableNy: number,
    dt: number,
  ): void {
    // Air control: steer toward the input at a limited rate. The target speed is the current
    // speed (or a small drift from standstill), so the speed can never grow past takeoff speed.
    if (wishAmount > 0) {
      const target = Math.max(Math.hypot(p.vx, p.vz), t.airDriftSpeed * wishAmount);
      const dx = wdx * target - p.vx;
      const dz = wdz * target - p.vz;
      const d = Math.hypot(dx, dz);
      const maxDelta = t.airAccel * dt;
      const k = d <= maxDelta ? 1 : maxDelta / d;
      p.vx += dx * k;
      p.vz += dz * k;
    }

    // Gravity in two halves around the move, so jump arcs are exact at tick boundaries.
    const halfGravity = t.gravity * dt * 0.5;
    p.vy = Math.max(p.vy - halfGravity, -t.maxFallSpeed);
    const vel = this.vel;
    vel.x = p.vx;
    vel.y = p.vy;
    vel.z = p.vz;
    const impact = Math.max(-vel.y, 0);
    const center = this.toCenter(p);
    this.motor.slideMove(this.motor.shapeFor(p.crouched), center, vel, dt, null, walkableNy);
    this.fromCenter(p, center);
    p.vx = vel.x;
    p.vz = vel.z;
    p.vy = Math.max(vel.y - halfGravity, -t.maxFallSpeed);
    p.airTime += dt;

    if (p.vy <= 0 && this.probeGround(p, walkableNy)) this.land(p, t, impact);
  }

  private land(p: Player, t: MovementTuning, impact: number): void {
    p.onGround = true;
    p.jumping = false;
    p.airTime = 0;
    p.vy = 0;
    p.landedImpact = Math.max(impact, 1e-3);
    const span = t.landingHardImpact - t.landingSoftImpact;
    const strength =
      span > 0
        ? clamp((impact - t.landingSoftImpact) / span, 0, 1)
        : impact >= t.landingHardImpact
          ? 1
          : 0;
    if (strength > 0) {
      const factor = lerp(1, t.landingSpeedFactor, strength);
      p.vx *= factor;
      p.vz *= factor;
      p.landingFactor = Math.min(p.landingFactor, factor);
    }
  }

  /** Probes for walkable ground; updates onGround and the ground normal. */
  private probeGround(p: Player, walkableNy: number): boolean {
    const motor = this.motor;
    const center = this.toCenter(p);
    const settle = motor.probeGround(motor.shapeFor(p.crouched), center);
    if (settle === Infinity || motor.hitNy < walkableNy) return false;
    // Rest exactly one skin gap above the ground.
    p.y -= settle;
    p.onGround = true;
    // Prefer the face straight below: the contact normal tilts at ledge rims.
    const face = this.face;
    if (motor.groundFaceNormal(p.x, p.y, p.z, walkableNy, face)) {
      p.groundNx = face.x;
      p.groundNy = face.y;
      p.groundNz = face.z;
    } else {
      p.groundNx = motor.hitNx;
      p.groundNy = motor.hitNy;
      p.groundNz = motor.hitNz;
    }
    return true;
  }

  private updateStance(p: Player, wantCrouch: boolean): void {
    if (wantCrouch === p.crouched) return;
    const dh = this.body.standHeight - this.body.crouchHeight;
    if (wantCrouch) {
      if (!p.onGround) {
        // Tuck the feet up; the head stays put. The crouched body lies inside the standing one.
        p.y += dh;
        p.eyeHeight -= dh;
      }
      p.crouched = true;
    } else if (!p.onGround && this.fitsAt(p.x, p.y - dh, p.z, false)) {
      // In the air, extend the legs back down first.
      p.y -= dh;
      p.eyeHeight += dh;
      p.crouched = false;
    } else if (this.fitsAt(p.x, p.y, p.z, false)) {
      p.crouched = false;
    }
    p.eyeHeight = clamp(p.eyeHeight, this.body.crouchEyeHeight, this.body.standEyeHeight);
  }

  private updateEyeHeight(p: Player, t: MovementTuning, dt: number): void {
    const body = this.body;
    const target = p.crouched ? body.crouchEyeHeight : body.standEyeHeight;
    const rate = (body.standEyeHeight - body.crouchEyeHeight) / Math.max(t.crouchTime, 1e-3);
    const maxStep = rate * dt;
    p.eyeHeight += clamp(target - p.eyeHeight, -maxStep, maxStep);
  }

  private toCenter(p: Player): Vec3 {
    const c = this.center;
    c.x = p.x;
    c.y = p.y + this.centerOffset(p.crouched);
    c.z = p.z;
    return c;
  }

  private fromCenter(p: Player, c: Vec3): void {
    p.x = c.x;
    p.y = c.y - this.centerOffset(p.crouched);
    p.z = c.z;
  }
}
