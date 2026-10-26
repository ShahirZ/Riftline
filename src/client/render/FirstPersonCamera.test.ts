import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { Player } from '../../sim/player/Player';
import { FirstPersonCamera, verticalFov } from './FirstPersonCamera';

const EYE = 1.62;

function standing(): Player {
  const p = new Player(0, 'attacker', EYE);
  p.place(0, 0, 0, 0, EYE);
  return p;
}

describe('verticalFov', () => {
  it('keeps the horizontal FOV at 16:9', () => {
    const v = (verticalFov(90) * Math.PI) / 180;
    const h = 2 * Math.atan(Math.tan(v / 2) * (16 / 9));
    expect((h * 180) / Math.PI).toBeCloseTo(90, 6);
    expect(verticalFov(100)).toBeGreaterThan(verticalFov(90));
  });
});

describe('FirstPersonCamera', () => {
  it('puts the camera at the eye and applies view angles directly', () => {
    const cam = new PerspectiveCamera();
    const view = new FirstPersonCamera();
    view.update(cam, standing(), 0, 0.3, -0.2, 1 / 60);
    expect(cam.position.y).toBeCloseTo(EYE, 6);
    expect(cam.rotation.y).toBeCloseTo(0.3);
    expect(cam.rotation.x).toBeCloseTo(-0.2);
    expect(cam.rotation.order).toBe('YXZ');
  });

  it('smooths a step up instead of jumping the view', () => {
    const view = new FirstPersonCamera();
    const p = standing();
    p.stepDelta = 0.4;
    view.afterTick(p);
    expect(view.offset).toBeCloseTo(-0.4, 6);
    p.stepDelta = 0;
    for (let i = 0; i < 8; i++) view.afterTick(p);
    expect(view.offset).toBeLessThan(0);
    expect(view.offset).toBeGreaterThan(-0.05);
  });

  it('dips a few centimeters on a hard landing and recovers', () => {
    const cam = new PerspectiveCamera();
    const view = new FirstPersonCamera();
    const p = standing();
    p.landedImpact = 6.5;
    view.afterTick(p);
    let lowest = 0;
    for (let i = 0; i < 60; i++) {
      view.update(cam, p, 0, 0, 0, 1 / 60);
      lowest = Math.min(lowest, cam.position.y - EYE);
    }
    expect(lowest).toBeLessThan(-0.02);
    expect(lowest).toBeGreaterThan(-0.09);
    expect(Math.abs(cam.position.y - EYE)).toBeLessThan(0.005);
  });
});
