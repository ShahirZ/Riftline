import { DebugOverlay } from '../client/debug/DebugOverlay';
import { MovementTelemetry } from '../client/debug/MovementTelemetry';
import { RollingStat } from '../client/debug/RollingStat';
import { TuningPanel } from '../client/debug/TuningPanel';
import type { TuningStore } from '../client/debug/TuningStore';
import { Crosshair } from '../client/hud/Crosshair';
import { SpeedHud } from '../client/hud/SpeedHud';
import { DEFAULT_BINDINGS } from '../client/input/bindings';
import { InputSampler } from '../client/input/InputSampler';
import { PointerLock } from '../client/input/PointerLock';
import { Menu } from '../client/menu/Menu';
import { SettingsPanel } from '../client/menu/SettingsPanel';
import type { GameRenderer, RenderStats } from '../client/render/GameRenderer';
import { BASE_DEGREES_PER_COUNT, cmPer360 } from '../client/settings/Settings';
import type { SettingsStore } from '../client/settings/Settings';
import { DT, TICK_RATE } from '../sim/core/constants';
import { createInputCommand } from '../sim/input/InputCommand';
import { physicsVersion } from '../sim/physics/PhysicsWorld';
import type { Player } from '../sim/player/Player';
import type { Sim } from '../sim/Sim';
import { showFatalError } from './fatal';
import { FixedStepper } from './FixedStepper';

/** Upper bound on sim steps per rendered frame before backlog is dropped. */
const MAX_STEPS_PER_FRAME = 8;
/** Rolling window for performance stats, in frames. */
const STAT_WINDOW = 120;

interface ChromeMemory {
  readonly usedJSHeapSize: number;
}

export interface AppOptions {
  readonly sim: Sim;
  /** The locally controlled player. */
  readonly player: Player;
  readonly renderer: GameRenderer;
  /** Container for the HUD, menus and debug overlay. */
  readonly hud: HTMLElement;
  readonly settings: SettingsStore;
  readonly tuning: TuningStore;
  readonly maps: readonly { readonly id: string; readonly name: string }[];
  readonly buildSha: string;
  readonly debugVisible: boolean;
}

/**
 * Composition root and main loop. While the pointer is locked, each animation frame runs zero or
 * more fixed sim steps (one sampled InputCommand each) and renders the interpolated state. When
 * the pointer is released (Esc, focus loss) the game pauses and the menu shows. All game state
 * lives in the Sim.
 */
export class App {
  readonly overlay: DebugOverlay;
  private readonly sim: Sim;
  private readonly player: Player;
  private readonly renderer: GameRenderer;
  private readonly stepper = new FixedStepper(DT, MAX_STEPS_PER_FRAME);
  private readonly sampler = new InputSampler(DEFAULT_BINDINGS);
  private readonly lock: PointerLock;
  private readonly cmd = createInputCommand();
  private readonly telemetry = new MovementTelemetry();
  private readonly menu: Menu;
  private readonly crosshair: Crosshair;
  private readonly speedHud: SpeedHud;
  private readonly frameMs = new RollingStat(STAT_WINDOW);
  private readonly tickMs = new RollingStat(STAT_WINDOW);
  private readonly renderMs = new RollingStat(STAT_WINDOW);
  private readonly stepsPerFrame = new RollingStat(STAT_WINDOW);
  private readonly castsPerTick = new RollingStat(STAT_WINDOW);
  private readonly renderStats: RenderStats = {
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    width: 0,
    height: 0,
    pixelRatio: 1,
  };
  private lastFrameMs = -1;
  private running = false;
  private playing = false;
  private everPlayed = false;
  private alpha = 0;

  constructor(private readonly o: AppOptions) {
    this.sim = o.sim;
    this.player = o.player;
    this.renderer = o.renderer;
    this.overlay = new DebugOverlay(o.hud, () => this.debugText(), o.debugVisible);
    this.crosshair = new Crosshair(o.hud);
    this.speedHud = new SpeedHud(o.hud);

    this.sampler.setView(this.player.yaw, this.player.pitch);
    this.sampler.attach(window);
    this.lock = new PointerLock(
      this.renderer.renderer.domElement,
      (dx, dy) => this.sampler.look(dx, dy),
      (locked) => this.onLockChange(locked),
    );

    o.settings.subscribe((s) => {
      this.sampler.setLook(BASE_DEGREES_PER_COUNT * s.sensitivity, s.invertY);
      this.renderer.view.fov = s.fov;
      this.renderer.setDevGrid(s.devGrid);
      this.speedHud.setVisible(s.speedHud);
    });

    const mapName = o.maps.find((m) => m.id === this.sim.map.id)?.name ?? this.sim.map.name;
    this.menu = new Menu(o.hud, {
      bindings: DEFAULT_BINDINGS,
      mapId: this.sim.map.id,
      mapName,
      maps: o.maps,
      settingsPanel: new SettingsPanel(o.settings).root,
      tuningPanel: new TuningPanel(o.tuning, (t) => this.sim.setTuning(t)).root,
      onPlay: () => this.requestPlay(),
    });
    this.menu.show('start');
  }

  /** True while the game runs (pointer locked, menu hidden). */
  get isPlaying(): boolean {
    return this.playing;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrameMs = -1;
    this.stepper.reset();
    requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
  }

