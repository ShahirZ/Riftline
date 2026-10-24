import { DebugOverlay } from '../client/debug/DebugOverlay';
import { RollingStat } from '../client/debug/RollingStat';
import type { GameRenderer, RenderStats } from '../client/render/GameRenderer';
import { DT, TICK_RATE } from '../sim/core/constants';
import { physicsVersion } from '../sim/physics/PhysicsWorld';
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

/**
 * Composition root and main loop. Each animation frame it runs zero or more fixed sim steps,
 * then renders the interpolated state. All game state lives in the Sim.
 */
export class App {
  readonly overlay: DebugOverlay;
  private readonly stepper = new FixedStepper(DT, MAX_STEPS_PER_FRAME);
  private readonly frameMs = new RollingStat(STAT_WINDOW);
  private readonly tickMs = new RollingStat(STAT_WINDOW);
  private readonly renderMs = new RollingStat(STAT_WINDOW);
  private readonly stepsPerFrame = new RollingStat(STAT_WINDOW);
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

  constructor(
    private readonly sim: Sim,
    private readonly renderer: GameRenderer,
    overlayParent: HTMLElement,
    private readonly buildSha: string,
    debugVisible: boolean,
  ) {
    this.overlay = new DebugOverlay(overlayParent, () => this.debugText(), debugVisible);
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

  private readonly frame = (nowMs: number): void => {
    if (!this.running) return;
    try {
      const elapsed = this.lastFrameMs < 0 ? 0 : (nowMs - this.lastFrameMs) / 1000;
      this.lastFrameMs = nowMs;

      const steps = this.stepper.advance(elapsed);
      const t0 = performance.now();
      for (let i = 0; i < steps; i++) this.sim.step();
      const t1 = performance.now();
      this.renderer.render(this.sim, this.stepper.alpha, nowMs / 1000);
      const t2 = performance.now();

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

  private debugText(): string {
    const r = this.renderer.stats(this.renderStats);
    const frame = this.frameMs.mean();
    const fps = frame > 0 ? 1000 / frame : 0;
    const memory = (performance as Performance & { memory?: ChromeMemory }).memory;
    const heap = memory
      ? `${(memory.usedJSHeapSize / 1048576).toFixed(1)} MB`
      : 'n/a (Chromium only)';
    const tris = r.triangles >= 1000 ? `${(r.triangles / 1000).toFixed(1)}k` : String(r.triangles);
    return [
      `RIFTLINE debug  ·  build ${this.buildSha}  ·  \` to hide`,
      ``,
      `fps        ${fps.toFixed(1).padStart(6)}    frame ${frame.toFixed(2)} ms  (max ${this.frameMs.max().toFixed(2)})`,
      `sim        ${String(TICK_RATE).padStart(3)} Hz    tick  ${this.tickMs.mean().toFixed(3)} ms (max ${this.tickMs.max().toFixed(3)})`,
      `           steps/frame ${this.stepsPerFrame.mean().toFixed(2)}   dropped ${this.stepper.droppedSteps}   tick #${this.sim.tick}`,
      `render cpu ${this.renderMs.mean().toFixed(2).padStart(6)} ms (max ${this.renderMs.max().toFixed(2)})`,
      `draws      ${String(r.drawCalls).padStart(6)}    tris ${tris}   geo ${r.geometries}   tex ${r.textures}`,
      `canvas     ${r.width}×${r.height} @ ${r.pixelRatio.toFixed(2)}x`,
      `heap       ${heap}`,
      `libs       three r${this.renderer.threeRevision}   rapier ${physicsVersion()}`,
    ].join('\n');
  }
}
