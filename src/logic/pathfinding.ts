import type { NavGrid } from './grid';
import { circleFits } from './collision';
import type { Vec2 } from './vec';

const SQRT2 = Math.SQRT2;
const SMOOTH_RADIUS = 0.3;

class MinHeap {
  private items: number[] = [];
  private prio: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: number, p: number): void {
    this.items.push(item);
    this.prio.push(p);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent] <= this.prio[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }
  pop(): number {
    const top = this.items[0];
    const lastI = this.items.pop()!;
    const lastP = this.prio.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastI;
      this.prio[0] = lastP;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.prio[l] < this.prio[m]) m = l;
        if (r < this.items.length && this.prio[r] < this.prio[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.prio[a], this.prio[b]] = [this.prio[b], this.prio[a]];
  }
}

const octile = (ax: number, az: number, bx: number, bz: number): number => {
  const dx = Math.abs(ax - bx);
  const dz = Math.abs(az - bz);
  return dx + dz + (SQRT2 - 2) * Math.min(dx, dz);
};

/** Cells touched by segment a→b (supercover DDA). Returns false at the first blocked cell. */
function segmentClear(grid: NavGrid, a: Vec2, b: Vec2): boolean {
  const cs = grid.cellSize;
  const ax = (a.x - grid.origin.x) / cs;
  const az = (a.z - grid.origin.z) / cs;
  const bx = (b.x - grid.origin.x) / cs;
  const bz = (b.z - grid.origin.z) / cs;
  let cx = Math.floor(ax);
  let cz = Math.floor(az);
  const ex = Math.floor(bx);
  const ez = Math.floor(bz);
  if (!grid.isWalkable(cx, cz)) return false;
  const dx = bx - ax;
  const dz = bz - az;
  const stepX = dx > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tMaxX = dx !== 0 ? (dx > 0 ? cx + 1 - ax : ax - cx) * tDeltaX : Infinity;
  let tMaxZ = dz !== 0 ? (dz > 0 ? cz + 1 - az : az - cz) * tDeltaZ : Infinity;
  let guard = 0;
  while ((cx !== ex || cz !== ez) && guard++ < 10000) {
    if (Math.abs(tMaxX - tMaxZ) < 1e-9) {
      // passing exactly through a corner: both side cells must be open
      if (!grid.isWalkable(cx + stepX, cz) || !grid.isWalkable(cx, cz + stepZ)) return false;
      cx += stepX;
      cz += stepZ;
      tMaxX += tDeltaX;
      tMaxZ += tDeltaZ;
    } else if (tMaxX < tMaxZ) {
      cx += stepX;
      tMaxX += tDeltaX;
    } else {
      cz += stepZ;
      tMaxZ += tDeltaZ;
    }
    if (tMaxX > 1 + 1e-9 && tMaxZ > 1 + 1e-9 && (cx !== ex || cz !== ez)) {
      // numerical overshoot guard
      if (!grid.isWalkable(cx, cz)) return false;
      break;
    }
    if (!grid.isWalkable(cx, cz)) return false;
  }
  return true;
}

export function hasLineOfSight(grid: NavGrid, a: Vec2, b: Vec2, radius = 0): boolean {
  if (!segmentClear(grid, a, b)) return false;
  if (radius <= 0) return true;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l = Math.hypot(dx, dz);
  if (l < 1e-6) return true;
  const px = (-dz / l) * radius;
  const pz = (dx / l) * radius;
  return (
    segmentClear(grid, { x: a.x + px, z: a.z + pz }, { x: b.x + px, z: b.z + pz }) &&
    segmentClear(grid, { x: a.x - px, z: a.z - pz }, { x: b.x - px, z: b.z - pz })
  );
}

const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

/** A* (8-dir, no corner cutting) + string-pulling. Returns world waypoints excluding the start. */
export function findPath(grid: NavGrid, from: Vec2, to: Vec2, radius = 0): Vec2[] {
  const s0 = grid.worldToCell(from);
  const start = grid.isWalkable(s0.cx, s0.cz) ? s0 : grid.nearestWalkable(s0.cx, s0.cz, 3);
  const t0 = grid.worldToCell(to);
  const targetExact = grid.isWalkable(t0.cx, t0.cz);
  const goal = targetExact ? t0 : grid.nearestWalkable(t0.cx, t0.cz, 8);
  if (!start || !goal) return [];

  const w = grid.width;
  const startId = start.cz * w + start.cx;
  const goalId = goal.cz * w + goal.cx;
  let endPoint = targetExact ? { x: to.x, z: to.z } : grid.cellToWorld(goal.cx, goal.cz);
  // a click hugging a wall: aim for the cell centre so the agent can actually arrive
  if (radius > 0 && !circleFits(grid, endPoint, radius)) endPoint = grid.cellToWorld(goal.cx, goal.cz);
  if (startId === goalId) return [endPoint];

  const g = new Float64Array(w * grid.height).fill(Infinity);
  const came = new Int32Array(w * grid.height).fill(-1);
  const closed = new Uint8Array(w * grid.height);
  const open = new MinHeap();
  g[startId] = 0;
  open.push(startId, octile(start.cx, start.cz, goal.cx, goal.cz));
  let found = false;
  let expanded = 0;
  while (open.size > 0 && expanded < 20000) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    expanded++;
    if (cur === goalId) {
      found = true;
      break;
    }
    const cx = cur % w;
    const cz = (cur - cx) / w;
    for (const [dx, dz, cost] of DIRS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!grid.isWalkable(nx, nz)) continue;
      if (dx !== 0 && dz !== 0 && (!grid.isWalkable(cx + dx, cz) || !grid.isWalkable(cx, cz + dz))) continue;
      const nid = nz * w + nx;
      if (closed[nid]) continue;
      const ng = g[cur] + cost;
      if (ng < g[nid]) {
        g[nid] = ng;
        came[nid] = cur;
        open.push(nid, ng + octile(nx, nz, goal.cx, goal.cz));
      }
    }
  }
  if (!found) return [];

  const cells: Vec2[] = [];
  for (let id = goalId; id !== -1 && id !== startId; id = came[id]) {
    const cx = id % w;
    cells.push(grid.cellToWorld(cx, (id - cx) / w));
  }
  cells.reverse();
  cells[cells.length - 1] = endPoint;

  // string pulling from the actual start position
  const out: Vec2[] = [];
  let anchor: Vec2 = from;
  let i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !hasLineOfSight(grid, anchor, cells[j], SMOOTH_RADIUS)) j--;
    out.push(cells[j]);
    anchor = cells[j];
    i = j + 1;
  }
  return out;
}
