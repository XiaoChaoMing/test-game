import type { NavGrid } from './grid';
import type { Vec2 } from './vec';

const EPS = 1e-6;
const MAX_STEP = 0.25;

/** Square-footprint overlap test against blocked cells (out of bounds = blocked). */
function overlapsBlocked(grid: NavGrid, x: number, z: number, r: number): boolean {
  const cs = grid.cellSize;
  const x0 = Math.floor((x - r + EPS - grid.origin.x) / cs);
  const x1 = Math.floor((x + r - EPS - grid.origin.x) / cs);
  const z0 = Math.floor((z - r + EPS - grid.origin.z) / cs);
  const z1 = Math.floor((z + r - EPS - grid.origin.z) / cs);
  for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) if (!grid.isWalkable(cx, cz)) return true;
  return false;
}

function resolveAxis(grid: NavGrid, x: number, z: number, d: number, r: number, axis: 'x' | 'z'): number {
  const cs = grid.cellSize;
  const o = axis === 'x' ? grid.origin.x : grid.origin.z;
  const cur = axis === 'x' ? x : z;
  const next = cur + d;
  const blocked = axis === 'x' ? overlapsBlocked(grid, next, z, r) : overlapsBlocked(grid, x, next, r);
  if (!blocked) return next;
  if (d > 0) {
    const edge = Math.floor((next + r - o) / cs) * cs + o;
    return Math.max(cur, edge - r);
  }
  const edge = (Math.floor((next - r - o) / cs) + 1) * cs + o;
  return Math.min(cur, edge + r);
}

export function moveWithCollision(grid: NavGrid, pos: Vec2, delta: Vec2, radius: number): Vec2 {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.z)) / MAX_STEP));
  let x = pos.x;
  let z = pos.z;
  for (let i = 0; i < steps; i++) {
    x = resolveAxis(grid, x, z, delta.x / steps, radius, 'x');
    z = resolveAxis(grid, x, z, delta.z / steps, radius, 'z');
  }
  return { x, z };
}

export function separate(a: Vec2, ra: number, b: Vec2, rb: number): Vec2 {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const d = Math.hypot(dx, dz);
  const overlap = ra + rb - d;
  if (overlap <= 0) return { x: 0, z: 0 };
  if (d < 1e-6) return { x: overlap / 2, z: 0 };
  return { x: (dx / d) * (overlap / 2), z: (dz / d) * (overlap / 2) };
}

/** Last point along from→to where a circle of `radius` fits. */
export function castToWalkable(grid: NavGrid, from: Vec2, to: Vec2, radius: number): Vec2 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const l = Math.hypot(dx, dz);
  if (l < 1e-6) return { x: from.x, z: from.z };
  const step = 0.05;
  const n = Math.ceil(l / step);
  let last: Vec2 = { x: from.x, z: from.z };
  for (let i = 1; i <= n; i++) {
    const t = Math.min(1, (i * step) / l);
    const p = { x: from.x + dx * t, z: from.z + dz * t };
    if (overlapsBlocked(grid, p.x, p.z, radius)) return last;
    last = p;
  }
  return { x: to.x, z: to.z };
}

export function circleFits(grid: NavGrid, p: Vec2, radius: number): boolean {
  return !overlapsBlocked(grid, p.x, p.z, radius);
}
