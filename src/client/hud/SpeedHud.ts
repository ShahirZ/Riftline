import type { MovementTuning } from '../../sim/movement/MovementTuning';
import type { Player } from '../../sim/player/Player';
import { ACCURATE_FRACTION, SPEED_HISTORY } from '../debug/MovementTelemetry';
import type { MovementTelemetry } from '../debug/MovementTelemetry';
import { el } from '../ui/dom';

const WIDTH = 270;
const HEIGHT = 96;
/** Graph ceiling as a multiple of run speed. */
const HEADROOM = 1.15;
/** Text refresh interval; the graph redraws every frame. */
const TEXT_REFRESH_MS = 100;

/**
 * On-screen speed graph (last 3 s) with the movement timings from MovementTelemetry. A tuning
 * aid, toggled in Settings.
 */
export class SpeedHud {
  readonly root: HTMLElement;
  private readonly canvas = el('canvas', {
    attrs: { width: String(WIDTH), height: String(HEIGHT) },
  });
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly text = el('pre');
  private nextText = 0;
  private top = 1;

  constructor(parent: HTMLElement) {
    this.root = el('div', { className: 'speed-hud' }, this.canvas, this.text);
    this.root.hidden = true;
    this.ctx = this.canvas.getContext('2d');
    parent.append(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  draw(t: MovementTelemetry, player: Player, tuning: MovementTuning, nowMs: number): void {
    if (this.root.hidden) return;
    this.drawGraph(t, tuning);
    if (nowMs < this.nextText) return;
    this.nextText = nowMs + TEXT_REFRESH_MS;
    const stop = t.lastStop;
    const jump = t.lastJump;
    const accurate = (tuning.runSpeed * ACCURATE_FRACTION).toFixed(1);
    this.text.textContent = [
      `speed ${player.speed.toFixed(2)} m/s  ${player.onGround ? 'ground' : 'air'}${player.crouched ? '  crouched' : ''}`,
      stop
        ? `last stop (${stop.kind === 'counter' ? 'counter-strafe' : 'release'}): ${stop.toAccurateMs.toFixed(0)} ms to ${accurate} m/s, ${stop.toStopMs.toFixed(0)} ms to stop`
        : 'last stop: run, then release or counter-strafe',
      t.lastStartMs !== null
        ? `last start: ${t.lastStartMs.toFixed(0)} ms to 95% run speed`
        : 'last start: run from standing still',
      jump
        ? `last jump: ${jump.height.toFixed(2)} m high, ${jump.airTimeMs.toFixed(0)} ms, ${jump.distance.toFixed(2)} m far, lands at ${jump.impact.toFixed(1)} m/s`
        : 'last jump: none yet',
    ].join('\n');
  }

  private drawGraph(t: MovementTelemetry, tuning: MovementTuning): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.top = tuning.runSpeed * HEADROOM;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.lineWidth = 1;
    this.guide(ctx, tuning.runSpeed, 'rgba(255,255,255,0.35)');
    this.guide(ctx, tuning.walkSpeed, 'rgba(255,255,255,0.2)');
    this.guide(ctx, tuning.crouchSpeed, 'rgba(255,255,255,0.2)');
    this.guide(ctx, tuning.runSpeed * ACCURATE_FRACTION, 'rgba(31,200,232,0.55)');
    ctx.strokeStyle = '#ff6b2c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < SPEED_HISTORY; i++) {
      const speed = t.speeds[(t.head + i) % SPEED_HISTORY] ?? 0;
      const x = (i / (SPEED_HISTORY - 1)) * WIDTH;
      if (i === 0) ctx.moveTo(x, this.y(speed));
      else ctx.lineTo(x, this.y(speed));
    }
    ctx.stroke();
  }

  private guide(ctx: CanvasRenderingContext2D, speed: number, color: string): void {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, this.y(speed) + 0.5);
    ctx.lineTo(WIDTH, this.y(speed) + 0.5);
    ctx.stroke();
  }

  /** Canvas y for a speed, with `top` m/s at the top edge. */
  private y(speed: number): number {
    return HEIGHT - (Math.min(speed, this.top) / this.top) * (HEIGHT - 4) - 2;
  }
}
