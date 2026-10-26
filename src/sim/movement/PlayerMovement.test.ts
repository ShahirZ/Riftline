import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MOVEMENT, PLAYER_BODY } from '../../data/movement';
import { DT } from '../core/constants';
import { Button } from '../input/InputCommand';
import type { SolidDef } from '../map/MapDef';
import { initPhysics } from '../physics/PhysicsWorld';
import { Driver, box, deg, testMap } from '../testing/scenario';
import { SKIN } from './CharacterMotor';
import { jumpSpeed } from './MovementTuning';

beforeAll(async () => {
  await initPhysics();
});

const drivers: Driver[] = [];
function driver(solids: SolidDef[] = [], spawnX = 0, spawnZ = 0, spawnY = 0): Driver {
  const d = new Driver(testMap(solids, spawnX, spawnZ, spawnY));
  drivers.push(d);
  d.settle(10);
  return d;
}
afterEach(() => {
  for (const d of drivers.splice(0)) d.dispose();
});

const EAST = deg(-90);
const NORTH = 0;

describe('ground movement', () => {
  it('settles on the floor at the skin gap and stays grounded', () => {
    const d = driver();
    expect(d.player.onGround).toBe(true);
    expect(d.player.y).toBeCloseTo(SKIN, 3);
  });

  it('reaches exactly run speed and stays there', () => {
    const d = driver();
    d.hold({ forward: 1, yaw: NORTH }).run(60);
    expect(d.player.speed).toBeCloseTo(MOVEMENT.runSpeed, 6);
    // Moving north means -Z.
    expect(d.player.vz).toBeLessThan(0);
    expect(Math.abs(d.player.vx)).toBeLessThan(1e-9);
  });

  it('accelerates to 95% of run speed in well under 0.2 s', () => {
    const d = driver();
    d.hold({ forward: 1 });
    const ticks = d.runUntil(() => d.player.speed >= MOVEMENT.runSpeed * 0.95, 60);
    expect(ticks * DT).toBeGreaterThan(0.05);
    expect(ticks * DT).toBeLessThan(0.2);
  });

  it('is not faster diagonally', () => {
    const d = driver();
    d.hold({ forward: 1, strafe: 1 }).run(60);
    expect(d.player.speed).toBeCloseTo(MOVEMENT.runSpeed, 6);
  });

  it('walks and crouch-walks at their own speeds', () => {
    const walk = driver();
    walk.hold({ forward: 1, buttons: Button.Walk }).run(60);
    expect(walk.player.speed).toBeCloseTo(MOVEMENT.walkSpeed, 6);
    const crouch = driver();
    crouch.hold({ forward: 1, buttons: Button.Crouch }).run(60);
    expect(crouch.player.speed).toBeCloseTo(MOVEMENT.crouchSpeed, 6);
  });

  it('stops much faster when counter-strafing than when releasing', () => {
    const threshold = 1.5; // m/s: roughly where weapons will count as accurate (M2)
    const release = driver();
    release.hold({ strafe: 1 }).run(60);
    release.hold({});
    const releaseTicks = release.runUntil(() => release.player.speed < threshold, 60);

    const counter = driver();
    counter.hold({ strafe: 1 }).run(60);
    counter.hold({ strafe: -1 });
    const counterTicks = counter.runUntil(() => counter.player.speed < threshold, 60);

    expect(counterTicks).toBeGreaterThan(0);
    expect(counterTicks * DT).toBeLessThanOrEqual(0.07);
    expect(releaseTicks * DT).toBeLessThanOrEqual(0.2);
    expect(releaseTicks).toBeGreaterThanOrEqual(counterTicks * 2);
  });

  it('comes to a complete stop after releasing (no creeping)', () => {
    const d = driver();
    d.hold({ forward: 1 }).run(60).hold({}).run(20);
    expect(d.player.speed).toBe(0);
  });
});

