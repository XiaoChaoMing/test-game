import * as THREE from 'three';
import type { PropKind, PropPlacement } from '../data/maps/types';
import { hash2 } from '../data/maps/types';
import { cachedGeo } from './characters/rig';
import { markShared } from './dispose';

const std = (color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  markShared(new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.02, flatShading: true, ...opts }));

export const MATS = {
  wood: std(0x4a3426),
  woodDark: std(0x2c1f17),
  charred: std(0x1d1714),
  stone: std(0x5b5955),
  stoneDark: std(0x3a3835),
  stoneMoss: std(0x4a4e40),
  cryptStone: std(0x58606a),
  cryptStoneDark: std(0x3a3f46),
  rock: std(0x4a4643),
  rockDark: std(0x2f2c2a),
  bark: std(0x2a2420),
  bone: std(0xcfc4a6),
  cloth: std(0x5a2420),
  clothBlue: std(0x24324a),
  iron: std(0x2e3034, { metalness: 0.6, roughness: 0.5 }),
  wax: std(0xd9cfb4),
  thatch: std(0x3d3426),
  web: markShared(new THREE.MeshBasicMaterial({ color: 0xbfc4cc, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })),
  flame: markShared(new THREE.MeshBasicMaterial({ color: 0xffa04a, toneMapped: false })),
  flameCore: markShared(new THREE.MeshBasicMaterial({ color: 0xfff0b0, toneMapped: false })),
  soulFlame: markShared(new THREE.MeshBasicMaterial({ color: 0x7fd4ff, toneMapped: false })),
  ember: markShared(new THREE.MeshBasicMaterial({ color: 0xff6a20, toneMapped: false })),
  void: markShared(new THREE.MeshBasicMaterial({ color: 0x000000 })),
};

export type PropLight = { x: number; y: number; z: number; color: number; intensity: number; distance: number; flicker: boolean };
export type PropEmitter = { preset: 'spark' | 'ember' | 'soul' | 'smoke'; x: number; y: number; z: number; rate: number };

export type BuiltProp = {
  /** meshes that never move (merged into static batches) */
  staticGroup: THREE.Group;
  /** meshes that animate (flames) */
  dynamic: THREE.Object3D[];
  lights: PropLight[];
  emitters: PropEmitter[];
};

const box = (g: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) => {
  const mesh = new THREE.Mesh(cachedGeo(`box:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}`, () => new THREE.BoxGeometry(w, h, d)), m);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
};
const cyl = (g: THREE.Object3D, rt: number, rb: number, h: number, m: THREE.Material, seg = 6, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
  const mesh = new THREE.Mesh(cachedGeo(`cyl:${rt}:${rb}:${h}:${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), m);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, 0, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
};
const cone = (g: THREE.Object3D, r: number, h: number, m: THREE.Material, seg = 6, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
  const mesh = new THREE.Mesh(cachedGeo(`cone:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg)), m);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, 0, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
};
const ico = (g: THREE.Object3D, r: number, m: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, detail = 0) => {
  const mesh = new THREE.Mesh(cachedGeo(`ico:${r}:${detail}`, () => new THREE.IcosahedronGeometry(r, detail)), m);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
};

function flame(parent: THREE.Object3D, x: number, y: number, z: number, s: number, soul = false): THREE.Object3D {
  const f = new THREE.Group();
  f.position.set(x, y, z);
  const outer = new THREE.Mesh(cachedGeo('flame-o', () => new THREE.ConeGeometry(0.12, 0.42, 5)), soul ? MATS.soulFlame : MATS.flame);
  outer.position.y = 0.18;
  const inner = new THREE.Mesh(cachedGeo('flame-i', () => new THREE.ConeGeometry(0.06, 0.24, 5)), MATS.flameCore);
  inner.position.y = 0.12;
  f.add(outer, inner);
  f.scale.setScalar(s);
  f.userData.flame = { base: s, seed: Math.random() * 100 };
  parent.add(f);
  return f;
}

