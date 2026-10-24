import { rampSlope } from './geometry';
import type { MapDef, Vec3Tuple } from './MapDef';

/** Smallest extent a solid may have on any axis, in meters. */
const MIN_EXTENT = 0.01;

/** Steepest ramp we allow in data. Movement tuning decides what is actually walkable. */
const MAX_RAMP_SLOPE_DEG = 50;

function isFiniteVec(v: Vec3Tuple): boolean {
  return Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);
}

/**
 * Checks a map definition for authoring mistakes. Returns a list of human-readable problems;
 * an empty list means the map is valid. Run by tests for every shipped map.
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
      const slopeDeg = (rampSlope(solid) * 180) / Math.PI;
      if (slopeDeg > MAX_RAMP_SLOPE_DEG) {
        problems.push(`${label}: slope ${slopeDeg.toFixed(1)}° exceeds ${MAX_RAMP_SLOPE_DEG}°`);
      }
    }
  });

  return problems;
}