describe('jumping', () => {
  it('reaches the tuned jump height and lands after the expected air time', () => {
    const d = driver();
    const startY = d.player.y;
    let apex = startY;
    d.tapJump();
    expect(d.player.jumped || !d.player.onGround).toBe(true);
    const ticks = d.runUntil(() => {
      apex = Math.max(apex, d.player.y);
      return d.player.onGround;
    }, 120);
    expect(apex - startY).toBeCloseTo(MOVEMENT.jumpHeight, 2);
    const airTime = (2 * jumpSpeed(MOVEMENT)) / MOVEMENT.gravity;
    expect(Math.abs((ticks + 1) * DT - airTime)).toBeLessThanOrEqual(2 * DT);
  });

  it('needs a fresh press for every jump', () => {
    const d = driver();
    d.hold({ buttons: Button.Jump }).run(1);
    expect(d.player.onGround).toBe(false);
    // Keep holding through the landing: no automatic second jump.
    d.runUntil(() => d.player.onGround, 120);
    d.run(20);
    expect(d.player.onGround).toBe(true);
  });

  it('buffers a jump pressed just before landing', () => {
    const d = driver();
    d.tapJump();
    // Press again a few ticks before touchdown.
    const airTicks = Math.round((2 * jumpSpeed(MOVEMENT)) / MOVEMENT.gravity / DT);
    d.run(airTicks - 4);
    expect(d.player.onGround).toBe(false);
    d.tapJump();
    const landed = d.runUntil(() => d.player.onGround, 10);
    expect(landed).toBeGreaterThan(0);
    d.run(2);
    expect(d.player.onGround).toBe(false);
    expect(d.player.vy).toBeGreaterThan(0);
  });

  it('allows a jump just after walking off a ledge, but not long after', () => {
    // A 2 m high platform; walk east off its edge.
    const ledge = [box(-5, 0, -3, 2, 2, 3)];
    const late = new Driver(testMap(ledge, 0, 0, 2));
    const early = new Driver(testMap(ledge, 0, 0, 2));
    drivers.push(late, early);
    for (const d of [late, early]) {
      d.settle(10);
      d.hold({ forward: 1, yaw: EAST });
      d.runUntil(() => !d.player.onGround, 60);
    }
    early.run(2).tapJump();
    expect(early.player.vy).toBeGreaterThan(jumpSpeed(MOVEMENT) * 0.9);
    late.run(Math.ceil(MOVEMENT.coyoteTime / DT) + 3).tapJump();
    expect(late.player.vy).toBeLessThan(0);
  });

  it('cannot jump again in mid-air', () => {
    const d = driver();
    d.tapJump().run(10);
    const vy = d.player.vy;
    d.tapJump();
    expect(d.player.vy).toBeLessThan(vy);
  });

  it('slows down on landing so chained jumps lose speed', () => {
    const d = driver();
    d.hold({ forward: 1 }).run(60);
    d.tapJump();
    d.runUntil(() => d.player.onGround, 120);
    expect(d.player.landedImpact).toBeGreaterThan(MOVEMENT.landingSoftImpact);
    expect(d.player.speed).toBeLessThan(MOVEMENT.runSpeed * 0.8);
  });
});

describe('no bunny-hop or air-strafe gain', () => {
  it('perfect bunny-hopping with air strafing never exceeds run speed and is slower than running', () => {
    const d = driver();
    d.hold({ forward: 1, yaw: NORTH }).run(60);
    let yaw = NORTH;
    let maxSpeed = 0;
    let distance = 0;
    const ticks = 600;
    let side = 1;
    let airTicks = 0;
    for (let i = 0; i < ticks; i++) {
      // Classic air strafe: turn the view toward the strafe direction every tick in the air.
      if (!d.player.onGround) {
        airTicks++;
        yaw += side * deg(1.5);
        if (airTicks % 20 === 0) side = -side;
      }
      const jump = d.player.onGround ? Button.Jump : 0;
      d.hold({ forward: 1, strafe: side, yaw, buttons: jump });
      const x = d.player.x;
      const z = d.player.z;
      d.run(1);
      distance += Math.hypot(d.player.x - x, d.player.z - z);
      maxSpeed = Math.max(maxSpeed, d.player.speed);
    }
    expect(maxSpeed).toBeLessThanOrEqual(MOVEMENT.runSpeed + 1e-6);
    expect(distance / (ticks * DT)).toBeLessThan(MOVEMENT.runSpeed * 0.75);
  });

  it('air control steers but never adds speed beyond takeoff speed', () => {
    const d = driver();
    d.hold({ forward: 1, yaw: NORTH }).run(60);
    const takeoff = d.player.speed;
    d.tapJump();
    let yaw = NORTH;
    let maxSpeed = 0;
    d.runUntil(() => {
      yaw += deg(2);
      d.hold({ strafe: 1, yaw });
      maxSpeed = Math.max(maxSpeed, d.player.speed);
      return d.player.onGround;
    }, 120);
    expect(maxSpeed).toBeLessThanOrEqual(takeoff + 1e-9);
  });

  it('lets a standing jump drift only a little', () => {
    const d = driver();
    d.tapJump().hold({ forward: 1 });
    let maxSpeed = 0;
    d.runUntil(() => {
      maxSpeed = Math.max(maxSpeed, d.player.speed);
      return d.player.onGround;
    }, 120);
    expect(maxSpeed).toBeGreaterThan(0.5);
    expect(maxSpeed).toBeLessThanOrEqual(MOVEMENT.airDriftSpeed + 1e-9);
  });
});

