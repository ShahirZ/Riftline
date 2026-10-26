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
import type { Player } from '../../sim/player/Player';
import { applyDevGrid } from './devGrid';
import type { GridStrength } from './devGrid';
import { FirstPersonCamera } from './FirstPersonCamera';
import { buildMapGeometry } from './mapMesh';
import { ATMOSPHERE } from './palette';
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

/** Direction the sunlight comes from (normalized below): high afternoon sun from the south-west. */
const SUN_DIRECTION = { x: -0.55, y: 0.72, z: 0.42 };
/** Distance from the map center to the shadow camera, m. */
const SUN_DISTANCE = 120;

/**
 * Owns the three.js renderer, scene and camera. Reads sim state each frame and draws it; it
 * never writes to the sim. Game state lives in src/sim; everything here is presentation.
 */
export class GameRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(70, 1, 0.05, 700);
  readonly view = new FirstPersonCamera();
  readonly threeRevision = REVISION;
  private readonly sky = createSky();
  private readonly sun = new DirectionalLight(ATMOSPHERE.sun, 2.2);
  private readonly grid: GridStrength = { value: 1 };
  private mapMeshes: Mesh[] = [];

  constructor(private readonly container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    // The map is static, so its shadow map is rendered once per map instead of every frame.
    // Visible characters (M4) will need their own shadows or a per-frame update.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.domElement.className = 'game-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene.fog = new Fog(ATMOSPHERE.fog, 80, 380);
    this.scene.add(this.sky);
    this.scene.add(new HemisphereLight(ATMOSPHERE.hemiSky, ATMOSPHERE.hemiGround, 1.35));

    // Presentation-only ground that runs out to the horizon, so the map never floats in a void.
    const backdrop = new Mesh(
      new PlaneGeometry(1600, 1600),
      new MeshLambertMaterial({ color: ATMOSPHERE.backdrop }),
    );
    backdrop.name = 'backdrop';
    backdrop.rotation.x = -Math.PI / 2;
    backdrop.position.y = -0.03;
    backdrop.receiveShadow = true;
    this.scene.add(backdrop);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.resize();
  }

  /** Builds merged static meshes for a map (replacing any previous map) and fits the sun's shadow. */
  setMap(map: MapDef): void {
    for (const mesh of this.mapMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshLambertMaterial | MeshBasicMaterial).dispose();
    }
    const geometry = buildMapGeometry(map);
    // Lambert: the flat-shaded look needs no specular, and it is the cheapest lit material.
    const litMaterial = new MeshLambertMaterial({ vertexColors: true });
    applyDevGrid(litMaterial, this.grid);
    const lit = new Mesh(geometry.lit, litMaterial);
    lit.castShadow = true;
    lit.receiveShadow = true;
    const glow = new Mesh(geometry.glow, new MeshBasicMaterial({ vertexColors: true }));
    lit.name = 'map-lit';
    glow.name = 'map-glow';
    this.mapMeshes = [lit, glow];
    this.scene.add(lit, glow);
    this.fitShadow(map);
  }

  setDevGrid(enabled: boolean): void {
    this.grid.value = enabled ? 1 : 0;
  }

  resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /** Per-tick presentation bookkeeping (step smoothing, landing cues). */
  afterTick(player: Player): void {
    this.view.afterTick(player);
  }

  /**
   * Draws one frame from `player`'s eyes. `alpha` in [0, 1) interpolates between the previous and
   * current sim tick; yaw and pitch come from live input so the view turns at display rate.
   */
  render(player: Player, alpha: number, yaw: number, pitch: number, frameSeconds: number): void {
    this.view.update(this.camera, player, alpha, yaw, pitch, frameSeconds);
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

  /** Points the sun at the map center with an orthographic shadow box covering the whole map. */
  private fitShadow(map: MapDef): void {
    const [x0, y0, z0] = map.bounds.min;
    const [x1, y1, z1] = map.bounds.max;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const len = Math.hypot(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z);
    this.sun.target.position.set(cx, 0, cz);
    this.sun.position.set(
      cx + (SUN_DIRECTION.x / len) * SUN_DISTANCE,
      (SUN_DIRECTION.y / len) * SUN_DISTANCE,
      cz + (SUN_DIRECTION.z / len) * SUN_DISTANCE,
    );
    // Half the map's diagonal covers it from any sun direction.
    const radius = Math.hypot(x1 - x0, z1 - z0, y1 - y0) / 2;
    const s = this.sun.shadow.camera;
    s.left = -radius;
    s.right = radius;
    s.top = radius;
    s.bottom = -radius;
    s.near = SUN_DISTANCE - radius;
    s.far = SUN_DISTANCE + radius;
    s.updateProjectionMatrix();
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
    this.renderer.shadowMap.needsUpdate = true;
  }
}
