import { describe, expect, it } from 'vitest';
import { NavGrid } from '../../src/logic/grid';
import { castToWalkable, moveWithCollision, separate } from '../../src/logic/collision';

const wallGrid = () => {
  const g = new NavGrid(10, 10, 1, { x: 0, z: 0 });
  for (let z = 0; z < 10; z++) g.setBlocked(5, z, true);
  return g;
};

describe('moveWithCollision', () => {
  it('keeps the circle out of a wall but keeps tangential motion', () => {
    const g = wallGrid();
    const r = 0.4;
    const p = moveWithCollision(g, { x: 4.5, z: 3 }, { x: 1, z: 1 }, r);
    expect(p.x).toBeLessThanOrEqual(5 - r + 1e-6);
    expect(p.z).toBeCloseTo(4);
  });

  it('moves freely in open space', () => {
    const g = wallGrid();
    expect(moveWithCollision(g, { x: 1.5, z: 1.5 }, { x: 0.5, z: 0.25 }, 0.4)).toEqual({ x: 2, z: 1.75 });
  });
});

describe('castToWalkable', () => {
  it('stops before a wall (Charge into a wall)', () => {
    const g = wallGrid();
    const p = castToWalkable(g, { x: 1.5, z: 3.5 }, { x: 9, z: 3.5 }, 0.4);
    expect(p.x).toBeLessThanOrEqual(5 - 0.4 + 1e-6);
    expect(p.x).toBeGreaterThan(4);
    expect(p.z).toBeCloseTo(3.5);
  });

  it('reaches an unobstructed destination', () => {
    const g = wallGrid();
    expect(castToWalkable(g, { x: 1.5, z: 3.5 }, { x: 3.5, z: 3.5 }, 0.4)).toEqual({ x: 3.5, z: 3.5 });
  });
});

describe('separate', () => {
  it('pushes overlapping circles apart along the center line', () => {
    const push = separate({ x: 0, z: 0 }, 0.5, { x: 0.6, z: 0 }, 0.5);
    expect(push.x).toBeCloseTo(-0.2);
    expect(push.z).toBeCloseTo(0);
  });
  it('returns zero when not overlapping', () => {
    expect(separate({ x: 0, z: 0 }, 0.5, { x: 2, z: 0 }, 0.5)).toEqual({ x: 0, z: 0 });
  });
});