describe('crouching', () => {
  it('lowers the eye smoothly over crouchTime and raises it again', () => {
    const d = driver();
    d.hold({ buttons: Button.Crouch }).run(1);
    expect(d.player.crouched).toBe(true);
    expect(d.player.eyeHeight).toBeLessThan(PLAYER_BODY.standEyeHeight);
    expect(d.player.eyeHeight).toBeGreaterThan(PLAYER_BODY.crouchEyeHeight);
    d.run(Math.ceil(MOVEMENT.crouchTime / DT));
    expect(d.player.eyeHeight).toBeCloseTo(PLAYER_BODY.crouchEyeHeight, 6);
    d.hold({}).run(Math.ceil(MOVEMENT.crouchTime / DT) + 1);
    expect(d.player.crouched).toBe(false);
    expect(d.player.eyeHeight).toBeCloseTo(PLAYER_BODY.standEyeHeight, 6);
  });

  it('cannot stand up under a low ceiling, and stands once clear', () => {
    // A 1.5 m high tunnel roof from z = -1 to z = -6 (north of the spawn).
    const d = driver([box(-3, 1.5, -6, 3, 3, -1)]);
    d.hold({ forward: 1, buttons: Button.Crouch }).run(120);
    expect(d.player.z).toBeLessThan(-2);
    expect(d.player.z).toBeGreaterThan(-6);
    d.hold({ forward: 0 }).run(5);
    // Released crouch inside the tunnel: still crouched.
    expect(d.player.crouched).toBe(true);
    d.hold({ forward: 1 }).run(90);
    expect(d.player.z).toBeLessThan(-7);
    expect(d.player.crouched).toBe(false);
  });

  it('crouch-jumps onto a box too tall for a plain jump', () => {
    const tall = 1.45;
    const plain = driver([box(-2, 0, -4, 2, tall, -2)]);
    plain.hold({ forward: 1 }).run(20).tapJump().run(60);
    expect(plain.player.y).toBeLessThan(0.5);

    const tuck = driver([box(-2, 0, -4, 2, tall, -2)]);
    tuck.hold({ forward: 1 }).run(20).tapJump();
    tuck.hold({ forward: 1, buttons: Button.Crouch }).run(60);
    expect(tuck.player.y).toBeCloseTo(tall + SKIN, 2);
  });

  it('crouch-jumps when jump and crouch are pressed on the same tick', () => {
    const tall = 1.45;
    const d = driver([box(-2, 0, -4, 2, tall, -2)]);
    d.hold({ forward: 1 }).run(20);
    d.hold({ forward: 1, buttons: Button.Jump | Button.Crouch }).run(1);
    d.hold({ forward: 1, buttons: Button.Crouch }).run(60);
    expect(d.player.y).toBeCloseTo(tall + SKIN, 2);
  });

  it('keeps the eye in place when tucking the feet in mid-air', () => {
    const d = driver();
    d.tapJump().run(10);
    const eye = d.player.y + d.player.eyeHeight;
    d.hold({ buttons: Button.Crouch }).run(1);
    const after = d.player.y + d.player.eyeHeight;
    // Only the normal fall of one tick separates them.
    expect(Math.abs(after - eye)).toBeLessThan(0.2);
    expect(d.player.crouched).toBe(true);
  });
});

describe('ledges', () => {
  it('jumps onto a 1 m crate from a run', () => {
    const d = driver([box(-2, 0, -20, 2, 1, -4)]);
    d.hold({ forward: 1 }).run(20).tapJump().run(60);
    expect(d.player.z).toBeLessThan(-4);
    expect(d.player.onGround).toBe(true);
    expect(d.player.y).toBeCloseTo(1 + SKIN, 3);
  });

  it('stands on a ledge edge with most of the body hanging over, then drops off cleanly', () => {
    // Platform top at 1 m, its east edge at x = 0. Walk east slowly until falling.
    const d = driver([box(-6, 0, -3, 0, 1, 3)], -1, 0, 1);
    d.hold({ forward: 1, yaw: EAST, buttons: Button.Walk });
    let lastGroundedX = -Infinity;
    let minY = Infinity;
    d.runUntil(() => {
      if (d.player.onGround) {
        lastGroundedX = d.player.x;
        minY = Math.min(minY, d.player.y);
      }
      return !d.player.onGround;
    }, 120);
    // Flat base: stays level on the edge (no rolling off) until nearly the whole body is past it.
    // (The 2 cm rounded rim lets it settle by a millimeter or two right at the end.)
    expect(minY).toBeGreaterThan(1 + SKIN - 0.005);
    expect(lastGroundedX).toBeGreaterThan(PLAYER_BODY.radius * 0.8);
    d.hold({}).run(60);
    expect(d.player.onGround).toBe(true);
    expect(d.player.y).toBeCloseTo(SKIN, 3);
  });
});

