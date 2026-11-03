import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash2, type MapDef, type TileKind } from '../data/maps/types';

const COLORS: Record<string, Record<TileKind, number>> = {
  emberfall: { ground: 0x5c5248, grass: 0x4e4e38, path: 0x7c6a56, wall: 0x2a2624, void: 0x050505, floor: 0x4a4542, gate: 0x4a4542 },
  crypt: { ground: 0x484c54, grass: 0x484c54, path: 0x52565e, wall: 0x2c3036, void: 0x000000, floor: 0x484c54, gate: 0x484c54 },
};

const isSolid = (k: TileKind | undefined) => k === undefined || k === 'wall' || k === 'void';

/** Village ground: one subdivided plane with vertex colors and gentle cliff lift. */
function buildOutdoor(def: MapDef): THREE.Mesh {
  const { w, h } = def.size;
  const seg = 2;
  const geo = new THREE.PlaneGeometry(w, h, w * seg, h * seg);
  geo.rotateX(-Math.PI / 2);
  geo.translate(w / 2, 0, h / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const pal = COLORS.emberfall;
  const tileAt = (x: number, z: number): TileKind => def.tiles[Math.min(h - 1, Math.max(0, Math.floor(z)))][Math.min(w - 1, Math.max(0, Math.floor(x)))];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // average the 4 tiles touching this vertex for soft edges
    const samples = [tileAt(x - 0.01, z - 0.01), tileAt(x + 0.01, z - 0.01), tileAt(x - 0.01, z + 0.01), tileAt(x + 0.01, z + 0.01)];
    let r = 0;
    let g = 0;
    let b = 0;
    let wallCount = 0;
    for (const s of samples) {
      c.setHex(pal[s]);
      r += c.r;
      g += c.g;
      b += c.b;
      if (s === 'wall') wallCount++;
    }
    const n = hash2(Math.round(x * 2), Math.round(z * 2), 5) * 0.25 + hash2(Math.floor(x / 4), Math.floor(z / 4), 6) * 0.2 + 0.78;
    colors[i * 3] = (r / 4) * n;
    colors[i * 3 + 1] = (g / 4) * n;
    colors[i * 3 + 2] = (b / 4) * n;
    const lift = (wallCount / 4) * (0.6 + hash2(Math.round(x), Math.round(z), 8) * 0.9);
    const bump = (hash2(Math.round(x * 2), Math.round(z * 2), 9) - 0.5) * 0.06;
    pos.setY(i, lift + (wallCount === 0 ? bump : 0));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

/** Crypt: per-cell stone slabs plus walls; walls on the camera side are kept low so they never hide the player. */
function buildCrypt(def: MapDef): THREE.Group {
  const { w, h } = def.size;
  const group = new THREE.Group();
  const slabs: THREE.BufferGeometry[] = [];
  const walls: THREE.BufferGeometry[] = [];
  const pal = COLORS.crypt;
  const c = new THREE.Color();
  const colorize = (geo: THREE.BufferGeometry, hex: number, shade: number) => {
    const g = geo.toNonIndexed();
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    c.setHex(hex).multiplyScalar(shade);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('uv');
    return g;
  };
  const tile = (x: number, z: number) => def.tiles[z]?.[x];
  for (let z = 0; z < h; z++)
    for (let x = 0; x < w; x++) {
      const k = tile(x, z);
      if (k === 'void') continue;
      if (k === 'wall') {
        const nbrs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        const open = nbrs.filter(([dx, dz]) => !isSolid(tile(x + dx, z + dz)));
        if (open.length === 0) continue;
        // camera sits toward +x/+z: any wall in front of some floor (floor at -x/-z) is kept low
        const nearSide = open.some(([dx, dz]) => dx < 0 || dz < 0);
        const tall = 2.4 + hash2(x, z, 3) * 0.6;
        const hgt = nearSide ? 0.55 : tall;
        const geo = new THREE.BoxGeometry(1.0, hgt, 1.0);
        geo.translate(x + 0.5, hgt / 2, z + 0.5);
        walls.push(colorize(geo, pal.wall, 0.8 + hash2(x, z, 4) * 0.4));
        if (!nearSide) {
          const cap = new THREE.BoxGeometry(1.04, 0.15, 1.04);
          cap.translate(x + 0.5, hgt + 0.07, z + 0.5);
          walls.push(colorize(cap, 0x1a1c20, 1));
        }
        continue;
      }
      const sh = 0.75 + hash2(x, z, 1) * 0.35;
      const slab = new THREE.BoxGeometry(0.96, 0.2, 0.96);
      const dy = (hash2(x, z, 2) - 0.5) * 0.04;
      slab.translate(x + 0.5, -0.1 + dy, z + 0.5);
      slabs.push(colorize(slab, k === 'path' ? pal.path : pal.floor, sh));
    }
  const floorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  // grout plane under the slabs
  const grout = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2).translate(w / 2, -0.12, h / 2), new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 1 }));
  grout.receiveShadow = true;
  group.add(grout);
  if (slabs.length) {
    const m = new THREE.Mesh(mergeGeometries(slabs), floorMat);
    m.receiveShadow = true;
    m.name = 'ground';
    group.add(m);
  }
  if (walls.length) {
    const m = new THREE.Mesh(mergeGeometries(walls), wallMat);
    m.receiveShadow = true;
    m.castShadow = true;
    group.add(m);
  }
  return group;
}

export function buildTerrain(def: MapDef): THREE.Object3D {
  if (def.id === 'crypt') return buildCrypt(def);
  const g = new THREE.Group();
  g.add(buildOutdoor(def));
  // dark raised skirt around the map edges (4 strips)
  const { w, h } = def.size;
  const pad = 60;
  const skirtMat = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 1, flatShading: true });
  const strips: [number, number, number, number][] = [
    [-pad, -pad, w + pad, 0],
    [-pad, h, w + pad, h + pad],
    [-pad, 0, 0, h],
    [w, 0, w + pad, h],
  ];
  for (const [x0, z0, x1, z1] of strips) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 1.0, (z0 + z1) / 2), skirtMat);
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}