export function animateFlames(objs: THREE.Object3D[], t: number): void {
  for (const o of objs) {
    const fl = o.userData.flame as { base: number; seed: number } | undefined;
    if (!fl) continue;
    const n = Math.sin(t * 13 + fl.seed) * 0.5 + Math.sin(t * 7.3 + fl.seed * 2) * 0.5;
    o.scale.set(fl.base * (1 + n * 0.08), fl.base * (1 + n * 0.22), fl.base * (1 + n * 0.08));
    o.rotation.y = t * 2 + fl.seed;
  }
}

export const DEFAULT_BLOCK: Partial<Record<PropKind, { w: number; d: number }>> = {
  'house-ruin': { w: 4, d: 4 },
  well: { w: 2, d: 2 },
  'dead-tree': { w: 1, d: 1 },
  'pine-dead': { w: 1, d: 1 },
  campfire: { w: 1, d: 1 },
  pillar: { w: 1, d: 1 },
  coffin: { w: 1, d: 2 },
  brazier: { w: 1, d: 1 },
  altar: { w: 2, d: 1 },
  statue: { w: 1, d: 1 },
  cart: { w: 2, d: 1 },
};

export function buildProp(p: PropPlacement): BuiltProp {
  const g = new THREE.Group();
  const dynamic: THREE.Object3D[] = [];
  const lights: PropLight[] = [];
  const emitters: PropEmitter[] = [];
  const seed = p.seed ?? Math.floor(p.x * 13 + p.z * 7);
  const r = (k: number) => hash2(seed, k, 99);

  switch (p.kind) {
    case 'house-ruin': {
      // 4x4 stone base with broken walls, charred beams, collapsed roof slab
      const walls: [number, number, number, number, number][] = [
        // x, z, w, d, height
        [0, -1.8, 4, 0.35, 1.6 + r(1) * 1.2],
        [-1.8, 0, 0.35, 4, 1.2 + r(2) * 1.4],
        [1.8, 0.6, 0.35, 2.6, 0.6 + r(3) * 0.8],
        [-0.8, 1.8, 2.2, 0.35, 0.5 + r(4) * 0.6],
      ];
      for (const [x, z, w, d, h] of walls) {
        box(g, w, h, d, MATS.stone, x, h / 2, z);
        // jagged top
        for (let i = 0; i < 3; i++) box(g, w > d ? w * 0.25 : d * 0.25 * 0.5 + 0.2, 0.3, w > d ? 0.37 : 0.37, MATS.stoneDark, x + (w > d ? (i - 1) * w * 0.3 : 0), h + 0.1 * (i % 2), z + (w > d ? 0 : (i - 1) * d * 0.3), r(10 + i) * 0.4);
      }
      // charred beams
      box(g, 0.2, 0.2, 4.4, MATS.charred, -0.4, 1.9, -0.1, 0.1, 0.35, 0.1);
      box(g, 0.18, 0.18, 3.6, MATS.charred, 0.8, 1.2, 0.2, -0.3, -0.5, 0.2);
      box(g, 3.6, 0.15, 0.2, MATS.charred, 0, 2.2 + r(5) * 0.6, -1.7);
      // fallen roof slab
      box(g, 2.6, 0.12, 2, MATS.thatch, 0.4, 0.4, 0.6, 0.3, 0.25, -0.2);
      // rubble
      for (let i = 0; i < 6; i++) ico(g, 0.22 + r(20 + i) * 0.2, MATS.stoneDark, (r(30 + i) - 0.5) * 3.2, 0.12, (r(40 + i) - 0.5) * 3.2, 1, 0.6, 1);
      if (r(6) > 0.5) emitters.push({ preset: 'smoke', x: 0, y: 1.6, z: 0, rate: 1.2 });
      break;
    }
    case 'fence': {
      cyl(g, 0.06, 0.07, 1.0, MATS.wood, 5, -0.45, 0.5, 0);
      cyl(g, 0.06, 0.07, 0.9, MATS.wood, 5, 0.45, 0.45, 0, 0, 0.12);
      box(g, 1.0, 0.08, 0.06, MATS.woodDark, 0, 0.7, 0, 0, 0, 0.05);
      if (r(1) > 0.4) box(g, 1.0, 0.08, 0.06, MATS.woodDark, 0, 0.35, 0, 0, 0, -0.15);
      break;
    }
    case 'dead-tree': {
      const h = 2.6;
      cyl(g, 0.12, 0.26, h, MATS.bark, 6, 0, h / 2, 0, (r(1) - 0.5) * 0.2, (r(2) - 0.5) * 0.2);
      for (let i = 0; i < 4; i++) {
        const y = 1.2 + i * 0.4;
        const a = r(10 + i) * Math.PI * 2;
        const b = new THREE.Group();
        b.position.set(0, y, 0);
        b.rotation.set(0, a, 0.7 + r(20 + i) * 0.6);
        cyl(b, 0.03, 0.08, 1.2 - i * 0.15, MATS.bark, 4, 0, 0.55, 0);
        g.add(b);
      }
      break;
    }
    case 'pine-dead': {
      cyl(g, 0.08, 0.18, 3.2, MATS.bark, 5, 0, 1.6, 0);
      for (let i = 0; i < 4; i++) cone(g, 0.7 - i * 0.14, 0.7, MATS.charred, 5, 0, 1.3 + i * 0.5, 0);
      break;
    }
    case 'gravestone': {
      const h = 0.7 + r(1) * 0.4;
      const m = box(g, 0.55, h, 0.16, r(2) > 0.5 ? MATS.stone : MATS.stoneMoss, 0, h / 2 - 0.05, 0, 0, (r(3) - 0.5) * 0.25, (r(4) - 0.5) * 0.25);
      m.castShadow = true;
      cyl(g, 0.275, 0.275, 0.16, MATS.stone, 6, 0, h - 0.05, 0, Math.PI / 2).scale.set(1, 1, 0.35);
      box(g, 0.5, 0.06, 1.0, MATS.rockDark, 0, 0.03, 0.55);
      break;
    }
    case 'grave-cross': {
      box(g, 0.12, 1.0, 0.12, MATS.woodDark, 0, 0.5, 0, 0, 0, (r(1) - 0.5) * 0.3);
      box(g, 0.55, 0.1, 0.1, MATS.woodDark, 0, 0.75, 0);
      box(g, 0.5, 0.08, 0.9, MATS.rockDark, 0, 0.04, 0.5);
      break;
    }
    case 'torch': {
      cyl(g, 0.05, 0.07, 1.6, MATS.woodDark, 5, 0, 0.8, 0);
      cyl(g, 0.1, 0.07, 0.18, MATS.iron, 6, 0, 1.62, 0);
      dynamic.push(flame(g, 0, 1.68, 0, 1));
      lights.push({ x: 0, y: 2.0, z: 0, color: 0xff8a3a, intensity: 14, distance: 9, flicker: true });
      emitters.push({ preset: 'spark', x: 0, y: 1.95, z: 0, rate: 3 });
      break;
    }
    case 'campfire': {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ico(g, 0.18, MATS.stoneDark, Math.cos(a) * 0.6, 0.1, Math.sin(a) * 0.6, 1, 0.7, 1);
      }
      for (let i = 0; i < 4; i++) box(g, 0.12, 0.12, 0.9, MATS.charred, 0, 0.15, 0, (i / 4) * Math.PI, 0.25);
      dynamic.push(flame(g, 0, 0.1, 0, 2.2), flame(g, 0.15, 0.1, 0.1, 1.4), flame(g, -0.15, 0.1, -0.05, 1.5));
      lights.push({ x: 0, y: 1.2, z: 0, color: 0xff7a2a, intensity: 40, distance: 14, flicker: true });
      emitters.push({ preset: 'ember', x: 0, y: 0.6, z: 0, rate: 14 }, { preset: 'smoke', x: 0, y: 1.2, z: 0, rate: 2 });
      break;
    }
    case 'rock': {
      ico(g, 0.5, r(1) > 0.5 ? MATS.rock : MATS.rockDark, 0, 0.2, 0, 1 + r(2) * 0.4, 0.6 + r(3) * 0.4, 1 + r(4) * 0.3);
      if (r(5) > 0.5) ico(g, 0.25, MATS.rockDark, 0.45, 0.1, 0.2, 1, 0.7, 1);
      break;
    }
    case 'cliff-rock': {
      const h = 1.6 + r(1) * 1.6;
      ico(g, 0.9, r(2) > 0.4 ? MATS.rockDark : MATS.rock, 0, h * 0.35, 0, 1, h * 0.55, 1);
      ico(g, 0.6, MATS.rockDark, (r(3) - 0.5) * 0.8, h * 0.6, (r(4) - 0.5) * 0.8, 1, 1.2, 1);
      break;
    }
    case 'cart': {
      box(g, 1.8, 0.12, 1.0, MATS.wood, 0, 0.6, 0, 0, 0, 0.12);
      box(g, 1.8, 0.4, 0.08, MATS.woodDark, 0, 0.8, 0.48, 0, 0, 0.12);
      box(g, 1.8, 0.4, 0.08, MATS.woodDark, 0, 0.8, -0.48, 0, 0, 0.12);
      for (const s of [-1, 1]) {
        const wheel = cyl(g, 0.42, 0.42, 0.08, MATS.woodDark, 8, 0.3, 0.42, s * 0.6, Math.PI / 2);
        if (s > 0) wheel.rotation.z = 0.5;
      }
      box(g, 1.4, 0.07, 0.07, MATS.wood, -1.5, 0.4, 0.2, 0.15, 0, 0.3);
      break;
    }
    case 'well': {
      cyl(g, 0.9, 0.95, 0.7, MATS.stone, 8, 0, 0.35, 0);
      cyl(g, 0.7, 0.7, 0.72, MATS.void, 8, 0, 0.37, 0);
      for (const s of [-1, 1]) cyl(g, 0.06, 0.06, 1.6, MATS.woodDark, 5, s * 0.75, 1.1, 0);
      box(g, 1.7, 0.1, 0.1, MATS.woodDark, 0, 1.85, 0);
      cone(g, 1.2, 0.6, MATS.thatch, 4, 0, 2.2, 0).rotation.y = Math.PI / 4;
      break;
    }
    case 'crypt-gate': {
      // mausoleum facade, faces +z (toward the graveyard)
      box(g, 7, 3.6, 1.6, MATS.stoneDark, 0, 1.8, -0.6);
      box(g, 7.6, 0.5, 2.0, MATS.stone, 0, 3.75, -0.5);
      cone(g, 4.3, 1.4, MATS.stoneDark, 4, 0, 4.7, -0.5).rotation.y = Math.PI / 4;
      for (const s of [-1, 1]) {
        cyl(g, 0.3, 0.35, 3.4, MATS.stone, 8, s * 1.9, 1.7, 0.4);
        cyl(g, 0.3, 0.35, 3.4, MATS.stone, 8, s * 3.1, 1.7, 0.4);
        box(g, 0.9, 1.2, 0.9, MATS.stoneDark, s * 4.1, 0.6, 0.6);
      }
      box(g, 2.6, 2.8, 1.7, MATS.void, 0, 1.4, -0.5); // dark doorway
      for (let i = 0; i < 4; i++) box(g, 2.6, 0.2, 0.4, MATS.stone, 0, 0.1 - i * 0.12, 0.3 - i * 0.35);
      // soul braziers by the door
      for (const s of [-1, 1]) {
        cyl(g, 0.22, 0.12, 0.5, MATS.iron, 6, s * 1.9, 3.65, 0.6);
        dynamic.push(flame(g, s * 1.9, 3.85, 0.6, 1.2, true));
        lights.push({ x: s * 1.9, y: 4.2, z: 1.0, color: 0x5ab8ff, intensity: 14, distance: 9, flicker: true });
      }
      emitters.push({ preset: 'soul', x: 0, y: 1.2, z: 0.6, rate: 4 });
      break;
    }
    case 'stone-wall': {
      const h = 0.7 + r(1) * 0.4;
      box(g, 1.02, h, 0.45, r(2) > 0.3 ? MATS.stone : MATS.stoneMoss, 0, h / 2, 0);
      box(g, 1.06, 0.12, 0.5, MATS.stoneDark, 0, h + 0.05, 0);
      break;
    }
    case 'statue': {
      box(g, 0.9, 0.6, 0.9, MATS.stoneDark, 0, 0.3, 0);
      cyl(g, 0.25, 0.35, 1.2, MATS.stone, 6, 0, 1.2, 0);
      ico(g, 0.22, MATS.stone, 0, 1.95, 0);
      for (const s of [-1, 1]) box(g, 0.5, 0.9, 0.08, MATS.stone, s * 0.35, 1.5, -0.15, s * 0.5, 0, s * 0.6);
      break;
    }
    case 'banner': {
      cyl(g, 0.05, 0.05, 2.6, MATS.woodDark, 5, 0, 1.3, 0);
      box(g, 0.8, 0.06, 0.06, MATS.woodDark, 0, 2.5, 0);
      box(g, 0.7, 1.4, 0.03, MATS.cloth, 0, 1.75, 0.03, 0, 0.05, 0);
      break;
    }
    case 'barrel': {
      cyl(g, 0.3, 0.27, 0.8, MATS.wood, 8, 0, 0.4, 0);
      cyl(g, 0.31, 0.31, 0.06, MATS.iron, 8, 0, 0.6, 0);
      cyl(g, 0.31, 0.31, 0.06, MATS.iron, 8, 0, 0.2, 0);
      break;
    }
    case 'pillar': {
      box(g, 1.0, 0.3, 1.0, MATS.cryptStoneDark, 0, 0.15, 0);
      cyl(g, 0.32, 0.36, 1.9, MATS.cryptStone, 8, 0, 1.25, 0);
      box(g, 0.9, 0.28, 0.9, MATS.cryptStoneDark, 0, 2.33, 0);
      if (r(1) > 0.6) box(g, 0.5, 0.5, 0.4, MATS.cryptStone, 0.4, 0.25, 0.5, r(2), 0.3, 0.2);
      break;
    }
    case 'coffin': {
      box(g, 0.8, 0.5, 1.8, MATS.cryptStoneDark, 0, 0.25, 0);
      box(g, 0.86, 0.12, 1.86, MATS.cryptStone, 0, 0.55, r(1) > 0.5 ? 0 : 0.35, r(1) > 0.5 ? 0 : 0.25);
      box(g, 0.3, 0.06, 0.6, MATS.stoneDark, 0, 0.63, -0.2);
      break;
    }
    case 'bones': {
      for (let i = 0; i < 5; i++) {
        const b = box(g, 0.06, 0.06, 0.4, MATS.bone, (r(i) - 0.5) * 0.8, 0.03, (r(i + 10) - 0.5) * 0.8);
        b.rotation.y = r(i + 20) * Math.PI;
        b.castShadow = false;
      }
      ico(g, 0.12, MATS.bone, (r(30) - 0.5) * 0.5, 0.1, (r(31) - 0.5) * 0.5);
      break;
    }
    case 'candles': {
      const n = 3 + Math.floor(r(1) * 3);
      for (let i = 0; i < n; i++) {
        const x = (r(i + 2) - 0.5) * 0.6;
        const z = (r(i + 12) - 0.5) * 0.6;
        const h = 0.15 + r(i + 22) * 0.3;
        cyl(g, 0.04, 0.045, h, MATS.wax, 5, x, h / 2, z).castShadow = false;
        dynamic.push(flame(g, x, h, z, 0.3));
      }
      lights.push({ x: 0, y: 0.8, z: 0, color: 0xffa860, intensity: 5, distance: 5, flicker: true });
      break;
    }
    case 'brazier': {
      cyl(g, 0.12, 0.2, 1.0, MATS.iron, 6, 0, 0.5, 0);
      cyl(g, 0.45, 0.25, 0.35, MATS.iron, 8, 0, 1.15, 0);
      for (let i = 0; i < 3; i++) ico(g, 0.12, MATS.ember, (r(i) - 0.5) * 0.4, 1.3, (r(i + 5) - 0.5) * 0.4);
      dynamic.push(flame(g, 0, 1.25, 0, 1.8));
      lights.push({ x: 0, y: 2.0, z: 0, color: 0xff7a2a, intensity: 22, distance: 11, flicker: true });
      emitters.push({ preset: 'ember', x: 0, y: 1.6, z: 0, rate: 6 });
      break;
    }
    case 'cobweb': {
      const m = new THREE.Mesh(cachedGeo('web', () => new THREE.CircleGeometry(0.6, 3)), MATS.web);
      m.position.set(0, 2.4, 0);
      m.rotation.set(0.3, Math.PI / 4, 0);
      g.add(m);
      break;
    }
    case 'altar': {
      box(g, 2.2, 0.3, 1.2, MATS.cryptStoneDark, 0, 0.15, 0);
      box(g, 1.8, 0.8, 0.9, MATS.cryptStone, 0, 0.7, 0);
      box(g, 2.0, 0.12, 1.0, MATS.cryptStoneDark, 0, 1.16, 0);
      ico(g, 0.18, MATS.ember, 0, 1.35, 0);
      lights.push({ x: 0, y: 1.8, z: 0, color: 0xff6a20, intensity: 10, distance: 6, flicker: true });
      emitters.push({ preset: 'ember', x: 0, y: 1.4, z: 0, rate: 4 });
      break;
    }
    case 'stairs-down': {
      for (let i = 0; i < 5; i++) box(g, 2.4, 0.2, 0.5, MATS.cryptStoneDark, 0, -i * 0.18, -i * 0.45);
      box(g, 2.6, 2.4, 0.4, MATS.void, 0, -0.6, -2.4);
      break;
    }
  }

  g.position.set(p.x, 0, p.z);
  g.rotation.y = p.rot ?? 0;
  g.scale.setScalar(p.scale ?? 1);
  // transform light/emitter offsets into world space
  const m = new THREE.Matrix4().compose(g.position, new THREE.Quaternion().setFromEuler(g.rotation), g.scale);
  const tmp = new THREE.Vector3();
  for (const l of lights) {
    tmp.set(l.x, l.y, l.z).applyMatrix4(m);
    l.x = tmp.x;
    l.y = tmp.y;
    l.z = tmp.z;
  }
  for (const e of emitters) {
    tmp.set(e.x, e.y, e.z).applyMatrix4(m);
    e.x = tmp.x;
    e.y = tmp.y;
    e.z = tmp.z;
  }
  // detach dynamic objects into world space so the static group can be merged
  g.updateMatrixWorld(true);
  for (const d of dynamic) {
    const wp = new THREE.Vector3();
    const wq = new THREE.Quaternion();
    const ws = new THREE.Vector3();
    d.matrixWorld.decompose(wp, wq, ws);
    d.removeFromParent();
    d.position.copy(wp);
    d.quaternion.copy(wq);
    d.scale.copy(ws);
    (d.userData.flame as { base: number }).base = ws.x;
  }
  return { staticGroup: g, dynamic, lights, emitters };
}
