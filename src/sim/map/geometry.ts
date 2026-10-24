import type { RampSolid } from './MapDef';

/**
 * Writes the 6 corner points of a ramp wedge into `out` as xyz triples:
 * the 4 bottom corners followed by the 2 top corners on the rising edge.
 * Shared by the physics collider (convex hull) and the render mesh so they can never disagree.
 */
export function rampCorners(ramp: RampSolid, out: Float32Array): Float32Array {
  const [x0, y0, z0] = ramp.min;
  const [x1, y1, z1] = ramp.max;
  // Bottom rectangle.
  out.set([x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], 0);
  // Top edge on the rising side.
  switch (ramp.rise) {
    case '+x':
      out.set([x1, y1, z0, x1, y1, z1], 12);
      break;
    case '-x':
      out.set([x0, y1, z0, x0, y1, z1], 12);
      break;
    case '+z':
      out.set([x0, y1, z1, x1, y1, z1], 12);
      break;
    case '-z':
      out.set([x0, y1, z0, x1, y1, z0], 12);
      break;
  }
  return out;
}

/** Slope angle of a ramp in radians (0 = flat). */
export function rampSlope(ramp: RampSolid): number {
  const height = ramp.max[1] - ramp.min[1];
  const run =
    ramp.rise === '+x' || ramp.rise === '-x'
      ? ramp.max[0] - ramp.min[0]
      : ramp.max[2] - ramp.min[2];
  return Math.atan2(height, run);
}
