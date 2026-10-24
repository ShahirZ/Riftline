import { Rng, deriveSeed } from './core/rng';
import type { MapDef } from './map/MapDef';
import { validateMap } from './map/validateMap';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { Showcase } from './showcase/Showcase';

export interface SimOptions {
  /** Match seed. Every random stream in the sim derives from it. */
  readonly seed: number;
  readonly map: MapDef;
}

/**
 * The authoritative game simulation. It advances in fixed ticks (see core/constants) and holds
 * all game state. Rendering, audio and HUD read from it but never write to it.
 *
 * Requires `initPhysics()` to have resolved before construction.
 */
export class Sim {
  tick = 0;
  readonly map: MapDef;
  readonly physics: PhysicsWorld;
  readonly showcase: Showcase;

  constructor(options: SimOptions) {
    const problems = validateMap(options.map);
    if (problems.length > 0) {
      throw new Error(`Map "${options.map.id}" is invalid:\n${problems.join('\n')}`);
    }
    this.map = options.map;
    this.physics = new PhysicsWorld(options.map);
    this.showcase = new Showcase(this.physics, new Rng(deriveSeed(options.seed, 'showcase')));
  }

  /** Advances the simulation by exactly one tick. STUB(M1): will take the tick's InputCommands. */
  step(): void {
    this.showcase.step();
    this.tick++;
  }

  dispose(): void {
    this.physics.dispose();
  }
}
