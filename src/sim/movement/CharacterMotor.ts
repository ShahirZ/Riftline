import RAPIER from '@dimforge/rapier3d-compat';
import type { PlayerBody } from './MovementTuning';

/**
 * Gap the body keeps from the world, m. It rests this far above the floor and stops this far from
 * walls (measured along the surface normal).
 */
export const SKIN = 0.015;
/**
 * Casts report contact when the gap would drop below this, m. Rapier's shape casts report false
 * contacts when a face slides along another within about 2 mm (worse near flat-on-flat), so the
 * body is never allowed closer than this.
 */
const CONTACT_GAP = SKIN / 2;
/** How much farther from a cast's contact point the body stops, along the normal, m. */
const STANDOFF = SKIN - CONTACT_GAP;
/** Rounding of the body's rims, m: flat enough to stand on ledges, round enough for clean casts. */
const RIM = 0.02;
/** How far beyond the skin the ground probe looks for ground, m. */
const GROUND_PROBE = 0.05;
/** Collision iterations per slide move. */
const MAX_BUMPS = 4;
/** Contact planes remembered per slide move (ground + velocity + hits). */
const MAX_PLANES = 6;
/** Clipped velocities point very slightly away from the plane so they never re-enter it. */
const OVERCLIP = 1.001;
/** A velocity component into a plane smaller than this (m/s) does not count as moving into it. */
const INTO_EPSILON = 1e-4;
/** A hit whose normal is this close to perpendicular to the motion is a graze, not a block. */
const GRAZE = 1e-3;
/** How far a graze steps away from the surface, m. */
const GRAZE_CLEARANCE = 0.001;
/** Overlap tests use a body this much smaller on every side, so resting contacts never count. */
const FIT_TOLERANCE = 0.005;
/** Penetration shallower than this is left alone, m. */
const PENETRATION_EPSILON = 1e-4;
/** Most colliders a single overlap query collects. */
const MAX_OVERLAPS = 8;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const IDENTITY_ROTATION = { x: 0, y: 0, z: 0, w: 1 };

/**
 * Kinematic character collision on top of Rapier scene queries: collide-and-slide, automatic
 * step-up, ground snapping, ground probing and overlap tests for an upright body.
 *
 * Why not Rapier's built-in KinematicCharacterController: its slide loop projects onto one contact
 * plane at a time, so running diagonally along a wall while touching the floor (a crease) loses all
 * movement for a tick every second or two, which reads as a stutter. This motor clips against all
 * contact planes at once and slides along creases (the classic Quake approach).
 *
 * The body keeps a skin gap from everything and stops short of obstacles instead of touching and
 * being pushed back out, so it never creeps into contact range, never jitters against walls, and
 * every cast starts cleanly outside geometry.
 *
 * The body is an upright cylinder with slightly rounded rims rather than a capsule: its flat base
 * lands on step tops and stands on ledge edges like a box hull, where a capsule's round bottom
 * would balance on the edge and slide off.
 *
 * Positions passed in and out are body centers. Speeds are m/s. Rapier's query wrappers allocate
 * small result objects internally; the number of queries per call is bounded.
 */
export class CharacterMotor {
  /** Statistics for the debug overlay and tests. */
  casts = 0;
  depenetrations = 0;

  // Contact normal of the last cast that hit.
  hitNx = 0;
  hitNy = 0;
  hitNz = 0;
  /** Set by slideMove(): it hit something that is not walkable ground. */
  hitWall = false;

