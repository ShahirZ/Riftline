import RAPIER from '@dimforge/rapier3d-compat';
import { rampCorners } from '../map/geometry';
import type { MapDef, SolidDef } from '../map/MapDef';

let initPromise: Promise<void> | null = null;

/** Loads the Rapier WASM module. Must resolve before any PhysicsWorld is created. Idempotent. */
export function initPhysics(): Promise<void> {
  initPromise ??= RAPIER.init();
  return initPromise;
}

export function physicsVersion(): string {
  return RAPIER.version();
}

/**
 * Largest collider extent along any axis, m. Rapier's shape casts lose precision near the middle of
 * very large boxes (casts against a 100 m floor slab were off by a centimeter or missed outright),
 * so bigger map boxes are split into pieces no larger than this. Rendering is unaffected.
 */
export const MAX_COLLIDER_EXTENT = 8;

/**
 * The sim's collision world: the static map geometry that movement and (later) shots query.
 *
 * Rapier gotcha: scene queries (raycasts, shape casts) only see colliders after the broad phase has
 * been updated, which happens in `world.step()`. `syncQueries()` must run after adding or moving
 * colliders.
 */
export class PhysicsWorld {
  readonly world: RAPIER.World;
  private readonly ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  private readonly cornerScratch = new Float32Array(18);

  constructor(map: MapDef) {
    // Gravity is applied by our own movement code, not by Rapier.
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    for (const solid of map.solids) this.addSolid(solid);
    this.syncQueries();
  }

  /** Updates the broad phase so scene queries see the current colliders. */
  syncQueries(): void {
    this.world.step();
  }

  /**
   * Casts a ray and returns the distance to the first solid hit, or Infinity.
   * `dx, dy, dz` must be normalized.
   */
  castRay(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDistance: number,
  ): number {
    const ray = this.ray;
    ray.origin.x = ox;
    ray.origin.y = oy;
    ray.origin.z = oz;
    ray.dir.x = dx;
    ray.dir.y = dy;
    ray.dir.z = dz;
    const hit = this.world.castRay(ray, maxDistance, true);
    return hit ? hit.timeOfImpact : Infinity;
  }

  /** Height of the highest solid surface below (x, fromY, z), or -Infinity if there is none. */
  groundHeight(x: number, z: number, fromY: number, maxDistance = 64): number {
    const d = this.castRay(x, fromY, z, 0, -1, 0, maxDistance);
    return d === Infinity ? -Infinity : fromY - d;
  }

  dispose(): void {
    this.world.free();
  }

  private addSolid(solid: SolidDef): void {
    const [x0, y0, z0] = solid.min;
    const [x1, y1, z1] = solid.max;
    if (solid.kind === 'box') {
      // Split into equal pieces no larger than MAX_COLLIDER_EXTENT on any axis.
      const nx = Math.ceil((x1 - x0) / MAX_COLLIDER_EXTENT - 1e-9);
      const ny = Math.ceil((y1 - y0) / MAX_COLLIDER_EXTENT - 1e-9);
      const nz = Math.ceil((z1 - z0) / MAX_COLLIDER_EXTENT - 1e-9);
      const sx = (x1 - x0) / nx;
      const sy = (y1 - y0) / ny;
      const sz = (z1 - z0) / nz;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          for (let k = 0; k < nz; k++) {
            const desc = RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2);
            desc.setTranslation(x0 + sx * (i + 0.5), y0 + sy * (j + 0.5), z0 + sz * (k + 0.5));
            this.world.createCollider(desc);
          }
        }
      }
      return;
    }
    const desc = RAPIER.ColliderDesc.convexHull(rampCorners(solid, this.cornerScratch));
    if (!desc) throw new Error(`Degenerate ramp collider at ${solid.min.join(',')}`);
    this.world.createCollider(desc);
  }
}
