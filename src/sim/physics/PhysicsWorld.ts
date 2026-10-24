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
 * The sim's collision world: static map geometry today, character colliders from M1.
 *
 * Rapier gotcha: scene queries (raycasts, shape casts, the character controller) only see colliders
 * after the broad phase has been updated, which happens in `world.step()`. `syncQueries()` must run
 * after adding or moving colliders.
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
      const desc = RAPIER.ColliderDesc.cuboid((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2);
      desc.setTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      this.world.createCollider(desc);
      return;
    }
    const desc = RAPIER.ColliderDesc.convexHull(rampCorners(solid, this.cornerScratch));
    if (!desc) throw new Error(`Degenerate ramp collider at ${solid.min.join(',')}`);
    this.world.createCollider(desc);
  }
}
