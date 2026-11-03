import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MapDef } from '../data/maps/types';
import { NavGrid } from '../logic/grid';
import { buildTerrain } from '../render/terrain';
import { buildProp, DEFAULT_BLOCK, animateFlames, MATS, type PropEmitter, type PropLight } from '../render/props';
import type { LightPool } from '../render/lighting';
import type { Particles } from '../render/vfx/particles';
import { disposeObject } from '../render/dispose';

export type LoadedMap = {
  def: MapDef;
  grid: NavGrid;
  root: THREE.Group;
  flames: THREE.Object3D[];
  setGateOpen(id: string, open: boolean): void;
  isGateOpen(id: string): boolean;
  update(dt: number, t: number): void;
  dispose(): void;
};

/** Merge every static mesh by material into a handful of draw calls. */
function batchStatic(groups: THREE.Object3D[]): THREE.Mesh[] {
  const byMat = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; shadow: boolean }>();
  for (const g of groups) {
    g.updateMatrixWorld(true);
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.Material;
      let entry = byMat.get(mat);
      if (!entry) {
        entry = { geos: [], shadow: false };
        byMat.set(mat, entry);
      }
      const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
      for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
      entry.geos.push(geo);
      entry.shadow ||= m.castShadow;
    });
  }
  const out: THREE.Mesh[] = [];
  for (const [mat, { geos, shadow }] of byMat) {
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = shadow && mat !== MATS.web;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    out.push(mesh);
  }
  return out;
}

function buildPortcullis(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.6, 0.07), MATS.iron);
    bar.position.set(-1.2 + i * 0.4, 1.3, 0);
    bar.castShadow = true;
    g.add(bar);
  }
  for (const y of [0.6, 1.5, 2.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.08), MATS.iron);
    rail.position.set(0, y, 0);
    g.add(rail);
  }
  // seal glyph
  const seal = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 4, 12), new THREE.MeshBasicMaterial({ color: 0x7fd4ff, toneMapped: false }));
  seal.position.set(0, 1.4, 0.06);
  seal.name = 'seal';
  g.add(seal);
  return g;
}

export function loadMap(def: MapDef, parent: THREE.Object3D, lights: LightPool, particles: Particles): LoadedMap {
  const root = new THREE.Group();
  root.name = `map:${def.id}`;
  parent.add(root);

  const grid = new NavGrid(def.size.w, def.size.h, def.cellSize, { x: 0, z: 0 });
  for (let z = 0; z < def.size.h; z++)
    for (let x = 0; x < def.size.w; x++) {
      const k = def.tiles[z][x];
      if (k === 'wall' || k === 'void') grid.setBlocked(x, z, true);
    }

  root.add(buildTerrain(def));

  const staticGroups: THREE.Object3D[] = [];
  const flames: THREE.Object3D[] = [];
  const registered: PropLight[] = [];
  const emitters: PropEmitter[] = [];
  for (const p of def.props) {
    const built = buildProp(p);
    staticGroups.push(built.staticGroup);
    for (const d of built.dynamic) {
      root.add(d);
      flames.push(d);
    }
    for (const l of built.lights) registered.push(lights.register(l));
    emitters.push(...built.emitters);
    const block = p.block === undefined ? DEFAULT_BLOCK[p.kind] : p.block;
    if (block) {
      const rotated = Math.abs(Math.sin(p.rot ?? 0)) > 0.7;
      const bw = rotated ? block.d : block.w;
      const bd = rotated ? block.w : block.d;
      const x0 = Math.round(p.x - bw / 2);
      const z0 = Math.round(p.z - bd / 2);
      for (let dz = 0; dz < bd; dz++) for (let dx = 0; dx < bw; dx++) grid.setBlocked(x0 + dx, z0 + dz, true);
    }
  }
  for (const m of batchStatic(staticGroups)) root.add(m);
  for (const e of emitters) particles.addEmitter(e.preset, e.x, e.y, e.z, e.rate);

  // gates
  const gates = new Map<string, { open: boolean; mesh: THREE.Group; cells: [number, number][]; anim: number }>();
  for (const gd of def.gates) {
    const mesh = buildPortcullis();
    mesh.position.set(gd.x, 0, gd.z);
    mesh.rotation.y = gd.rot;
    root.add(mesh);
    for (const [cx, cz] of gd.cells) grid.setBlocked(cx, cz, true);
    gates.set(gd.id, { open: false, mesh, cells: gd.cells, anim: 0 });
  }

  return {
    def,
    grid,
    root,
    flames,
    setGateOpen(id, open) {
      const g = gates.get(id);
      if (!g || g.open === open) return;
      g.open = open;
      for (const [cx, cz] of g.cells) grid.setBlocked(cx, cz, !open);
    },
    isGateOpen(id) {
      return gates.get(id)?.open ?? false;
    },
    update(dt, t) {
      animateFlames(flames, t);
      for (const g of gates.values()) {
        const target = g.open ? 1 : 0;
        g.anim += (target - g.anim) * Math.min(1, dt * 1.5);
        g.mesh.position.y = -g.anim * 2.7;
        const seal = g.mesh.getObjectByName('seal');
        if (seal) {
          seal.rotation.z = t * 0.8;
          seal.visible = !g.open;
        }
      }
    },
    dispose() {
      for (const l of registered) lights.unregister(l);
      particles.clearEmitters();
      parent.remove(root);
      disposeObject(root);
    },
  };
}
