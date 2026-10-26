import { beforeAll, describe, expect, it } from 'vitest';
import { MOVEMENT } from '../data/movement';
import { TICK_RATE } from './core/constants';
import { Button, createInputCommand } from './input/InputCommand';
import type { MapDef } from './map/MapDef';
import { SKIN } from './movement/CharacterMotor';
import { initPhysics } from './physics/PhysicsWorld';
import { Sim } from './Sim';
import { box, testMap } from './testing/scenario';

beforeAll(async () => {
  await initPhysics();
});

describe('Sim', () => {
  it('advances one tick per step', () => {
    const sim = new Sim({ seed: 1, map: testMap([]) });
    for (let i = 0; i < TICK_RATE; i++) sim.step();
    expect(sim.tick).toBe(TICK_RATE);
    sim.dispose();
  });

  it('spawns a player standing at its team spawn', () => {
    const map = testMap([], 3, -4);
    const sim = new Sim({ seed: 1, map });
    const player = sim.addPlayer('defender');
    expect([player.x, player.z]).toEqual([3, -4]);
    for (let i = 0; i < 5; i++) sim.step();
    expect(player.onGround).toBe(true);
    expect(player.y).toBeCloseTo(SKIN, 3);
    sim.dispose();
  });

  it('copies input commands instead of keeping references', () => {
    const sim = new Sim({ seed: 1, map: testMap([]) });
    const player = sim.addPlayer('attacker');
    const cmd = createInputCommand();
    cmd.forward = 1;
    sim.setInput(player.id, cmd);
    cmd.forward = 0;
    sim.step();
    expect(player.speed).toBeGreaterThan(0);
    sim.dispose();
  });

  it('keeps previous-tick state for render interpolation', () => {
    const sim = new Sim({ seed: 1, map: testMap([]) });
    const player = sim.addPlayer('attacker');
    const cmd = createInputCommand();
    cmd.forward = 1;
    for (let i = 0; i < 30; i++) {
      sim.setInput(player.id, cmd);
      sim.step();
    }
    expect(player.prevZ).toBeGreaterThan(player.z);
    expect(player.prevZ - player.z).toBeCloseTo(-player.vz / TICK_RATE, 6);
    sim.dispose();
  });

  it('applies live tuning changes', () => {
    const sim = new Sim({ seed: 1, map: testMap([]) });
    const player = sim.addPlayer('attacker');
    sim.setTuning({ ...MOVEMENT, runSpeed: 4 });
    const cmd = createInputCommand();
    cmd.forward = 1;
    for (let i = 0; i < 60; i++) {
      sim.setInput(player.id, cmd);
      sim.step();
    }
    expect(player.speed).toBeCloseTo(4, 6);
    sim.dispose();
  });

  it('puts back a player who falls out of the world', () => {
    // No floor under x > 5: walk east off the edge into the void.
    const map: MapDef = {
      ...testMap([]),
      solids: [box(-10, -1, -10, 5, 0, 10)],
      bounds: { min: [-20, -2, -20], max: [20, 10, 20] },
    };
    const sim = new Sim({ seed: 1, map });
    const player = sim.addPlayer('attacker');
    const cmd = createInputCommand();
    cmd.strafe = 1;
    for (let i = 0; i < 300; i++) {
      sim.setInput(player.id, cmd);
      sim.step();
      if (sim.fallResets > 0) break;
    }
    expect(sim.fallResets).toBe(1);
    expect(player.x).toBe(0);
    sim.dispose();
  });

  it('is deterministic for the same seed and inputs', () => {
    const run = (): number[] => {
      const sim = new Sim({ seed: 9, map: testMap([box(2, 0, -3, 4, 0.4, -1)]) });
      const player = sim.addPlayer('attacker');
      const cmd = createInputCommand();
      for (let i = 0; i < 240; i++) {
        cmd.forward = i % 50 < 30 ? 1 : -1;
        cmd.strafe = i % 70 < 20 ? 1 : 0;
        cmd.yaw = i * 0.01;
        cmd.buttons = i % 90 === 10 ? Button.Jump : 0;
        sim.setInput(player.id, cmd);
        sim.step();
      }
      const out = [player.x, player.y, player.z, player.vx, player.vy, player.vz];
      sim.dispose();
      return out;
    };
    expect(run()).toEqual(run());
  });

  it('rejects an invalid map', () => {
    const broken: MapDef = {
      ...testMap([]),
      bounds: { min: [0, 0, 0], max: [1, 1, 1] },
    };
    expect(() => new Sim({ seed: 1, map: broken })).toThrow(/invalid/);
  });
});
