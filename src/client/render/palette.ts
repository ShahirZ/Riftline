import type { SurfaceMaterial } from '../../sim/map/MapDef';

/**
 * Color language. Attackers ("Ember") are warm, defenders ("Tide") are cool; the environment
 * stays neutral and low-contrast so that team colors and players always read first.
 * All values are sRGB hex.
 */
export const TEAM_COLORS = {
  attacker: 0xff6b2c,
  defender: 0x1fc8e8,
} as const;

export interface SurfaceLook {
  readonly color: number;
  /** 0 = lit normally; above 0 the surface glows (signage, team markers). */
  readonly glow: number;
}

export const SURFACES: Record<SurfaceMaterial, SurfaceLook> = {
  concrete: { color: 0x8c949e, glow: 0 },
  metal: { color: 0x5f6b78, glow: 0 },
  wood: { color: 0xb07c4c, glow: 0 },
  grate: { color: 0x4e5763, glow: 0 },
  trim: { color: 0xe4e7eb, glow: 0 },
  attacker: { color: TEAM_COLORS.attacker, glow: 0.55 },
  defender: { color: TEAM_COLORS.defender, glow: 0.55 },
};

export const ATMOSPHERE = {
  skyZenith: 0x1c2740,
  skyHorizon: 0xe9a07a,
  skyGround: 0x6d6670,
  fog: 0xc29a86,
  hemiSky: 0xb9c4d4,
  hemiGround: 0x5e5048,
  backdrop: 0x5c6068,
  sun: 0xffd9b3,
} as const;