  readonly standShape: RAPIER.RoundCylinder;
  readonly crouchShape: RAPIER.RoundCylinder;
  private readonly standFitShape: RAPIER.RoundCylinder;
  private readonly crouchFitShape: RAPIER.RoundCylinder;
  private readonly world: RAPIER.World;
  private readonly castPos = { x: 0, y: 0, z: 0 };
  private readonly castDir = { x: 0, y: 0, z: 0 };
  private readonly ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  private readonly planes = new Float64Array(MAX_PLANES * 3);
  private readonly start = { x: 0, y: 0, z: 0 };
  private readonly startVel = { x: 0, y: 0, z: 0 };
  private readonly flatPos = { x: 0, y: 0, z: 0 };
  private readonly flatVel = { x: 0, y: 0, z: 0 };
  private readonly stepPos = { x: 0, y: 0, z: 0 };
  private readonly stepVel = { x: 0, y: 0, z: 0 };
  private readonly overlaps: RAPIER.Collider[] = [];
  private readonly contact = new RAPIER.ShapeContact(
    0,
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  );
  private readonly filterFlags = RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;

  constructor(
    world: RAPIER.World,
    readonly body: PlayerBody,
  ) {
    this.world = world;
    this.standShape = bodyShape(body.standHeight, body.radius, 0);
    this.crouchShape = bodyShape(body.crouchHeight, body.radius, 0);
    this.standFitShape = bodyShape(body.standHeight, body.radius, FIT_TOLERANCE);
    this.crouchFitShape = bodyShape(body.crouchHeight, body.radius, FIT_TOLERANCE);
  }

  shapeFor(crouched: boolean): RAPIER.RoundCylinder {
    return crouched ? this.crouchShape : this.standShape;
  }

  /**
   * Casts `shape` from `p` along the unit direction (dx, dy, dz) for at most `maxDist`. Returns
   * the distance it can travel before its gap to an obstacle would fall below CONTACT_GAP, or
   * Infinity. The contact normal (pointing away from the obstacle) is left in hitN*.
   */
  cast(shape: RAPIER.Shape, p: Vec3, dx: number, dy: number, dz: number, maxDist: number): number {
    this.casts++;
    const pos = this.castPos;
    pos.x = p.x;
    pos.y = p.y;
    pos.z = p.z;
    const dir = this.castDir;
    dir.x = dx;
    dir.y = dy;
    dir.z = dz;
    const hit = this.world.castShape(
      pos,
      IDENTITY_ROTATION,
      dir,
      shape,
      CONTACT_GAP,
      maxDist,
      false,
      this.filterFlags,
    );
    if (!hit) return Infinity;
    this.hitNx = hit.normal1.x;
    this.hitNy = hit.normal1.y;
    this.hitNz = hit.normal1.z;
    return hit.time_of_impact;
  }

