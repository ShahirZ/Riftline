import { MAX_COLLIDER_EXTENT } from '../physics/PhysicsWorld';
import { rampSlope } from './geometry';
import type { MapDef, Vec2Tuple, Vec3Tuple } from './MapDef';

/** Smallest extent a solid may have on any axis, in meters. */
const MIN_EXTENT = 0.01;

/** Steepest ramp we allow in data. Movement tuning decides what is actually walkable. */
const MAX_RAMP_SLOPE_DEG = 50;

function isFiniteVec(v: Vec3Tuple): boolean {
  return Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);
}

function inside2d(p: Vec2Tuple, min: Vec3Tuple, max: Vec3Tuple): boolean {
  return p[0] >= min[0] && p[0] <= max[0] && p[1] >= min[2] && p[1] <= max[2];
}

/**
 * Checks a map definition for authoring mistakes. Returns a list of human-readable problems;
 * an empty list means the map is valid. Run by tests for every shipped map. (Whether spawns
 * stand on walkable ground is checked against physics in the map tests.)
 */
export function validateMap(map: MapDef): string[] {
  const problems: string[] = [];
  const { min: bmin, max: bmax } = map.bounds;

  if (!map.id) problems.push('map id is empty');
  if (!isFiniteVec(bmin) || !isFiniteVec(bmax)) problems.push('bounds are not finite');
  for (let axis = 0; axis < 3; axis++) {
    if ((bmax[axis] ?? 0) <= (bmin[axis] ?? 0)) problems.push(`bounds are empty on axis ${axis}`);
  }

  map.solids.forEach((solid, i) => {
    const label = `solid #${i} (${solid.kind}, ${solid.material})`;
    if (!isFiniteVec(solid.min) || !isFiniteVec(solid.max)) {
      problems.push(`${label}: corners are not finite`);
      return;
    }
    for (let axis = 0; axis < 3; axis++) {
      const lo = solid.min[axis] ?? 0;
      const hi = solid.max[axis] ?? 0;
      if (hi - lo < MIN_EXTENT) problems.push(`${label}: min must be below max on axis ${axis}`);
      if (lo < (bmin[axis] ?? 0) || hi > (bmax[axis] ?? 0)) {
        problems.push(`${label}: extends outside the map bounds on axis ${axis}`);
      }
    }
    if (solid.kind === 'ramp') {
      // Boxes are split for precise collision; ramps are not, so they must stay small.
      for (let axis = 0; axis < 3; axis++) {
        if ((solid.max[axis] ?? 0) - (solid.min[axis] ?? 0) > MAX_COLLIDER_EXTENT) {
          problems.push(`${label}: larger than ${MAX_COLLIDER_EXTENT} m on axis ${axis}; split it`);
        }
      }
      const slopeDeg = (rampSlope(solid) * 180) / Math.PI;
      if (slopeDeg > MAX_RAMP_SLOPE_DEG) {
        problems.push(`${label}: slope ${slopeDeg.toFixed(1)}° exceeds ${MAX_RAMP_SLOPE_DEG}°`);
      }
    }
  });

  for (const team of ['attacker', 'defender'] as const) {
    const spawns = map.spawns[team];
    if (spawns.length === 0) problems.push(`no ${team} spawn points`);
    spawns.forEach((spawn, i) => {
      const label = `${team} spawn #${i}`;
      if (!isFiniteVec(spawn.position) || !Number.isFinite(spawn.yaw)) {
        problems.push(`${label}: position or yaw is not finite`);
        return;
      }
      for (let axis = 0; axis < 3; axis++) {
        const v = spawn.position[axis] ?? 0;
        if (v < (bmin[axis] ?? 0) || v > (bmax[axis] ?? 0)) {
          problems.push(`${label}: outside the map bounds on axis ${axis}`);
        }
      }
    });
  }

  // Several regions may share a name: an area made of more than one rectangle.
  for (const region of map.regions) {
    if (!region.name) problems.push('a region has an empty name');
    if (region.max[0] <= region.min[0] || region.max[1] <= region.min[1]) {
      problems.push(`region "${region.name}" is empty`);
    }
    if (!inside2d(region.min, bmin, bmax) || !inside2d(region.max, bmin, bmax)) {
      problems.push(`region "${region.name}" extends outside the map bounds`);
    }
  }

  return problems;
}
