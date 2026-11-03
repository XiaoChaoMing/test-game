import { brushLine, fillRect, hash2, makeTiles, type MapDef, type PropPlacement, type SpawnDef } from './types';

const W = 60;
const H = 50;

function build(): MapDef {
  const t = makeTiles(W, H, 'wall');
  const props: PropPlacement[] = [];

  // rooms
  fillRect(t, 4, 36, 13, 46, 'floor'); // A entrance
  fillRect(t, 20, 35, 33, 45, 'floor'); // B
  fillRect(t, 16, 20, 40, 30, 'floor'); // C great hall
  fillRect(t, 46, 21, 55, 29, 'floor'); // altar
  fillRect(t, 24, 16, 32, 19, 'floor'); // antechamber
  // boss chamber (circle)
  for (let z = 0; z < H; z++)
    for (let x = 0; x < W; x++) if (Math.hypot(x + 0.5 - 28.5, z + 0.5 - 8) < 6.8) t[z][x] = 'floor';
  // corridors
  brushLine(t, [[13, 40.5], [20.5, 40.5]], 1.6, 'floor');
  brushLine(t, [[27.5, 30], [27.5, 35.5]], 1.6, 'floor');
  brushLine(t, [[40, 25.5], [46.5, 25.5]], 1.4, 'floor');
  fillRect(t, 27, 15, 29, 15, 'floor'); // boss door cells
  // worn paths
  brushLine(t, [[8.5, 44], [8.5, 40.5], [26.5, 40.5], [27.5, 36], [27.5, 25], [28.5, 16]], 0.9, 'path', ['floor']);

  // --- props
  // room A: stairs we came down, candles, bones
  props.push({ kind: 'stairs-down', x: 8.5, z: 46.6, rot: Math.PI, block: false });
  props.push({ kind: 'candles', x: 5.5, z: 37.5, seed: 1 }, { kind: 'candles', x: 12, z: 37.2, seed: 2 }, { kind: 'bones', x: 6, z: 42, seed: 3 });
  props.push({ kind: 'brazier', x: 11.5, z: 44.5 });
  // room B
  for (const [x, z] of [[22.5, 37.5], [30.5, 37.5], [22.5, 43], [30.5, 43]]) props.push({ kind: 'pillar', x, z, seed: x + z });
  props.push({ kind: 'coffin', x: 26.5, z: 38, rot: Math.PI / 2, block: { w: 2, d: 1 } }, { kind: 'brazier', x: 26.5, z: 44 }, { kind: 'bones', x: 24, z: 41, seed: 5 }, { kind: 'bones', x: 31, z: 40.5, seed: 6 });
  props.push({ kind: 'candles', x: 20.8, z: 35.8, seed: 7 });
  // room C great hall: two rows of pillars, coffins, braziers
  for (let i = 0; i < 5; i++) {
    props.push({ kind: 'pillar', x: 19.5 + i * 4.5, z: 22.5, seed: i });
    props.push({ kind: 'pillar', x: 19.5 + i * 4.5, z: 28, seed: i + 10 });
  }
  for (let i = 0; i < 4; i++) props.push({ kind: 'coffin', x: 21.8 + i * 4.5, z: 25.2, rot: hash2(i, 1) > 0.5 ? 0 : 0.15, seed: i });
  props.push({ kind: 'brazier', x: 17.5, z: 25.2 }, { kind: 'brazier', x: 38.5, z: 25.2 });
  props.push({ kind: 'candles', x: 17.2, z: 20.8, seed: 9 }, { kind: 'candles', x: 39, z: 29.4, seed: 10 }, { kind: 'bones', x: 33, z: 21.5, seed: 11 }, { kind: 'bones', x: 20, z: 29.3, seed: 12 });
  props.push({ kind: 'cobweb', x: 16.5, z: 20.5 });
  // altar room
  props.push({ kind: 'altar', x: 51.5, z: 25 }, { kind: 'candles', x: 49, z: 22.5, seed: 13 }, { kind: 'candles', x: 54, z: 27.6, seed: 14 }, { kind: 'candles', x: 49.2, z: 27.8, seed: 15 }, { kind: 'statue', x: 54.5, z: 22, block: { w: 1, d: 1 } });
  // antechamber
  props.push({ kind: 'brazier', x: 24.8, z: 17 }, { kind: 'brazier', x: 32.2, z: 17 }, { kind: 'bones', x: 30, z: 18.6, seed: 16 });
  // boss chamber ring of braziers + statues
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = 28.5 + Math.sin(a) * 5.6;
    const z = 8 + Math.cos(a) * 5.6;
    if (z > 12.5) continue; // keep the entrance clear
    props.push({ kind: 'brazier', x, z });
  }
  props.push({ kind: 'bones', x: 26, z: 6, seed: 20 }, { kind: 'bones', x: 31, z: 9.5, seed: 21 }, { kind: 'bones', x: 29, z: 4, seed: 22 });

  const spawns: SpawnDef[] = [
    { enemy: 'husk', x: 24, z: 39.5, group: 'b' },
    { enemy: 'husk', x: 29, z: 41.5, group: 'b' },
    { enemy: 'husk', x: 27, z: 43.5, group: 'b' },
    { enemy: 'hound', x: 31.5, z: 39.5, group: 'b' },
    { enemy: 'hound', x: 23, z: 44.5, group: 'b' },
    { enemy: 'archer', x: 21, z: 21.2, group: 'c' },
    { enemy: 'archer', x: 35.5, z: 21.2, group: 'c' },
    { enemy: 'archer', x: 28.5, z: 21.4, group: 'c' },
    { enemy: 'husk', x: 24, z: 26.8, group: 'c' },
    { enemy: 'husk', x: 33, z: 26.8, group: 'c' },
    { enemy: 'husk', x: 29, z: 29.4, group: 'c' },
    { enemy: 'hound', x: 37, z: 27.5, group: 'c' },
    { enemy: 'archer', x: 53, z: 28.2, group: 'altar' },
    { enemy: 'husk', x: 48, z: 21.6, group: 'altar' },
    { enemy: 'warden', x: 28.5, z: 6, group: 'boss', facing: 0 },
  ];

  return {
    id: 'crypt',
    index: 2,
    nameKey: 'map.crypt',
    size: { w: W, h: H },
    cellSize: 1,
    tiles: t,
    props,
    spawns,
    triggers: [
      { id: 'altar', x: 51.5, z: 25, radius: 3.2 },
      { id: 'boss-room', x: 28.5, z: 12.5, radius: 1.8 },
    ],
    gates: [{ id: 'boss-door', cells: [[27, 15], [28, 15], [29, 15]], x: 28.5, z: 15.5, rot: 0 }],
    npcs: [],
    playerStart: { x: 8.5, z: 43 },
    playerFacing: Math.PI,
    checkpoints: [
      { id: 'crypt-start', x: 8.5, z: 43 },
      { id: 'great-hall', x: 27.5, z: 32 },
      { id: 'boss-door', x: 28.5, z: 18 },
    ],
    ambience: {
      background: 0x000000,
      fog: 0x05070b,
      fogNear: 58,
      fogFar: 120,
      moon: 0x6a8ab8,
      moonIntensity: 1.3,
      hemiSky: 0x4a5a7a,
      hemiGround: 0x18181c,
      hemiIntensity: 2.4,
      ash: false,
      dust: true,
    },
  };
}

export const CRYPT: MapDef = build();