  /**
   * Moves the body at `pos` by `vel * dt`, sliding along everything it touches. `vel` is
   * clipped in place so it no longer points into anything that was hit. `ground` (a walkable
   * surface normal) keeps the motion from digging into the floor. On the ground, unwalkable
   * surfaces are treated as vertical walls so steep slopes cannot be climbed by running at them.
   * Returns true if anything was hit; hitWall reports whether any hit was a wall.
   */
  slideMove(
    shape: RAPIER.Shape,
    pos: Vec3,
    vel: Vec3,
    dt: number,
    ground: Vec3 | null,
    walkableNy: number,
  ): boolean {
    const planes = this.planes;
    let numPlanes = 0;
    this.hitWall = false;
    if (ground) {
      planes[0] = ground.x;
      planes[1] = ground.y;
      planes[2] = ground.z;
      numPlanes = 1;
    }
    const speed = Math.hypot(vel.x, vel.y, vel.z);
    if (speed < 1e-9) return false;
    // Never let a clip turn the motion back against its original direction.
    planes[numPlanes * 3] = vel.x / speed;
    planes[numPlanes * 3 + 1] = vel.y / speed;
    planes[numPlanes * 3 + 2] = vel.z / speed;
    numPlanes++;

    let timeLeft = dt;
    let hitAny = false;
    for (let bump = 0; bump < MAX_BUMPS; bump++) {
      const mx = vel.x * timeLeft;
      const my = vel.y * timeLeft;
      const mz = vel.z * timeLeft;
      const dist = Math.hypot(mx, my, mz);
      if (dist < 1e-7) break;
      const dx = mx / dist;
      const dy = my / dist;
      const dz = mz / dist;
      // Look a little past the move, so an obstacle just beyond it still holds the body at SKIN.
      const toi = this.cast(shape, pos, dx, dy, dz, dist + STANDOFF);
      if (toi === Infinity) {
        pos.x += mx;
        pos.y += my;
        pos.z += mz;
        break;
      }
      hitAny = true;
      let nx = this.hitNx;
      let ny = this.hitNy;
      let nz = this.hitNz;
      const approach = -(dx * nx + dy * ny + dz * nz);
      if (approach < GRAZE) {
        // Contact reported while moving along or away from the surface: not an obstacle.
        // Step clear of it and carry on with the same velocity.
        pos.x += nx * GRAZE_CLEARANCE;
        pos.y += ny * GRAZE_CLEARANCE;
        pos.z += nz * GRAZE_CLEARANCE;
        continue;
      }
      // Stop with a full skin gap to the obstacle (measured along its normal); never back up.
      const travel = Math.min(Math.max(toi - STANDOFF / approach, 0), dist);
      pos.x += dx * travel;
      pos.y += dy * travel;
      pos.z += dz * travel;
      timeLeft -= timeLeft * (travel / dist);

      if (ny < walkableNy) {
        this.hitWall = true;
        if (ground && ny > 0) {
          // Steep slope or ledge edge while walking: block like a wall instead of riding up it.
          const h = Math.hypot(nx, nz);
          if (h > 1e-6) {
            nx /= h;
            ny = 0;
            nz /= h;
          }
        }
      }

      // The same plane again: nudge outward instead of adding a duplicate (float noise).
      let duplicate = false;
      for (let i = 0; i < numPlanes; i++) {
        if (nx * planes[i * 3] + ny * planes[i * 3 + 1] + nz * planes[i * 3 + 2] > 0.99) {
          vel.x += nx * 0.01;
          vel.y += ny * 0.01;
          vel.z += nz * 0.01;
          duplicate = true;
          break;
        }
      }
      if (duplicate) continue;
      if (numPlanes >= MAX_PLANES) {
        vel.x = 0;
        vel.y = 0;
        vel.z = 0;
        return true;
      }
      planes[numPlanes * 3] = nx;
      planes[numPlanes * 3 + 1] = ny;
      planes[numPlanes * 3 + 2] = nz;
      numPlanes++;

      if (!this.clipToPlanes(vel, numPlanes)) return true;
    }
    return hitAny;
  }

  /**
   * Makes `vel` parallel to every plane it would move into: clip against one plane, and if that
   * pushes it into a second, slide along their crease; three-way contacts stop dead.
   * Returns false if the velocity was zeroed.
   */
  private clipToPlanes(vel: Vec3, numPlanes: number): boolean {
    const planes = this.planes;
    for (let i = 0; i < numPlanes; i++) {
      const ix = planes[i * 3];
      const iy = planes[i * 3 + 1];
      const iz = planes[i * 3 + 2];
      const into = vel.x * ix + vel.y * iy + vel.z * iz;
      if (into >= INTO_EPSILON) continue;

      let backoff = into < 0 ? into * OVERCLIP : into / OVERCLIP;
      let cx = vel.x - ix * backoff;
      let cy = vel.y - iy * backoff;
      let cz = vel.z - iz * backoff;

      for (let j = 0; j < numPlanes; j++) {
        if (j === i) continue;
        const jx = planes[j * 3];
        const jy = planes[j * 3 + 1];
        const jz = planes[j * 3 + 2];
        const intoJ = cx * jx + cy * jy + cz * jz;
        if (intoJ >= INTO_EPSILON) continue;
        backoff = intoJ < 0 ? intoJ * OVERCLIP : intoJ / OVERCLIP;
        cx -= jx * backoff;
        cy -= jy * backoff;
        cz -= jz * backoff;
        if (cx * ix + cy * iy + cz * iz >= 0) continue;

        // Both planes resist: slide the original velocity along their crease.
        let ex = iy * jz - iz * jy;
        let ey = iz * jx - ix * jz;
        let ez = ix * jy - iy * jx;
        const len = Math.hypot(ex, ey, ez);
        if (len < 1e-9) {
          vel.x = 0;
          vel.y = 0;
          vel.z = 0;
          return false;
        }
        ex /= len;
        ey /= len;
        ez /= len;
        const along = ex * vel.x + ey * vel.y + ez * vel.z;
        cx = ex * along;
        cy = ey * along;
        cz = ez * along;
        for (let k = 0; k < numPlanes; k++) {
          if (k === i || k === j) continue;
          const intoK = cx * planes[k * 3] + cy * planes[k * 3 + 1] + cz * planes[k * 3 + 2];
          if (intoK >= INTO_EPSILON) continue;
          vel.x = 0;
          vel.y = 0;
          vel.z = 0;
          return false;
        }
      }
      vel.x = cx;
      vel.y = cy;
      vel.z = cz;
      return true;
    }
    return true;
  }