describe('steps, stairs and slopes', () => {
  for (const h of [0.2, 0.3, 0.45]) {
    it(`walks up a ${h} m step`, () => {
      const d = driver([box(-2, 0, -6, 2, h, -3)]);
      d.hold({ forward: 1 }).run(60);
      expect(d.player.z).toBeLessThan(-3.5);
      expect(d.player.y).toBeCloseTo(h + SKIN, 3);
    });
  }

  it('is blocked by a 0.55 m step', () => {
    const d = driver([box(-2, 0, -6, 2, 0.55, -3)]);
    d.hold({ forward: 1 }).run(60);
    expect(d.player.z).toBeGreaterThan(-3);
    expect(d.player.y).toBeLessThan(0.1);
  });

  it('climbs and descends stairs without leaving the ground', () => {
    // 10 steps of 0.3 m over 5 m, north of the spawn, then a platform.
    const steps: SolidDef[] = [];
    for (let i = 0; i < 10; i++) {
      steps.push(box(-2, 0, -3 - (i + 1) * 0.5, 2, 0.3 * (i + 1), -3 - i * 0.5));
    }
    steps.push(box(-2, 0, -14, 2, 3, -8));
    const d = driver(steps);
    let airTicks = 0;
    let stepped = 0;
    d.hold({ forward: 1 });
    const up = d.runUntil(() => {
      if (!d.player.onGround) airTicks++;
      if (d.player.stepDelta > 0) stepped++;
      return d.player.z < -10;
    }, 200);
    expect(up).toBeGreaterThan(0);
    expect(d.player.y).toBeCloseTo(3 + SKIN, 3);
    expect(airTicks).toBe(0);
    expect(stepped).toBeGreaterThanOrEqual(5);
    // And back down.
    d.hold({ forward: -1 });
    d.runUntil(() => {
      if (!d.player.onGround) airTicks++;
      return d.player.z > -1;
    }, 200);
    expect(d.player.y).toBeCloseTo(SKIN, 3);
    expect(airTicks).toBe(0);
  });

  it('walks up a 30° ramp at full speed along the slope and stays grounded going down', () => {
    const ramp: SolidDef = {
      kind: 'ramp',
      min: [-2, 0, -12],
      max: [2, 4 * Math.tan(deg(30)), -8],
      rise: '-z',
      material: 'grate',
    };
    const d = driver([ramp, box(-2, 0, -20, 2, 4 * Math.tan(deg(30)), -12)]);
    let minAlong = Infinity;
    d.hold({ forward: 1 }).run(150, (i) => {
      if (i > 40 && d.player.z < -8.5 && d.player.z > -11.5) {
        const along =
          Math.hypot(
            d.player.x - d.player.prevX,
            d.player.y - d.player.prevY,
            d.player.z - d.player.prevZ,
          ) / DT;
        minAlong = Math.min(minAlong, along);
      }
    });
    expect(d.player.y).toBeCloseTo(4 * Math.tan(deg(30)) + SKIN, 2);
    expect(minAlong).toBeGreaterThan(MOVEMENT.runSpeed * 0.95);
    let airTicks = 0;
    d.hold({ forward: -1 }).run(150, () => {
      if (!d.player.onGround) airTicks++;
    });
    expect(d.player.y).toBeCloseTo(SKIN, 2);
    expect(airTicks).toBe(0);
  });

  it('cannot walk up a slope steeper than the limit', () => {
    const ramp: SolidDef = {
      kind: 'ramp',
      min: [-2, 0, -8],
      max: [2, 4 * Math.tan(deg(50)), -4],
      rise: '-z',
      material: 'grate',
    };
    const d = driver([ramp]);
    d.hold({ forward: 1 }).run(120);
    expect(d.player.y).toBeLessThan(0.6);
  });
});

