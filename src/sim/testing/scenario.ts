/**
 * Helpers for headless movement tests: tiny maps built from a few solids, and a driver that feeds
 * a player scripted InputCommands tick by tick. Test-only; nothing in the game imports this.
 */
import { MOVEMENT } from '../../data/movement';
import { Button, createInputCommand } from '../input/InputCommand';
import type { InputCommand } from '../input/InputCommand';
import type { MapDef, SolidDef } from '../map/MapDef';
import type { MovementTuning } from '../movement/MovementTuning';
import type { Player } from '../player/Player';
import { Sim } from '../Sim';

/** A 200 × 200 m flat floor (top at y = 0) plus `solids`, with a spawn at (x, z) facing north. */
export function testMap(solids: readonly SolidDef[], spawnX = 0, spawnZ = 0, spawnY = 0): MapDef {
  return {
    id: 'test',
    name: 'Test',
    bounds: { min: [-100, -2, -100], max: [100, 80, 100] },
    solids: [
      { kind: 'box', min: [-100, -1, -100], max: [100, 0, 100], material: 'concrete' },
      ...solids,
    ],
    spawns: {
      attacker: [{ position: [spawnX, spawnY, spawnZ], yaw: 0 }],
      defender: [{ position: [spawnX, spawnY, spawnZ], yaw: 0 }],
    },
    regions: [],
  };
}

export function box(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): SolidDef {
  return { kind: 'box', min: [x0, y0, z0], max: [x1, y1, z1], material: 'concrete' };
}

/** Degrees to radians. Yaw 0 faces -Z (north), 90 faces -X (west), -90 faces +X (east). */
export function deg(d: number): number {
  return (d * Math.PI) / 180;
}

/** Drives one player of a fresh Sim. */
export class Driver {
  readonly sim: Sim;
  readonly player: Player;
  readonly cmd: InputCommand = createInputCommand();

  constructor(map: MapDef, tuning: MovementTuning = MOVEMENT) {
    this.sim = new Sim({ seed: 1, map, tuning });
    this.player = this.sim.addPlayer('attacker');
    this.cmd.yaw = this.player.yaw;
  }

  get tuning(): MovementTuning {
    return this.sim.tuning;
  }

  /** Sets the held input; anything not given is released. */
  hold(input: { forward?: number; strafe?: number; buttons?: number; yaw?: number }): this {
    this.cmd.forward = input.forward ?? 0;
    this.cmd.strafe = input.strafe ?? 0;
    this.cmd.buttons = input.buttons ?? 0;
    if (input.yaw !== undefined) this.cmd.yaw = input.yaw;
    return this;
  }

  /** Runs `ticks` ticks with the current input. `each` runs after every tick. */
  run(ticks: number, each?: (tick: number) => void): this {
    for (let i = 0; i < ticks; i++) {
      this.cmd.tick = this.sim.tick;
      this.sim.setInput(this.player.id, this.cmd);
      this.sim.step();
      each?.(i);
    }
    return this;
  }

  /** Runs until `done` returns true or `maxTicks` pass; returns the ticks run, or -1 on timeout. */
  runUntil(done: () => boolean, maxTicks: number): number {
    for (let i = 1; i <= maxTicks; i++) {
      this.run(1);
      if (done()) return i;
    }
    return -1;
  }

  /** Lets the player land and come to rest. */
  settle(ticks = 30): this {
    return this.hold({}).run(ticks);
  }

  /** Taps jump for a single tick (a press edge), keeping movement input. */
  tapJump(): this {
    this.cmd.buttons |= Button.Jump;
    this.run(1);
    this.cmd.buttons &= ~Button.Jump;
    return this;
  }

  dispose(): void {
    this.sim.dispose();
  }
}
