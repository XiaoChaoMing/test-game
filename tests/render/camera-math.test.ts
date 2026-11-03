import { describe, expect, it } from 'vitest';
import { isoOffset } from '../../src/render/camera-math';

describe('isoOffset', () => {
  it('places the camera at 35deg pitch, 45deg yaw, at the given distance', () => {
    const o = isoOffset(10);
    expect(o.y).toBeCloseTo(10 * Math.sin((35 * Math.PI) / 180), 5);
    expect(o.x).toBeCloseTo(o.z, 5);
    expect(Math.hypot(o.x, o.y, o.z)).toBeCloseTo(10, 5);
  });
});
