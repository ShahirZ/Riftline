/**
 * Data format for maps. A map is plain data (see src/data/maps), built into Rapier colliders by
 * the sim and into merged meshes by the renderer, so layout edits happen in exactly one place.
 *
 * Coordinates: meters, Y up. Seen from above, +X points right (east) and +Z points down (south),
 * which matches a top-down three.js camera and the minimap.
 */

export type Vec3Tuple = readonly [x: number, y: number, z: number];

/**
 * Surface material. Drives the render palette and, in later milestones, footstep sounds and
 * bullet penetration.
 */
export type SurfaceMaterial =
  'concrete' | 'metal' | 'wood' | 'grate' | 'trim' | 'attacker' | 'defender';

/** An axis-aligned box: the workhorse for floors, walls, crates and cover. */
export interface BoxSolid {
  readonly kind: 'box';
  readonly min: Vec3Tuple;
  readonly max: Vec3Tuple;
  readonly material: SurfaceMaterial;
}

/** Direction a ramp rises toward, as seen from above. */
export type RampRise = '+x' | '-x' | '+z' | '-z';

/**
 * A wedge filling the box [min, max]: floor-level on one side, rising to max.y on the `rise` side.
 * Used for walkable slopes and stairs-free height changes.
 */
export interface RampSolid {
  readonly kind: 'ramp';
  readonly min: Vec3Tuple;
  readonly max: Vec3Tuple;
  readonly rise: RampRise;
  readonly material: SurfaceMaterial;
}

export type SolidDef = BoxSolid | RampSolid;

export interface MapDef {
  readonly id: string;
  readonly name: string;
  /** Playable volume. Every solid must fit inside it. */
  readonly bounds: { readonly min: Vec3Tuple; readonly max: Vec3Tuple };
  readonly solids: readonly SolidDef[];
}
