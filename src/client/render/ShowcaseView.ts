import {
  BoxGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PointLight,
  TorusGeometry,
} from 'three';
import type { PerspectiveCamera } from 'three';
import { lerp, lerpAngle } from '../../sim/core/math';
import type { Showcase } from '../../sim/showcase/Showcase';
import { TEAM_COLORS } from './palette';

const RELAY_X = 0;
const RELAY_Y = 3.25;
const RELAY_Z = -9;

/**
 * STUB(M1): presentation of the placeholder content, removed with it.
 *
 * Draws the relay device on its pedestal and the hovering probe drone. Reads sim state,
 * interpolates between ticks, holds no game state.
 */
export class ShowcaseView {
  readonly root = new Group();
  private readonly relay = new Group();
  private readonly relayCore: Mesh;
  private readonly relayRingA: Mesh;
  private readonly relayRingB: Mesh;
  private readonly relayLight: PointLight;
  private readonly drone = new Group();
  private readonly rotorA: Mesh;
  private readonly rotorB: Mesh;

  constructor() {
    const ember = new Color(TEAM_COLORS.attacker);
    const tide = new Color(TEAM_COLORS.defender);
    const metal = new MeshStandardMaterial({ color: 0x4a5462, roughness: 0.55, flatShading: true });
    const dark = new MeshStandardMaterial({ color: 0x262b33, roughness: 0.7, flatShading: true });

    // Relay: a glowing faceted core inside two counter-rotating rings.
    this.relayCore = new Mesh(
      new OctahedronGeometry(0.3, 0),
      new MeshBasicMaterial({ color: ember.clone().multiplyScalar(2.2) }),
    );
    this.relayRingA = new Mesh(new TorusGeometry(0.62, 0.06, 4, 10), metal);
    this.relayRingB = new Mesh(new TorusGeometry(0.48, 0.05, 4, 8), metal);
    this.relayRingB.rotation.x = Math.PI / 2;
    for (const m of [this.relayRingA, this.relayRingB]) m.castShadow = true;
    this.relay.add(this.relayCore, this.relayRingA, this.relayRingB);
    this.relay.position.set(RELAY_X, RELAY_Y, RELAY_Z);
    this.relay.scale.setScalar(1.5);
    this.relayLight = new PointLight(TEAM_COLORS.attacker, 18, 9, 2);
    this.relayLight.position.set(RELAY_X, RELAY_Y, RELAY_Z);

    // Drone: faceted body, a visor in defender color, two rotors.
    const body = new Mesh(new IcosahedronGeometry(0.36, 0), metal);
    body.scale.set(1, 0.55, 1.25);
    body.castShadow = true;
    const visor = new Mesh(
      new BoxGeometry(0.34, 0.08, 0.06),
      new MeshBasicMaterial({ color: tide.clone().multiplyScalar(2) }),
    );
    visor.position.set(0, 0.03, -0.44);
    const rotorGeometry = new BoxGeometry(0.9, 0.02, 0.07);
    this.rotorA = new Mesh(rotorGeometry, dark);
    this.rotorB = new Mesh(rotorGeometry, dark);
    this.rotorA.position.set(0, 0.24, 0.12);
    this.rotorB.position.set(0, 0.24, -0.12);
    for (const r of [this.rotorA, this.rotorB]) r.castShadow = true;
    this.drone.add(body, visor, this.rotorA, this.rotorB);

    this.root.add(this.relay, this.relayLight, this.drone);
  }

  /** Applies interpolated sim state. `alpha` blends the previous and current tick. */
  update(showcase: Showcase, alpha: number, time: number): void {
    const angle = lerp(showcase.prevRelayAngle, showcase.relayAngle, alpha);
    this.relayRingA.rotation.y = angle;
    this.relayRingA.rotation.x = Math.sin(angle * 0.5) * 0.35;
    this.relayRingB.rotation.z = -angle * 1.4;
    this.relayCore.rotation.y = -angle * 0.6;
    const pulse = 0.5 + 0.5 * Math.sin(angle * 3.2);
    this.relayCore.scale.setScalar(1 + pulse * 0.1);
    this.relay.position.y = RELAY_Y + Math.sin(angle * 1.1) * 0.06;
    this.relayLight.intensity = 14 + pulse * 10;

    this.drone.position.set(
      lerp(showcase.prevDroneX, showcase.droneX, alpha),
      lerp(showcase.prevDroneY, showcase.droneY, alpha),
      lerp(showcase.prevDroneZ, showcase.droneZ, alpha),
    );
    this.drone.rotation.y = lerpAngle(showcase.prevDroneHeading, showcase.droneHeading, alpha);
    // Rotor spin is purely cosmetic, so it runs on render time.
    this.rotorA.rotation.y = time * 31;
    this.rotorB.rotation.y = -time * 29;
  }

  /** Slow cinematic sweep across the diorama. */
  updateCamera(camera: PerspectiveCamera, time: number): void {
    const azimuth = Math.sin(time * 0.11) * 0.55;
    const radius = 16.5;
    const tx = 0;
    const ty = 1.8;
    const tz = -4.6;
    camera.position.set(
      tx + Math.sin(azimuth) * radius,
      7.4 + Math.sin(time * 0.23) * 0.35,
      tz + Math.cos(azimuth) * radius,
    );
    camera.lookAt(tx, ty, tz);
  }
}
