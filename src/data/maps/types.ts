import type { EnemyId } from '../enemies';
import type { Vec2 } from '../../logic/vec';

export type TileKind = 'ground' | 'path' | 'wall' | 'void' | 'floor' | 'gate' | 'grass';

export type PropKind =
  | 'house-ruin'
  | 'fence'
  | 'dead-tree'
  | 'pine-dead'
  | 'gravestone'
  | 'grave-cross'
  | 'torch'
  | 'campfire'
  | 'rock'
  | 'cliff-rock'
  | 'cart'
  | 'well'
  | 'crypt-gate'
  | 'pillar'
  | 'coffin'
  | 'bones'
  | 'candles'
  | 'brazier'
  | 'cobweb'
  | 'stone-wall'
  | 'altar'
  | 'barrel'
  | 'stairs-down'
  | 'statue'
  | 'banner';

export type PropPlacement = {
  kind: PropKind;
  x: number;
  z: number;
  rot?: number;
  scale?: number;
  /** footprint in cells to block, centered on x,z (default: per-kind) */
  block?: { w: number; d: number } | false;
  seed?: number;
};

export type SpawnDef = { enemy: EnemyId; x: number; z: number; group: string; facing?: number; aggro?: number };

export type TriggerDef = { id: string; x: number; z: number; radius: number };

export type GateDef = { id: string; cells: [number, number][]; x: number; z: number; rot: number };

export type MapDef = {
  id: 'emberfall' | 'crypt';
  index: 1 | 2;
  nameKey: string;
  size: { w: number; h: number };
  cellSize: number;
  tiles: TileKind[][]; // [z][x]
  props: PropPlacement[];
  spawns: SpawnDef[];
  triggers: TriggerDef[];
  gates: GateDef[];
  npcs: { id: 'elder'; x: number; z: number; facing: number }[];
  playerStart: Vec2;
  playerFacing: number;
  checkpoints: { id: string; x: number; z: number }[];
  ambience: {
    background: number;
    fog: number;
    fogNear: number;
    fogFar: number;
    moon: number;
    moonIntensity: number;
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    ash: boolean;
    dust: boolean;
  };
};

/** Small deterministic hash noise for map generation. */
export function hash2(x: number, z: number, seed = 0): number {
  let h = (x * 374761393 + z * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

export function makeTiles(w: number, h: number, fill: TileKind): TileKind[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

export function fillRect(t: TileKind[][], x0: number, z0: number, x1: number, z1: number, k: TileKind): void {
  for (let z = Math.max(0, z0); z <= Math.min(t.length - 1, z1); z++)
    for (let x = Math.max(0, x0); x <= Math.min(t[0].length - 1, x1); x++) t[z][x] = k;
}

/** Thick polyline brush (used to carve paths and corridors). */
export function brushLine(t: TileKind[][], pts: [number, number][], radius: number, k: TileKind, only?: TileKind[]): void {
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(len * 3);
    for (let s = 0; s <= steps; s++) {
      const px = ax + ((bx - ax) * s) / steps;
      const pz = az + ((bz - az) * s) / steps;
      for (let z = Math.floor(pz - radius); z <= Math.ceil(pz + radius); z++)
        for (let x = Math.floor(px - radius); x <= Math.ceil(px + radius); x++) {
          if (z < 0 || x < 0 || z >= t.length || x >= t[0].length) continue;
          if (Math.hypot(x + 0.5 - px, z + 0.5 - pz) > radius) continue;
          if (only && !only.includes(t[z][x])) continue;
          t[z][x] = k;
        }
    }
  }
}
