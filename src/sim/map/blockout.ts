import type {
  MapDef,
  RampRise,
  RegionDef,
  SolidDef,
  SpawnPoint,
  SurfaceMaterial,
  Vec2Tuple,
} from './MapDef';

/** A walkable floor area carved out of the solid mass. Coordinates are whole meters. */
export interface AreaDef {
  /** Callout name. Several areas may share one name (an L-shaped room is two areas). */
  readonly name: string;
  readonly min: Vec2Tuple;
  readonly max: Vec2Tuple;
}

/**
 * Blockout authoring format: the map is solid mass with walkable areas carved out of it on a 1 m
 * grid, plus extra solids placed on top (platforms, ramps, stairs, cover, roofs). It reads like a
 * floor plan, so layout changes are quick; the builder merges the remaining mass into a small
 * number of wall boxes.
 */
export interface BlockoutDef {
  readonly id: string;
  readonly name: string;
  /** Footprint of the map, [x, z], whole meters. Everything outside the areas is solid. */
  readonly min: Vec2Tuple;
  readonly max: Vec2Tuple;
  /** Height of the solid mass between areas, m. Taller than any jump can see over. */
  readonly wallHeight: number;
  /** Top of the playable volume, m. */
  readonly ceiling: number;
  readonly wallMaterial: SurfaceMaterial;
  readonly floorMaterial: SurfaceMaterial;
  readonly areas: readonly AreaDef[];
  readonly solids: readonly SolidDef[];
  readonly spawns: MapDef['spawns'];
}

/** Thickness of the ground slab under the floor, m. */
const GROUND_DEPTH = 1;

/** Turns a blockout into a MapDef: ground slab, merged wall boxes, extra solids, regions. */
export function buildBlockout(def: BlockoutDef): MapDef {
  const [x0, z0] = def.min;
  const [x1, z1] = def.max;
  assertWhole(`${def.id} footprint`, [x0, z0, x1, z1]);
  const width = x1 - x0;
  const depth = z1 - z0;
  const solid = new Uint8Array(width * depth).fill(1);

  for (const area of def.areas) {
    assertWhole(`area "${area.name}"`, [area.min[0], area.min[1], area.max[0], area.max[1]]);
    for (let z = Math.max(area.min[1], z0); z < Math.min(area.max[1], z1); z++) {
      for (let x = Math.max(area.min[0], x0); x < Math.min(area.max[0], x1); x++) {
        solid[(z - z0) * width + (x - x0)] = 0;
      }
    }
  }

  const solids: SolidDef[] = [
    {
      kind: 'box',
      min: [x0, -GROUND_DEPTH, z0],
      max: [x1, 0, z1],
      material: def.floorMaterial,
    },
  ];
  for (const rect of mergeCells(solid, width, depth)) {
    solids.push({
      kind: 'box',
      min: [x0 + rect.x, 0, z0 + rect.z],
      max: [x0 + rect.x + rect.w, def.wallHeight, z0 + rect.z + rect.d],
      material: def.wallMaterial,
    });
  }
  solids.push(...def.solids);

  const regions: RegionDef[] = def.areas.map((a) => ({ name: a.name, min: a.min, max: a.max }));
  return {
    id: def.id,
    name: def.name,
    bounds: { min: [x0, -GROUND_DEPTH, z0], max: [x1, def.ceiling, z1] },
    solids,
    spawns: def.spawns,
    regions,
  };
}

export interface CellRect {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
}

/**
 * Greedy rectangle merge: covers every set cell of a width × depth grid with as few axis-aligned
 * rectangles as a row-major sweep finds. Exported for tests.
 */
export function mergeCells(cells: Uint8Array, width: number, depth: number): CellRect[] {
  const used = new Uint8Array(cells.length);
  const rects: CellRect[] = [];
  const open = (x: number, z: number): boolean =>
    cells[z * width + x] === 1 && used[z * width + x] === 0;
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      if (!open(x, z)) continue;
      let w = 1;
      while (x + w < width && open(x + w, z)) w++;
      let d = 1;
      grow: while (z + d < depth) {
        for (let i = 0; i < w; i++) if (!open(x + i, z + d)) break grow;
        d++;
      }
      for (let dz = 0; dz < d; dz++) used.fill(1, (z + dz) * width + x, (z + dz) * width + x + w);
      rects.push({ x, z, w, d });
    }
  }
  return rects;
}

function assertWhole(label: string, values: readonly number[]): void {
  for (const v of values) {
    if (!Number.isInteger(v)) throw new Error(`${label}: coordinates must be whole meters`);
  }
}

// Helpers for writing blockout solids compactly in map data.

/** An axis-aligned box from (x0, y0, z0) to (x1, y1, z1). */
export function box(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  material: SurfaceMaterial = 'concrete',
): SolidDef {
  return { kind: 'box', min: [x0, y0, z0], max: [x1, y1, z1], material };
}

/** A ramp filling [x0..x1] × [z0..z1], rising from y0 to y1 toward `rise`. */
export function ramp(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y0: number,
  y1: number,
  rise: RampRise,
  material: SurfaceMaterial = 'grate',
): SolidDef {
  return { kind: 'ramp', min: [x0, y0, z0], max: [x1, y1, z1], rise, material };
}

/**
 * A straight staircase of `steps` solid steps filling [x0..x1] × [z0..z1], climbing from `y0`
 * to `y1` toward `rise`. Each step is a box from y0 up to its tread height.
 */
export function stairs(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y0: number,
  y1: number,
  steps: number,
  rise: RampRise,
  material: SurfaceMaterial = 'metal',
): SolidDef[] {
  const out: SolidDef[] = [];
  const alongX = rise === '+x' || rise === '-x';
  const run = alongX ? x1 - x0 : z1 - z0;
  const tread = run / steps;
  for (let i = 0; i < steps; i++) {
    const top = y0 + ((y1 - y0) * (i + 1)) / steps;
    // Step i sits i treads from the low end.
    const a = i * tread;
    const b = (i + 1) * tread;
    let sx0 = x0;
    let sx1 = x1;
    let sz0 = z0;
    let sz1 = z1;
    if (rise === '+x') [sx0, sx1] = [x0 + a, x0 + b];
    else if (rise === '-x') [sx0, sx1] = [x1 - b, x1 - a];
    else if (rise === '+z') [sz0, sz1] = [z0 + a, z0 + b];
    else [sz0, sz1] = [z1 - b, z1 - a];
    out.push({ kind: 'box', min: [sx0, y0, sz0], max: [sx1, top, sz1], material });
  }
  return out;
}

/** A spawn point; `yawDeg` 0 faces north (-Z), 90 west, 180 south, -90 east. */
export function spawn(x: number, z: number, yawDeg: number, y = 0): SpawnPoint {
  return { position: [x, y, z], yaw: (yawDeg * Math.PI) / 180 };
}
