import type { Vec2 } from './vec';

export type CellRef = { cx: number; cz: number };

export class NavGrid {
  private readonly blocked: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly cellSize: number,
    readonly origin: Vec2,
  ) {
    this.blocked = new Uint8Array(width * height);
  }

  inBounds(cx: number, cz: number): boolean {
    return cx >= 0 && cz >= 0 && cx < this.width && cz < this.height;
  }

  setBlocked(cx: number, cz: number, b: boolean): void {
    if (this.inBounds(cx, cz)) this.blocked[cz * this.width + cx] = b ? 1 : 0;
  }

  isWalkable(cx: number, cz: number): boolean {
    return this.inBounds(cx, cz) && this.blocked[cz * this.width + cx] === 0;
  }

  worldToCell(p: Vec2): CellRef {
    return {
      cx: Math.floor((p.x - this.origin.x) / this.cellSize),
      cz: Math.floor((p.z - this.origin.z) / this.cellSize),
    };
  }

  cellToWorld(cx: number, cz: number): Vec2 {
    return {
      x: this.origin.x + (cx + 0.5) * this.cellSize,
      z: this.origin.z + (cz + 0.5) * this.cellSize,
    };
  }

  isWalkableWorld(p: Vec2): boolean {
    const c = this.worldToCell(p);
    return this.isWalkable(c.cx, c.cz);
  }

  /** Nearest walkable cell by ring search (Chebyshev rings, then Euclidean tie-break). */
  nearestWalkable(cx: number, cz: number, maxRadius = 8): CellRef | null {
    const ccx = Math.min(Math.max(cx, 0), this.width - 1);
    const ccz = Math.min(Math.max(cz, 0), this.height - 1);
    if (this.isWalkable(ccx, ccz) && ccx === cx && ccz === cz) return { cx, cz };
    let best: CellRef | null = null;
    let bestD = Infinity;
    const startR = ccx === cx && ccz === cz ? 1 : 0;
    for (let r = startR; r <= maxRadius; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = ccx + dx;
          const z = ccz + dz;
          if (!this.isWalkable(x, z)) continue;
          const d = (x - cx) ** 2 + (z - cz) ** 2;
          if (d < bestD) {
            bestD = d;
            best = { cx: x, cz: z };
          }
        }
      }
      if (best) return best;
    }
    return null;
  }
}
