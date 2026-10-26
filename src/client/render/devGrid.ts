import type { MeshLambertMaterial } from 'three';

/** Shared uniform: 0 hides the grid, 1 shows it. */
export interface GridStrength {
  value: number;
}

/**
 * A world-space measuring grid drawn by the shader on every map surface: thin lines every meter and
 * stronger lines every 5 m, projected on the plane each face mostly faces (floors, walls and step
 * risers all show it, so heights read as well as distances). Lines are anti-aliased with screen-
 * space derivatives, and the 1 m lines fade out in the distance before they turn into moire.
 */
const GRID_GLSL = /* glsl */ `
float riftGridLines(vec2 p, float spacing, float widthPx) {
  vec2 coord = p / spacing;
  vec2 dist = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  return 1.0 - min(min(dist.x, dist.y) / widthPx, 1.0);
}

float riftDevGrid(vec3 pos, vec3 normal) {
  vec3 n = abs(normal);
  vec2 p = n.y >= max(n.x, n.z) ? pos.xz : (n.x >= n.z ? pos.zy : pos.xy);
  vec2 footprint = fwidth(p);
  float fade = 1.0 - smoothstep(0.06, 0.2, max(footprint.x, footprint.y));
  float minor = riftGridLines(p, 1.0, 1.0) * 0.16 * fade;
  float major = riftGridLines(p, 5.0, 1.5) * 0.34;
  return 1.0 - uGridStrength * max(minor, major);
}
`;

/** Adds the dev grid to a Lambert material. `strength` is shared, so one toggle drives every map. */
export function applyDevGrid(material: MeshLambertMaterial, strength: GridStrength): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms['uGridStrength'] = strength;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vGridPos;\nvarying vec3 vGridNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'vGridPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
          'vGridNormal = normalize(mat3(modelMatrix) * objectNormal);',
        ].join('\n'),
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        [
          '#include <common>',
          'uniform float uGridStrength;',
          'varying vec3 vGridPos;',
          'varying vec3 vGridNormal;',
          GRID_GLSL,
        ].join('\n'),
      )
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb *= riftDevGrid(vGridPos, vGridNormal);',
      );
  };
  material.customProgramCacheKey = () => 'riftline-dev-grid';
}
