import { MOVEMENT, PLAYER_BODY } from '../data/movement';
import { copyInputCommand } from './input/InputCommand';
import type { InputCommand } from './input/InputCommand';
import type { MapDef } from './map/MapDef';
import { validateMap } from './map/validateMap';
import { SKIN } from './movement/CharacterMotor';
import type { MovementTuning, PlayerBody } from './movement/MovementTuning';
import { PlayerMovement } from './movement/PlayerMovement';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { Player } from './player/Player';
import type { Team } from './player/Player';

export interface SimOptions {
  /** Match seed. Every random stream in the sim derives from it (see core/rng). */
  readonly seed: number;
  readonly map: MapDef;
  /** Movement feel; defaults to src/data/movement.ts. */
  readonly tuning?: MovementTuning;
  readonly body?: PlayerBody;
}

/** How far below the map's floor of bounds a player may fall before being put back, m. */
const FALL_LIMIT = 10;

/**
 * The authoritative game simulation. It advances in fixed ticks (see core/constants) and holds
 * all game state. Rendering, audio and HUD read from it but never write to it; controllers
 * (the local player, later bots and network peers) drive it only through InputCommands.
 *
 * Requires `initPhysics()` to have resolved before construction.
 */
export class Sim {
  tick = 0;
  readonly seed: number;
  readonly map: MapDef;
  readonly physics: PhysicsWorld;
  readonly movement: PlayerMovement;
  /** Live movement parameters. Change them through setTuning(). */
  readonly tuning: MovementTuning;
  readonly players: Player[] = [];
  /** Times a player fell out of the world and was put back. Should stay 0. */
  fallResets = 0;

  constructor(options: SimOptions) {
    const problems = validateMap(options.map);
    if (problems.length > 0) {
      throw new Error(`Map "${options.map.id}" is invalid:\n${problems.join('\n')}`);
    }
    this.seed = options.seed;
    this.map = options.map;
    this.tuning = { ...(options.tuning ?? MOVEMENT) };
    this.physics = new PhysicsWorld(options.map);
    this.movement = new PlayerMovement(this.physics, options.body ?? PLAYER_BODY);
  }

  /** Adds a player at one of its team's spawn points and returns it. */
  addPlayer(team: Team, spawnIndex = 0): Player {
    const player = new Player(this.players.length, team, this.movement.body.standEyeHeight);
    this.players.push(player);
    this.respawn(player, spawnIndex);
    return player;
  }

  /** Puts a player back at a spawn point of its team, standing still. */
  respawn(player: Player, spawnIndex = 0): void {
    const spawns = this.map.spawns[player.team];
    const spawn = spawns[spawnIndex % spawns.length];
    if (!spawn) throw new Error(`Map "${this.map.id}" has no ${player.team} spawn points`);
    const [x, y, z] = spawn.position;
    player.place(x, y + SKIN, z, spawn.yaw, this.movement.body.standEyeHeight);
  }

  /** Stores the command a player's controller produced for the next tick (copied). */
  setInput(playerId: number, command: InputCommand): void {
    const player = this.players[playerId];
    if (!player) throw new Error(`No player ${playerId}`);
    copyInputCommand(player.input, command);
  }

  /** Replaces the live movement parameters (debug tuning panel, tests). */
  setTuning(values: MovementTuning): void {
    Object.assign(this.tuning, values);
  }

  /** Advances the simulation by exactly one tick. */
  step(): void {
    const floor = this.map.bounds.min[1] - FALL_LIMIT;
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];
      this.movement.step(player, player.input, this.tuning);
      if (player.y < floor) {
        this.fallResets++;
        this.respawn(player);
      }
    }
    this.tick++;
  }

  dispose(): void {
    this.physics.dispose();
  }
}
