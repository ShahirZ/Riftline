import {
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  REVISION,
  Scene,
  WebGLRenderer,
} from 'three';
import type { MapDef } from '../../sim/map/MapDef';
import type { Sim } from '../../sim/Sim';
import { buildMapGeometry } from './mapMesh';
import { ATMOSPHERE } from './palette';
import { ShowcaseView } from './ShowcaseView';
import { createSky } from './sky';

export interface RenderStats {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  width: number;
  height: number;
  pixelRatio: number;
}

/**
 * Owns the three.js renderer, scene and camera. Reads sim state each frame and draws it; it
 * never writes to the sim. Game state lives in src/sim; everything here is presentation.
 */
export class GameRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(60, 1, 0.1, 900);
  readonly threeRevision = REVISION;
  private readonly sky = createSky();
  private readonly sun = new DirectionalLight(ATMOSPHERE.sun, 2.4);
  private readonly showcase = new ShowcaseView();
  private mapMeshes: Mesh[] = [];

  constructor(private readonly container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.domElement.className = 'game-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene.fog = new Fog(ATMOSPHERE.fog, 40, 220);
    this.scene.add(this.sky);
    this.scene.add(new HemisphereLight(ATMOSPHERE.hemiSky, ATMOSPHERE.hemiGround, 1.3));

    // Presentation-only ground that runs out to the horizon, so the map never floats in a void.
    const backdrop = new Mesh(
      new PlaneGeometry(1200, 1200),
      new MeshLambertMaterial({ color: ATMOSPHERE.backdrop }),
    );
    backdrop.name = 'backdrop';
    backdrop.rotation.x = -Math.PI / 2;
    backdrop.position.y = -0.03;
    backdrop.receiveShadow = true;
    this.scene.add(backdrop);

    // Low dusk sun for long, readable shadows.
    this.sun.position.set(-18, 16, 10);
    this.sun.target.position.set(0, 0, -2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    const s = this.sun.shadow.camera;
    s.left = -22;
    s.right = 22;
    s.top = 22;
    s.bottom = -22;
    s.near = 1;
    s.far = 70;
    this.scene.add(this.sun, this.sun.target);

    this.scene.add(this.showcase.root);
    this.resize();
  }

  /** Builds merged static meshes for a map, replacing any previous map. */
  setMap(map: MapDef): void {
    for (const mesh of this.mapMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshLambertMaterial | MeshBasicMaterial).dispose();
    }
    const geometry = buildMapGeometry(map);
    // Lambert: the flat-shaded look needs no specular, and it is the cheapest lit material.
    const lit = new Mesh(geometry.lit, new MeshLambertMaterial({ vertexColors: true }));
    lit.castShadow = true;
    lit.receiveShadow = true;
    const glow = new Mesh(geometry.glow, new MeshBasicMaterial({ vertexColors: true }));
    lit.name = 'map-lit';
    glow.name = 'map-glow';
    this.mapMeshes = [lit, glow];
    this.scene.add(lit, glow);
  }

  resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /**
   * Draws one frame. `alpha` in [0, 1) interpolates between the previous and current sim tick;
   * `time` is real time in seconds, used only for cosmetic animation.
   */
  render(sim: Sim, alpha: number, time: number): void {
    this.showcase.update(sim.showcase, alpha, time);
    this.showcase.updateCamera(this.camera, time);
    this.sky.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }

  stats(out: RenderStats): RenderStats {
    const info = this.renderer.info;
    out.drawCalls = info.render.calls;
    out.triangles = info.render.triangles;
    out.geometries = info.memory.geometries;
    out.textures = info.memory.textures;
    out.width = this.renderer.domElement.width;
    out.height = this.renderer.domElement.height;
    out.pixelRatio = this.renderer.getPixelRatio();
    return out;
  }
}