describe('collision robustness', () => {
  it('never tunnels through a 5 cm wall, even at absurd speed', () => {
    const d = driver([box(-5, 0, -3.05, 5, 3, -3)]);
    d.sim.setTuning({ ...MOVEMENT, runSpeed: 300, groundAccel: 1000 });
    d.hold({ forward: 1 }).run(60);
    expect(d.player.z).toBeGreaterThan(-3);
    expect(d.player.z).toBeCloseTo(-3 + PLAYER_BODY.radius + SKIN, 2);
  });

  it('never falls through a 5 cm floor at terminal velocity', () => {
    const d = new Driver(testMap([box(-5, 39.95, -5, 5, 40, 5)], 0, 0, 79));
    drivers.push(d);
    d.sim.setTuning({ ...MOVEMENT, maxFallSpeed: 120 });
    d.run(200);
    expect(d.player.onGround).toBe(true);
    expect(d.player.y).toBeCloseTo(40 + SKIN, 2);
  });

  it('slides along a wall at a steady speed with no stalls (plain, seamed, tiled)', () => {
    const cases: [string, SolidDef[]][] = [
      ['solid wall', [box(-60, 0, -3, 60, 3, -2)]],
      [
        'wall of 0.7 m segments on 1 m floor tiles',
        (() => {
          const s: SolidDef[] = [];
          for (let x = -60; x < 60; x += 0.7) s.push(box(x, 0, -3, x + 0.7, 3, -2));
          for (let x = -60; x < 60; x++) s.push(box(x, -0.5, -3, x + 1, 0, 3));
          return s;
        })(),
      ],
    ];
    for (const [name, solids] of cases) {
      for (const angle of [10, 30, 45, 60, 80]) {
        // Face north-east at `angle` degrees off the wall's direction (east), pushing into it.
        const d = new Driver(testMap(solids, -50, -1));
        drivers.push(d);
        d.settle(10);
        d.hold({ forward: 1, yaw: deg(-90 + angle) });
        // Run until pressed against the wall and up to speed along it.
        d.runUntil(() => d.player.z < -1.5, 300);
        d.run(30);
        let stalls = 0;
        let maxSpeed = 0;
        const expected = MOVEMENT.runSpeed * Math.cos(deg(angle)) * DT;
        d.run(240, () => {
          if (d.player.x - d.player.prevX < expected * 0.8) stalls++;
          maxSpeed = Math.max(maxSpeed, d.player.speed);
        });
        expect(stalls, `${name} at ${angle}°`).toBe(0);
        expect(maxSpeed, `${name} at ${angle}°`).toBeLessThanOrEqual(MOVEMENT.runSpeed + 1e-9);
        expect(d.player.onGround, `${name} at ${angle}°`).toBe(true);
      }
    }
  });

  it('rests still in a concave corner and leaves it freely', () => {
    const d = driver([box(-5, 0, -3, 5, 3, -2), box(1, 0, -5, 2, 3, 5)]);
    d.hold({ forward: 1, yaw: deg(-45) }).run(120);
    const x = d.player.x;
    const z = d.player.z;
    let jitter = 0;
    d.run(60, () => {
      jitter = Math.max(jitter, Math.hypot(d.player.x - x, d.player.z - z));
    });
    expect(jitter).toBeLessThan(1e-3);
    d.hold({ forward: 1, yaw: deg(135) }).run(60);
    expect(Math.hypot(d.player.x - x, d.player.z - z)).toBeGreaterThan(4);
  });

  it('squeezes through a gap just wider than the body', () => {
    const gap = PLAYER_BODY.radius * 2 + 0.08;
    const d = driver([box(-5, 0, -6, -gap / 2, 3, -3), box(gap / 2, 0, -6, 5, 3, -3)]);
    d.hold({ forward: 1 }).run(90);
    expect(d.player.z).toBeLessThan(-6.5);
  });

  it('is deterministic for the same input script', () => {
    const script = (d: Driver): number[] => {
      d.hold({ forward: 1, strafe: 1, yaw: deg(20) })
        .run(40)
        .tapJump()
        .run(30);
      d.hold({ strafe: -1, buttons: Button.Crouch, yaw: deg(-70) }).run(50);
      d.hold({ forward: 1, buttons: Button.Walk }).run(30);
      return [d.player.x, d.player.y, d.player.z, d.player.vx, d.player.vy, d.player.vz];
    };
    const a = driver([box(2, 0, -4, 4, 1, -2), box(-6, 0, 3, -4, 0.4, 6)]);
    const b = driver([box(2, 0, -4, 4, 1, -2), box(-6, 0, 3, -4, 0.4, 6)]);
    expect(script(a)).toEqual(script(b));
  });

  it('clamps pitch and wraps yaw', () => {
    const d = driver();
    d.cmd.pitch = 3;
    d.cmd.yaw = Math.PI * 5;
    d.run(1);
    expect(d.player.pitch).toBeLessThan(Math.PI / 2);
    expect(d.player.yaw).toBeGreaterThanOrEqual(-Math.PI);
    expect(d.player.yaw).toBeLessThan(Math.PI);
  });
});
