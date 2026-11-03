import { PALETTE } from '../../render/palette';
import { brushLine, fillRect, hash2, makeTiles, type MapDef, type PropPlacement, type SpawnDef } from './types';

const W = 48;
const H = 48;

function build(): MapDef {
  const tiles = makeTiles(W, H, 'ground');

  // noisy cliff border
  for (let z = 0; z < H; z++)
    for (let x = 0; x < W; x++) {
      const edge = Math.min(x, z, W - 1 - x, H - 1 - z);
      const n = hash2(Math.floor(x / 3), Math.floor(z / 3), 7) * 2.5 + hash2(x, z, 3) * 0.8;
      if (edge < 1.5 + n) tiles[z][x] = 'wall';
    }

  // main road
  const road: [number, number][] = [[11, 45], [12, 41], [16, 36], [20, 32], [24, 28], [28, 25], [31, 21], [34, 16], [35, 12], [35, 6]];
  brushLine(tiles, road, 1.6, 'ground');
  brushLine(tiles, road, 1.0, 'path');
  // side spurs
  brushLine(tiles, [[20, 32], [14, 30], [10, 33]], 0.9, 'path');
  brushLine(tiles, [[31, 21], [37, 21], [41, 21]], 0.8, 'path');
  // village clearing
  fillRect(tiles, 16, 27, 25, 34, 'ground');
  brushLine(tiles, [[18, 29], [23, 32]], 1.0, 'path');
  // grass patches (visual only)
  for (let z = 0; z < H; z++)
    for (let x = 0; x < W; x++) if (tiles[z][x] === 'ground' && hash2(x, z, 11) > 0.86) tiles[z][x] = 'grass';

  // graveyard: walled yard x 27..44, z 3..12 with an opening south and the crypt north
  const props: PropPlacement[] = [];
  for (let x = 27; x <= 44; x++) {
    if (x < 33 || x > 37) props.push({ kind: 'stone-wall', x: x + 0.5, z: 12.5, block: { w: 1, d: 1 } });
    if (x < 33 || x > 37) props.push({ kind: 'stone-wall', x: x + 0.5, z: 3.5, block: { w: 1, d: 1 } });
  }
  for (let z = 4; z <= 12; z++) {
    props.push({ kind: 'stone-wall', x: 27.5, z: z + 0.5, rot: Math.PI / 2, block: { w: 1, d: 1 } });
    props.push({ kind: 'stone-wall', x: 44.5, z: z + 0.5, rot: Math.PI / 2, block: { w: 1, d: 1 } });
  }
  fillRect(tiles, 28, 4, 43, 11, 'ground');
  brushLine(tiles, [[35, 12], [35, 4]], 1.0, 'path');
  // crypt entrance (mausoleum) north of the yard
  fillRect(tiles, 31, 0, 39, 3, 'wall');
  fillRect(tiles, 34, 1, 36, 3, 'path');
  props.push({ kind: 'crypt-gate', x: 35.5, z: 2.2, block: false });
  for (let gx = 0; gx < 8; gx++)
    for (let gz = 0; gz < 3; gz++) {
      const x = 29.5 + gx * 2 + (gx >= 3 ? 2.2 : 0);
      if (x > 43) continue;
      const z = 5.5 + gz * 2.6;
      if (Math.abs(x - 35.5) < 1.8) continue;
      props.push({ kind: hash2(gx, gz, 5) > 0.5 ? 'gravestone' : 'grave-cross', x, z, rot: (hash2(gx, gz, 9) - 0.5) * 0.5, seed: gx * 7 + gz, block: { w: 1, d: 1 } });
    }
  props.push({ kind: 'dead-tree', x: 30, z: 10.5, scale: 1.3, seed: 3 }, { kind: 'dead-tree', x: 42, z: 5.5, scale: 1.2, seed: 8 });
  props.push({ kind: 'statue', x: 33, z: 4.6, block: { w: 1, d: 1 } }, { kind: 'statue', x: 38, z: 4.6, block: { w: 1, d: 1 } });

  // village
  props.push(
    { kind: 'campfire', x: 20, z: 30.4, block: { w: 1, d: 1 } },
    { kind: 'house-ruin', x: 13.5, z: 26.5, rot: 0.25, seed: 1 },
    { kind: 'house-ruin', x: 27, z: 33.5, rot: -0.35, seed: 2 },
    { kind: 'house-ruin', x: 25.5, z: 20.5, rot: 0.1, seed: 3 },
    { kind: 'house-ruin', x: 8.5, z: 37.5, rot: -0.15, seed: 4 },
    { kind: 'house-ruin', x: 18, z: 39, rot: 0.6, seed: 5 },
    { kind: 'well', x: 23.5, z: 26.5, block: { w: 2, d: 2 } },
    { kind: 'cart', x: 15.5, z: 32.5, rot: 0.8, block: { w: 2, d: 1 } },
    { kind: 'barrel', x: 24.2, z: 32.3 },
    { kind: 'barrel', x: 25, z: 31.6 },
    { kind: 'banner', x: 17.2, z: 28.2, rot: 0.4 },
  );
  // fences along the road
  for (let i = 0; i < 6; i++) props.push({ kind: 'fence', x: 14.5 + i * 0.95, z: 41 - i * 1.1, rot: -0.75 + Math.PI / 2 });
  for (let i = 0; i < 5; i++) props.push({ kind: 'fence', x: 27.5 + i * 0.9, z: 28.5 - i * 0.95, rot: -0.8 + Math.PI / 2 });
  // torches along the road (lights)
  const torchSpots: [number, number][] = [[13.5, 42.5], [10, 40], [17.8, 35.4], [14.2, 34.6], [18, 30], [22.6, 33], [22.6, 28], [26, 24.8], [29.8, 26.6], [32.6, 22.8], [29.6, 19.4], [36.4, 15.6], [32.8, 13.4], [37.2, 13.4]];
  for (const [x, z] of torchSpots) props.push({ kind: 'torch', x, z });

  // trees and rocks on free ground away from the road
  const roadNear = (x: number, z: number) => {
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        const t = tiles[z + dz]?.[x + dx];
        if (t === 'path' || t === undefined) return true;
      }
    return false;
  };
  const occupied = new Set(props.map((p) => `${Math.floor(p.x)},${Math.floor(p.z)}`));
  for (let z = 2; z < H - 2; z += 2)
    for (let x = 2; x < W - 2; x += 2) {
      const r = hash2(x, z, 21);
      const jx = x + 0.5 + (hash2(x, z, 22) - 0.5) * 1.2;
      const jz = z + 0.5 + (hash2(x, z, 23) - 0.5) * 1.2;
      const cx = Math.floor(jx);
      const cz = Math.floor(jz);
      if (tiles[cz][cx] !== 'ground' && tiles[cz][cx] !== 'grass') continue;
      if (roadNear(cx, cz) || occupied.has(`${cx},${cz}`)) continue;
      if (cx > 15 && cx < 26 && cz > 26 && cz < 35) continue; // keep the clearing open
      if (cx >= 27 && cx <= 44 && cz >= 3 && cz <= 12) continue; // graveyard interior
      if (r > 0.82) props.push({ kind: hash2(x, z, 24) > 0.5 ? 'dead-tree' : 'pine-dead', x: jx, z: jz, scale: 0.8 + hash2(x, z, 25) * 0.6, seed: x * 31 + z, block: { w: 1, d: 1 } });
      else if (r > 0.74) props.push({ kind: 'rock', x: jx, z: jz, scale: 0.6 + hash2(x, z, 26) * 0.8, seed: x * 13 + z, block: hash2(x, z, 27) > 0.5 ? { w: 1, d: 1 } : false });
    }
  // cliff rocks dressing the walls; walls between the play area and the camera (+x/+z side) stay low
  for (let z = 0; z < H; z++)
    for (let x = 0; x < W; x++) {
      if (tiles[z][x] !== 'wall') continue;
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => {
        const t = tiles[z + dz]?.[x + dx];
        return t !== undefined && t !== 'wall';
      });
      const cameraSide = open.some(([dx, dz]) => dx < 0 || dz < 0);
      const deepCameraSide = x > W - 6 || z > H - 6;
      if (cameraSide || deepCameraSide) {
        if (hash2(x, z, 33) > 0.55) props.push({ kind: 'rock', x: x + 0.5, z: z + 0.5, scale: 0.5 + hash2(x, z, 34) * 0.4, seed: x * 5 + z, block: false });
        continue;
      }
      if (open.length > 0 || hash2(x, z, 31) > 0.7) props.push({ kind: 'cliff-rock', x: x + 0.5, z: z + 0.5, scale: 0.9 + hash2(x, z, 32) * 0.8, seed: x * 17 + z * 3, block: false });
    }

  const spawns: SpawnDef[] = [
    { enemy: 'husk', x: 31.5, z: 21.5, group: 'lone', aggro: 7 },
    { enemy: 'husk', x: 34, z: 15.5, group: 'pack', aggro: 7 },
    { enemy: 'husk', x: 35.2, z: 16.8, group: 'pack', aggro: 7 },
    { enemy: 'husk', x: 33.2, z: 17.2, group: 'pack', aggro: 7 },
    { enemy: 'hound', x: 41.5, z: 21.5, group: 'hound', aggro: 5 },
    { enemy: 'husk', x: 31, z: 9, group: 'graveyard' },
    { enemy: 'husk', x: 33, z: 6.5, group: 'graveyard' },
    { enemy: 'husk', x: 38.5, z: 9.5, group: 'graveyard' },
    { enemy: 'husk', x: 40.5, z: 7, group: 'graveyard' },
    { enemy: 'husk', x: 37, z: 5.5, group: 'graveyard' },
    { enemy: 'husk', x: 30, z: 6, group: 'graveyard' },
    { enemy: 'hound', x: 42, z: 10, group: 'graveyard' },
    { enemy: 'hound', x: 29.5, z: 11, group: 'graveyard' },
    { enemy: 'hound', x: 39.5, z: 4.8, group: 'graveyard' },
  ];

  return {
    id: 'emberfall',
    index: 1,
    nameKey: 'map.emberfall',
    size: { w: W, h: H },
    cellSize: 1,
    tiles,
    props,
    spawns,
    triggers: [
      { id: 'elder', x: 21.5, z: 30, radius: 4 },
      { id: 'exit', x: 35.5, z: 1.8, radius: 1.3 },
      { id: 'gate-approach', x: 35.5, z: 5.5, radius: 2 },
    ],
    gates: [{ id: 'crypt', cells: [[34, 3], [35, 3], [36, 3]], x: 35.5, z: 3.5, rot: 0 }],
    npcs: [{ id: 'elder', x: 21.6, z: 29.6, facing: Math.PI * 0.85 }],
    playerStart: { x: 13, z: 40.5 },
    playerFacing: Math.PI,
    checkpoints: [
      { id: 'start', x: 13, z: 40.5 },
      { id: 'village', x: 19.5, z: 32.5 },
      { id: 'graveyard', x: 35, z: 14.5 },
    ],
    ambience: {
      background: 0x0e0f14,
      fog: 0x15161c,
      fogNear: 58,
      fogFar: 120,
      moon: PALETTE.moon,
      moonIntensity: 2.6,
      hemiSky: 0x6a7490,
      hemiGround: 0x3a2c20,
      hemiIntensity: 2.4,
      ash: true,
      dust: false,
    },
  };
}

export const EMBERFALL: MapDef = build();
