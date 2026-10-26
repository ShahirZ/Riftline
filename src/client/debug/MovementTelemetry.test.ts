import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MOVEMENT } from '../../data/movement';
import { Button } from '../../sim/input/InputCommand';
import { jumpSpeed } from '../../sim/movement/MovementTuning';
import { initPhysics } from '../../sim/physics/PhysicsWorld';
import { Driver, testMap } from '../../sim/testing/scenario';
import { MovementTelemetry } from './MovementTelemetry';

beforeAll(async () => {
  await initPhysics();
});

let driver: Driver | null = null;
afterEach(() => driver?.dispose());

/** A driver whose every tick also feeds a telemetry instance. */
function measured(): [Driver, MovementTelemetry] {
  const d = new Driver(testMap([]));
  driver = d;
  const t = new MovementTelemetry();
  const step = d.run.bind(d);
  d.run = (ticks, each) =>
    step(ticks, (i) => {
      t.afterTick(d.player, d.cmd, d.sim.tuning);
      each?.(i);
    });
  d.settle(10);
  return [d, t];
}

describe('MovementTelemetry', () => {
  it('times a start from standstill to run speed', () => {
    const [d, t] = measured();
    d.hold({ forward: 1 }).run(60);
    expect(t.lastStartMs).not.toBeNull();
    expect(t.lastStartMs ?? 0).toBeGreaterThan(50);
    expect(t.lastStartMs ?? 0).toBeLessThan(200);
  });

  it('tells counter-strafes from releases and times both', () => {
    const [d, t] = measured();
    d.hold({ strafe: 1 }).run(60).hold({}).run(60);
    const release = t.lastStop;
    expect(release?.kind).toBe('release');
    d.hold({ strafe: 1 }).run(60).hold({ strafe: -1 }).run(30);
    const counter = t.lastStop;
    expect(counter?.kind).toBe('counter');
    expect(counter?.toAccurateMs ?? 0).toBeLessThan(release?.toAccurateMs ?? 0);
    expect(counter?.toStopMs ?? 0).toBeLessThan(release?.toStopMs ?? 0);
  });

  it('measures jump height and air time', () => {
    const [d, t] = measured();
    d.tapJump().run(60);
    expect(t.lastJump?.height).toBeCloseTo(MOVEMENT.jumpHeight, 2);
    const airMs = ((2 * jumpSpeed(MOVEMENT)) / MOVEMENT.gravity) * 1000;
    expect(Math.abs((t.lastJump?.airTimeMs ?? 0) - airMs)).toBeLessThan(40);
  });

  it('keeps a rolling speed history', () => {
    const [d, t] = measured();
    d.hold({ forward: 1, buttons: Button.Walk }).run(200);
    const newest = t.speeds[(t.head + t.speeds.length - 1) % t.speeds.length] ?? 0;
    expect(newest).toBeCloseTo(MOVEMENT.walkSpeed, 3);
  });
});