  private requestPlay(): void {
    this.menu.setMessage('');
    this.lock.request().catch((error: unknown) => {
      const why = error instanceof Error ? error.message : String(error);
      this.menu.setMessage(`Could not capture the mouse (${why}). Click again in a moment.`);
    });
  }

  private onLockChange(locked: boolean): void {
    this.playing = locked;
    this.sampler.enabled = locked;
    this.crosshair.setVisible(locked);
    if (locked) {
      this.everPlayed = true;
      this.menu.hide();
      // Resume from now: never replay the time spent in the menu.
      this.stepper.reset();
    } else {
      this.sampler.releaseAll();
      this.menu.show(this.everPlayed ? 'paused' : 'start');
    }
  }

  private readonly frame = (nowMs: number): void => {
    if (!this.running) return;
    try {
      const elapsed = this.lastFrameMs < 0 ? 0 : (nowMs - this.lastFrameMs) / 1000;
      this.lastFrameMs = nowMs;

      const t0 = performance.now();
      let steps = 0;
      if (this.playing) {
        steps = this.stepper.advance(elapsed);
        for (let i = 0; i < steps; i++) this.tick();
        this.alpha = this.stepper.alpha;
      }
      const t1 = performance.now();
      this.renderer.render(this.player, this.alpha, this.sampler.yaw, this.sampler.pitch, elapsed);
      const t2 = performance.now();
      this.speedHud.draw(this.telemetry, this.player, this.sim.tuning, nowMs);

      if (elapsed > 0) this.frameMs.push(elapsed * 1000);
      if (steps > 0) this.tickMs.push((t1 - t0) / steps);
      this.renderMs.push(t2 - t1);
      this.stepsPerFrame.push(steps);
      this.overlay.update(nowMs);
    } catch (error) {
      this.running = false;
      showFatalError('RIFTLINE stopped because of an error', error);
      return;
    }
    requestAnimationFrame(this.frame);
  };

  /** One sim tick: sample input, step, then let presentation see the new state. */
  private tick(): void {
    const casts = this.sim.movement.motor.casts;
    this.sampler.sample(this.cmd, this.sim.tick);
    this.sim.setInput(this.player.id, this.cmd);
    this.sim.step();
    this.renderer.afterTick(this.player);
    this.telemetry.afterTick(this.player, this.cmd, this.sim.tuning);
    this.castsPerTick.push(this.sim.movement.motor.casts - casts);
  }

  private debugText(): string {
    const r = this.renderer.stats(this.renderStats);
    const p = this.player;
    const motor = this.sim.movement.motor;
    const settings = this.o.settings.get();
    const frame = this.frameMs.mean();
    const fps = frame > 0 ? 1000 / frame : 0;
    const memory = (performance as Performance & { memory?: ChromeMemory }).memory;
    const heap = memory
      ? `${(memory.usedJSHeapSize / 1048576).toFixed(1)} MB`
      : 'n/a (Chromium only)';
    const tris = r.triangles >= 1000 ? `${(r.triangles / 1000).toFixed(1)}k` : String(r.triangles);
    const v = (n: number): string => n.toFixed(2).padStart(6);
    const mouse = this.lock.locked
      ? this.lock.mode === 'raw'
        ? 'raw (no OS acceleration)'
        : 'standard (OS acceleration applies)'
      : 'free (menu)';
    return [
      `RIFTLINE debug  ·  build ${this.o.buildSha}  ·  \` to hide`,
      ``,
      `fps        ${fps.toFixed(1).padStart(6)}    frame ${frame.toFixed(2)} ms  (max ${this.frameMs.max().toFixed(2)})`,
      `sim        ${String(TICK_RATE).padStart(3)} Hz    tick  ${this.tickMs.mean().toFixed(3)} ms (max ${this.tickMs.max().toFixed(3)})   ${this.playing ? 'running' : 'paused'}`,
      `           steps/frame ${this.stepsPerFrame.mean().toFixed(2)}   dropped ${this.stepper.droppedSteps}   tick #${this.sim.tick}`,
      `render cpu ${this.renderMs.mean().toFixed(2).padStart(6)} ms (max ${this.renderMs.max().toFixed(2)})`,
      `draws      ${String(r.drawCalls).padStart(6)}    tris ${tris}   geo ${r.geometries}   tex ${r.textures}`,
      `canvas     ${r.width}×${r.height} @ ${r.pixelRatio.toFixed(2)}x`,
      `heap       ${heap}`,
      ``,
      `player     pos ${v(p.x)} ${v(p.y)} ${v(p.z)}   vel ${v(p.vx)} ${v(p.vy)} ${v(p.vz)}`,
      `           speed ${p.speed.toFixed(2)} m/s   ${p.onGround ? 'ground' : 'air   '}   ${p.crouched ? 'crouched' : 'standing'}   eye ${p.eyeHeight.toFixed(2)} m   landing ×${p.landingFactor.toFixed(2)}`,
      `motor      queries/tick ${this.castsPerTick.mean().toFixed(1)}   depenetrations ${motor.depenetrations}   fall resets ${this.sim.fallResets}`,
      `mouse      ${mouse}   sens ${settings.sensitivity.toFixed(2)} (${cmPer360(settings.sensitivity).toFixed(1)} cm/360 @ 800 dpi)`,
      `map        ${this.sim.map.name}`,
      `libs       three r${this.renderer.threeRevision}   rapier ${physicsVersion()}`,
    ].join('\n');
  }
}
