import { describe, expect, it } from 'vitest';
import { NavGrid } from '../../src/logic/grid';
import { findPath, hasLineOfSight } from '../../src/logic/pathfinding';

const open = () => new NavGrid(10, 10, 1, { x: 0, z: 0 });

describe('findPath', () => {
  it('reaches the target on an open grid with a smoothed path', () => {
    const p = findPath(open(), { x: 0.5, z: 0.5 }, { x: 8.5, z: 8.5 });
    expect(p.length).toBeGreaterThan(0);
    expect(p.length).toBeLessThanOrEqual(2);
    expect(p[p.length - 1]).toEqual({ x: 8.5, z: 8.5 });
  });

  it('routes around a wall without any segment crossing a blocked cell', () => {
    const g = open();
    for (let z = 0; z <= 8; z++) g.setBlocked(5, z, true);
    const start = { x: 0.5, z: 0.5 };
    const p = findPath(g, start, { x: 8.5, z: 0.5 });
    expect(p.length).toBeGreaterThan(1);
    let prev = start;
    for (const wp of p) {
      expect(hasLineOfSight(g, prev, wp)).toBe(true);
      prev = wp;
    }
    expect(p[p.length - 1]).toEqual({ x: 8.5, z: 0.5 });
  });

  it('targets the nearest walkable cell when the click is inside a wall', () => {
    const g = open();
    g.setBlocked(5, 5, true);
    const p = findPath(g, { x: 0.5, z: 5.5 }, { x: 5.5, z: 5.5 });
    const end = p[p.length - 1];
    expect(g.isWalkableWorld(end)).toBe(true);
    expect(Math.hypot(end.x - 5.5, end.z - 5.5)).toBeLessThanOrEqual(1.01);
  });

  it('clamps targets outside the grid to the nearest walkable cell inside', () => {
    const p = findPath(open(), { x: 0.5, z: 0.5 }, { x: 30, z: 4.5 });
    const end = p[p.length - 1];
    expect(end.x).toBeCloseTo(9.5);
    expect(end.z).toBeCloseTo(4.5);
  });

  it('returns [] for a fully enclosed target', () => {
    const g = open();
    for (const [x, z] of [[4, 4], [5, 4], [6, 4], [4, 5], [6, 5], [4, 6], [5, 6], [6, 6]]) g.setBlocked(x, z, true);
    expect(findPath(g, { x: 0.5, z: 0.5 }, { x: 5.5, z: 5.5 })).toEqual([]);
  });

  it('never cuts a blocked corner diagonally', () => {
    const g = new NavGrid(3, 3, 1, { x: 0, z: 0 });
    g.setBlocked(1, 0, true);
    g.setBlocked(0, 1, true);
    // (0,0) is sealed diagonally: only exit would be a corner cut to (1,1)
    expect(findPath(g, { x: 0.5, z: 0.5 }, { x: 2.5, z: 2.5 })).toEqual([]);
  });
});

describe('hasLineOfSight', () => {
  it('is blocked by a wall cell between points', () => {
    const g = open();
    g.setBlocked(5, 5, true);
    expect(hasLineOfSight(g, { x: 2.5, z: 5.5 }, { x: 8.5, z: 5.5 })).toBe(false);
    expect(hasLineOfSight(g, { x: 2.5, z: 2.5 }, { x: 8.5, z: 2.5 })).toBe(true);
  });
});

describe('findPath with an agent radius', () => {
  it('pushes a click hugging a wall out so the agent can actually reach the endpoint', () => {
    const g = new NavGrid(10, 10, 1, { x: 0, z: 0 });
    for (let z = 0; z < 10; z++) g.setBlocked(5, z, true);
    const p = findPath(g, { x: 1.5, z: 2.5 }, { x: 4.95, z: 2.5 }, 0.45);
    const end = p[p.length - 1];
    expect(end.x).toBeLessThanOrEqual(5 - 0.45 + 1e-6);
  });
});