  /**
   * Slide move that also climbs ledges up to `stepHeight` (only used while walking). When the plain
   * move is blocked by a wall, it retries from `stepHeight` higher, then lowers back onto whatever
   * is underneath; the stepped result wins only if it lands on walkable ground and gets further.
   * Returns the extra height gained by stepping (0 if none).
   */
  stepSlideMove(
    shape: RAPIER.Shape,
    pos: Vec3,
    vel: Vec3,
    dt: number,
    ground: Vec3,
    walkableNy: number,
    stepHeight: number,
  ): number {
    const start = copy(this.start, pos);
    const startVel = copy(this.startVel, vel);
    this.slideMove(shape, pos, vel, dt, ground, walkableNy);
    if (!this.hitWall || stepHeight <= 0) return 0;
    const flatPos = copy(this.flatPos, pos);
    const flatVel = copy(this.flatVel, vel);

    // Up, as far as the ceiling allows.
    const upToi = this.cast(shape, start, 0, 1, 0, stepHeight + STANDOFF);
    const up = upToi === Infinity ? stepHeight : Math.min(upToi - STANDOFF, stepHeight);
    if (up <= 0.01) return 0;

    // Across, from the raised position, moving horizontally at the same speed.
    const stepPos = copy(this.stepPos, start);
    stepPos.y += up;
    const stepVel = this.stepVel;
    const flatSpeed = Math.hypot(startVel.x, startVel.z);
    const fullSpeed = Math.hypot(startVel.x, startVel.y, startVel.z);
    const rescale = flatSpeed > 1e-9 ? fullSpeed / flatSpeed : 0;
    stepVel.x = startVel.x * rescale;
    stepVel.y = 0;
    stepVel.z = startVel.z * rescale;
    this.slideMove(shape, stepPos, stepVel, dt, null, walkableNy);

    // Down onto the step.
    const downToi = this.cast(shape, stepPos, 0, -1, 0, up + STANDOFF);
    if (downToi === Infinity || this.hitNy < walkableNy) {
      restore(pos, vel, flatPos, flatVel);
      return 0;
    }
    stepPos.y -= downToi - STANDOFF;

    const flatProgress = (flatPos.x - start.x) ** 2 + (flatPos.z - start.z) ** 2;
    const stepProgress = (stepPos.x - start.x) ** 2 + (stepPos.z - start.z) ** 2;
    if (stepProgress <= flatProgress + 1e-8) {
      restore(pos, vel, flatPos, flatVel);
      return 0;
    }
    copy(pos, stepPos);
    copy(vel, stepVel);
    return stepPos.y - flatPos.y;
  }

  /**
   * Keeps a walking character glued to the ground: drops `pos` onto walkable ground up to `maxDrop`
   * below. Returns the vertical change (negative when moving down), or 0 if there is no walkable
   * ground in reach (walking off a ledge).
   */
  snapToGround(shape: RAPIER.Shape, pos: Vec3, maxDrop: number, walkableNy: number): number {
    const toi = this.cast(shape, pos, 0, -1, 0, maxDrop + STANDOFF);
    if (toi === Infinity || this.hitNy < walkableNy) return 0;
    const drop = toi - STANDOFF;
    if (drop <= 0) return 0;
    pos.y -= drop;
    return -drop;
  }

