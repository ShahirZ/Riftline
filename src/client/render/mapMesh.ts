import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { clamp, lerp } from '../../sim/core/math';
import { hashString } from '../../sim/core/rng';
import { rampCorners } from '../../sim/map/geometry';
import type { MapDef, RampRise, SolidDef } from '../../sim/map/MapDef';
import { SURFACES } from './palette';

export interface MapGeometry {
  /** Lit, shadowed surfaces. */
  readonly lit: BufferGeometry;
  /** Self-lit signage and team markers (unlit, never shadowed). */
  readonly glow: BufferGeometry;
}

export interface MapGeometryOptions {
  /** Faces at or below this height facing straight down are never visible and are skipped. */
  readonly hiddenBelowY?: number;
}

/** Vertex-color darkening at the foot of a solid, a cheap stand-in for ambient occlusion. */
const AO_FLOOR = 0.74;
/** Height over which the AO gradient fades out. */
const AO_HEIGHT = 2.2;
/** Per-solid brightness variation so stacked crates and wall segments read as separate pieces. */
const TINT_VARIATION = 0.09;

class Builder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly colors: number[] = [];

  toGeometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.normals, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    g.computeBoundingSphere();
    return g;
  }
}

/** Builds the merged static geometry for a map: one draw call per surface class. */
export function buildMapGeometry(map: MapDef, options: MapGeometryOptions = {}): MapGeometry {
  const hiddenBelowY = options.hiddenBelowY ?? 0;
  const lit = new Builder();
  const glow = new Builder();
  const corners = new Float32Array(24);
  const base = new Color();

  map.solids.forEach((solid, index) => {
    const look = SURFACES[solid.material];
    const target = look.glow > 0 ? glow : lit;
    const tint = 1 + (hashString(`${map.id}:${index}`) / 0xffffffff - 0.5) * TINT_VARIATION;
    base.setHex(look.color).multiplyScalar(tint * (1 + look.glow));
    const useAo = look.glow === 0;

    const n = solidCorners(solid, corners);
    const faces = solid.kind === 'box' ? BOX_FACES : rampFaces(solid.rise);
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let i = 0; i < n; i++) {
      cx += corners[i * 3] ?? 0;
      cy += corners[i * 3 + 1] ?? 0;
      cz += corners[i * 3 + 2] ?? 0;
    }
    cx /= n;
    cy /= n;
    cz /= n;

    for (const face of faces) {
      for (let t = 1; t + 1 < face.length; t++) {
        emitTriangle(
          target,
          corners,
          face[0] ?? 0,
          face[t] ?? 0,
          face[t + 1] ?? 0,
          cx,
          cy,
          cz,
          base,
          solid.min[1],
          useAo,
          hiddenBelowY,
        );
      }
    }
  });

  return { lit: lit.toGeometry(), glow: glow.toGeometry() };
}

/** Writes a solid's corners into `out` and returns how many there are. */
function solidCorners(solid: SolidDef, out: Float32Array): number {
  if (solid.kind === 'ramp') {
    rampCorners(solid, out);
    return 6;
  }
  const [x0, y0, z0] = solid.min;
  const [x1, y1, z1] = solid.max;
  out.set([x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], 0);
  out.set([x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1], 12);
  return 8;
}

/** Box faces as cyclic corner indices (bottom 0-3, top 4-7). Winding is fixed up per triangle. */
const BOX_FACES: readonly (readonly number[])[] = [
  [0, 1, 2, 3], // bottom
  [4, 5, 6, 7], // top
  [0, 1, 5, 4], // -z
  [3, 2, 6, 7], // +z
  [0, 3, 7, 4], // -x
  [1, 2, 6, 5], // +x
];

/**
 * Ramp faces as cyclic corner indices into rampCorners() output. For each rise direction:
 * low/high are the bottom corners on the low and high sides, at ends A and B; corners 4 and 5 are
 * the top edge above highA and highB.
 */
function rampFaces(rise: RampRise): readonly (readonly number[])[] {
  const [lowA, lowB, highA, highB] = RAMP_SIDES[rise];
  return [
    [0, 1, 2, 3], // bottom
    [lowA, lowB, 5, 4], // slope
    [highA, highB, 5, 4], // tall side
    [lowA, highA, 4], // end A
    [lowB, highB, 5], // end B
  ];
}

const RAMP_SIDES: Record<RampRise, readonly [number, number, number, number]> = {
  '+x': [0, 3, 1, 2],
  '-x': [1, 2, 0, 3],
  '+z': [0, 1, 3, 2],
  '-z': [3, 2, 0, 1],
};

const scratchColor = new Color();

function emitTriangle(
  out: Builder,
  c: Float32Array,
  ia: number,
  ib: number,
  ic: number,
  cx: number,
  cy: number,
  cz: number,
  color: Color,
  baseY: number,
  useAo: boolean,
  hiddenBelowY: number,
): void {
  const ax = c[ia * 3] ?? 0;
  const ay = c[ia * 3 + 1] ?? 0;
  const az = c[ia * 3 + 2] ?? 0;
  let bx = c[ib * 3] ?? 0;
  let by = c[ib * 3 + 1] ?? 0;
  let bz = c[ib * 3 + 2] ?? 0;
  let qx = c[ic * 3] ?? 0;
  let qy = c[ic * 3 + 1] ?? 0;
  let qz = c[ic * 3 + 2] ?? 0;

  let nx = (by - ay) * (qz - az) - (bz - az) * (qy - ay);
  let ny = (bz - az) * (qx - ax) - (bx - ax) * (qz - az);
  let nz = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-9) return;
  nx /= len;
  ny /= len;
  nz /= len;

  // Make the triangle face away from the solid's center (all solids are convex).
  const dx = (ax + bx + qx) / 3 - cx;
  const dy = (ay + by + qy) / 3 - cy;
  const dz = (az + bz + qz) / 3 - cz;
  if (nx * dx + ny * dy + nz * dz < 0) {
    [bx, qx] = [qx, bx];
    [by, qy] = [qy, by];
    [bz, qz] = [qz, bz];
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }

  // Downward faces resting on the ground can never be seen.
  if (ny < -0.99 && ay <= hiddenBelowY + 1e-4) return;

  // The AO gradient only reads correctly on walls; floors and slopes stay evenly lit.
  const ao = useAo && Math.abs(ny) < 0.5;
  pushVertex(out, ax, ay, az, nx, ny, nz, color, baseY, ao);
  pushVertex(out, bx, by, bz, nx, ny, nz, color, baseY, ao);
  pushVertex(out, qx, qy, qz, nx, ny, nz, color, baseY, ao);
}

function pushVertex(
  out: Builder,
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  color: Color,
  baseY: number,
  useAo: boolean,
): void {
  out.positions.push(x, y, z);
  out.normals.push(nx, ny, nz);
  const ao = useAo ? lerp(AO_FLOOR, 1, clamp((y - baseY) / AO_HEIGHT, 0, 1)) : 1;
  scratchColor.copy(color).multiplyScalar(ao);
  out.colors.push(scratchColor.r, scratchColor.g, scratchColor.b);
}
