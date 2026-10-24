import {
  BackSide,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from 'three';
import { clamp } from '../../sim/core/math';
import { ATMOSPHERE } from './palette';

/** A procedural gradient sky dome (no textures). Follows the camera so it never clips. */
export function createSky(radius = 400): Mesh {
  const geometry = new SphereGeometry(radius, 32, 16);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const zenith = new Color(ATMOSPHERE.skyZenith);
  const horizon = new Color(ATMOSPHERE.skyHorizon);
  const ground = new Color(ATMOSPHERE.skyGround);
  const c = new Color();
  for (let i = 0; i < position.count; i++) {
    const h = position.getY(i) / radius;
    if (h >= 0) {
      // Warm band hugging the horizon, fading quickly into the dusk zenith.
      c.lerpColors(horizon, zenith, clamp(Math.pow(h, 0.45), 0, 1));
    } else {
      c.lerpColors(horizon, ground, clamp(-h * 6, 0, 1));
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const material = new MeshBasicMaterial({
    vertexColors: true,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new Mesh(geometry, material);
  sky.name = 'sky';
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}