  /**
   * Looks for ground right below the body. Returns how far the body must move down to rest exactly
   * one skin gap above it (negative: move up), or Infinity if there is no ground within the probe
   * distance. The contact normal is left in hitN* (check it against the walkable limit).
   */
  probeGround(shape: RAPIER.Shape, pos: Vec3): number {
    const toi = this.cast(shape, pos, 0, -1, 0, STANDOFF + GROUND_PROBE);
    return toi === Infinity ? Infinity : toi - STANDOFF;
  }

  /**
   * Normal of the face directly below (x, feetY, z), found with a short ray down the body's axis.
   * Unlike the probe's contact normal it is not tilted by edges, so it tells flat ground from the
   * rim of a ledge. Writes into `out` and returns true if a walkable face is there.
   */
  groundFaceNormal(x: number, feetY: number, z: number, walkableNy: number, out: Vec3): boolean {
    this.casts++;
    const ray = this.ray;
    const lift = 0.1;
    ray.origin.x = x;
    ray.origin.y = feetY + lift;
    ray.origin.z = z;
    ray.dir.x = 0;
    ray.dir.y = -1;
    ray.dir.z = 0;
    const hit = this.world.castRayAndGetNormal(ray, lift + 0.35, true, this.filterFlags);
    if (!hit || hit.normal.y < walkableNy) return false;
    out.x = hit.normal.x;
    out.y = hit.normal.y;
    out.z = hit.normal.z;
    return true;
  }

  /** True if a standing or crouched body centered at `pos` overlaps nothing. */
  fits(crouched: boolean, pos: Vec3): boolean {
    this.casts++;
    const shape = crouched ? this.crouchFitShape : this.standFitShape;
    return (
      this.world.intersectionWithShape(pos, IDENTITY_ROTATION, shape, this.filterFlags) === null
    );
  }

  /**
   * Safety net: if the body at `pos` is inside geometry (it should never be), pushes it out
   * along the contact normals. Returns true if it had to move.
   */
  depenetrate(shape: RAPIER.Shape, pos: Vec3): boolean {
    this.casts++;
    const overlaps = this.overlaps;
    overlaps.length = 0;
    this.world.intersectionsWithShape(
      pos,
      IDENTITY_ROTATION,
      shape,
      this.collectOverlap,
      this.filterFlags,
    );
    let moved = false;
    for (let i = 0; i < overlaps.length; i++) {
      const contact = overlaps[i].contactShape(shape, pos, IDENTITY_ROTATION, 0, this.contact);
      if (!contact || contact.distance > -PENETRATION_EPSILON) continue;
      const push = -contact.distance + SKIN;
      pos.x += contact.normal1.x * push;
      pos.y += contact.normal1.y * push;
      pos.z += contact.normal1.z * push;
      moved = true;
    }
    if (moved) this.depenetrations++;
    return moved;
  }

  private readonly collectOverlap = (collider: RAPIER.Collider): boolean => {
    this.overlaps.push(collider);
    return this.overlaps.length < MAX_OVERLAPS;
  };
}

/** An upright cylinder with rounded rims, `shrink` smaller than the body on every side. */
function bodyShape(height: number, radius: number, shrink: number): RAPIER.RoundCylinder {
  return new RAPIER.RoundCylinder(height / 2 - RIM - shrink, radius - RIM - shrink, RIM);
}

function copy(dst: Vec3, src: Vec3): Vec3 {
  dst.x = src.x;
  dst.y = src.y;
  dst.z = src.z;
  return dst;
}

function restore(pos: Vec3, vel: Vec3, savedPos: Vec3, savedVel: Vec3): void {
  copy(pos, savedPos);
  copy(vel, savedVel);
}
