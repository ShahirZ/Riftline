import { DT } from '../core/constants';
import type { Rng } from '../core/rng';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

/** Relay spin speed in radians per second. */
const RELAY_SPIN = 0.9;
/** Drone path: an ellipse around the diorama. */
const DRONE_CENTER_X = 0;
const DRONE_CENTER_Z = -2.5;
const DRONE_RADIUS_X = 8;
const DRONE_RADIUS_Z = 6.5;
const DRONE_ORBIT_SPEED = 0.32;
const DRONE_HOVER = 1.4;
/** Critically damped spring stiffness for the hover height. */
const DRONE_SPRING = 6;
const PROBE_TOP = 12;

/**
 * STUB(M1): placeholder simulation content, removed when the Foundry blockout lands.
 *
 * It shows the pipeline working end to end: fixed-tick state with previous/current values for
 * interpolation, seeded RNG, and Rapier raycasts (the drone holds a hover height over whatever
 * geometry is below it).
 */
export class Showcase {
  relayAngle = 0;
  prevRelayAngle = 0;

  droneX = 0;
  droneY = 0;
  droneZ = 0;
  prevDroneX = 0;
  prevDroneY = 0;
  prevDroneZ = 0;
  droneHeading = 0;
  prevDroneHeading = 0;
  private droneVelY = 0;
  private dronePhase: number;

  constructor(
    private readonly physics: PhysicsWorld,
    rng: Rng,
  ) {
    this.dronePhase = rng.range(0, Math.PI * 2);
    this.placeDrone();
    this.droneY = this.targetHeight();
    this.storePrevious();
  }

  step(): void {
    this.storePrevious();
    this.relayAngle += RELAY_SPIN * DT;
    this.dronePhase += DRONE_ORBIT_SPEED * DT;
    this.placeDrone();

    // Semi-implicit critically damped spring toward the hover height.
    const target = this.targetHeight();
    const accel =
      DRONE_SPRING * DRONE_SPRING * (target - this.droneY) - 2 * DRONE_SPRING * this.droneVelY;
    this.droneVelY += accel * DT;
    this.droneY += this.droneVelY * DT;
  }

  private placeDrone(): void {
    const p = this.dronePhase;
    this.droneX = DRONE_CENTER_X + Math.cos(p) * DRONE_RADIUS_X;
    this.droneZ = DRONE_CENTER_Z + Math.sin(p) * DRONE_RADIUS_Z;
    // Face along the path tangent.
    this.droneHeading = Math.atan2(-Math.sin(p) * DRONE_RADIUS_X, Math.cos(p) * DRONE_RADIUS_Z);
  }

  private targetHeight(): number {
    const ground = this.physics.groundHeight(this.droneX, this.droneZ, PROBE_TOP);
    return (ground === -Infinity ? 0 : ground) + DRONE_HOVER;
  }

  private storePrevious(): void {
    this.prevRelayAngle = this.relayAngle;
    this.prevDroneX = this.droneX;
    this.prevDroneY = this.droneY;
    this.prevDroneZ = this.droneZ;
    this.prevDroneHeading = this.droneHeading;
  }
}
