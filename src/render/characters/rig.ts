import * as THREE from 'three';

export type JointRot = [number, number, number];

/** Target pose: joint rotations plus root-offset (body bob / lunge). */
export type Pose = {
  rot: Record<string, JointRot>;
  bodyY: number;
  bodyZ: number;
  bodyRotX: number;
  bodyRotZ: number;
};

export const emptyPose = (): Pose => ({ rot: {}, bodyY: 0, bodyZ: 0, bodyRotX: 0, bodyRotZ: 0 });

const geoCache = new Map<string, THREE.BufferGeometry>();
export function cachedGeo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    g.userData.cached = true;
    geoCache.set(key, g);
  }
  return g;
}

export type MatSpec = { color: number; emissive?: number; emissiveIntensity?: number; roughness?: number; metalness?: number };

/**
 * A procedural rig: a hierarchy of named joint Groups with meshes attached.
 * Materials are per-rig so hit flashes affect only this character.
 */
export class Rig {
  readonly root = new THREE.Group();
  /** Everything visual lives under body so we can bob/lunge without touching root. */
  readonly body = new THREE.Group();
  readonly joints = new Map<string, THREE.Object3D>();
  readonly materials: THREE.MeshStandardMaterial[] = [];
  private readonly baseEmissive = new Map<THREE.MeshStandardMaterial, { color: THREE.Color; intensity: number }>();
  height = 1.8;
  private flashT = 0;
  private flashColor = new THREE.Color(1, 1, 1);
  private tint = new THREE.Color(1, 1, 1);
  private tintAmount = 0;

  constructor() {
    this.root.add(this.body);
    this.joints.set('body', this.body);
  }

  mat(spec: MatSpec): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: spec.roughness ?? 0.85,
      metalness: spec.metalness ?? 0.05,
      flatShading: true,
      emissive: spec.emissive ?? 0x000000,
      emissiveIntensity: spec.emissiveIntensity ?? 1,
    });
    this.materials.push(m);
    this.baseEmissive.set(m, { color: m.emissive.clone(), intensity: m.emissiveIntensity });
    return m;
  }

  joint(name: string, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    this.joints.set(name, g);
    return g;
  }

  mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = false;
    parent.add(m);
    return m;
  }

  box(parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
    const geo = cachedGeo(`box:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}`, () => new THREE.BoxGeometry(w, h, d));
    return this.mesh(parent, geo, mat, x, y, z, shadow);
  }

  cyl(parent: THREE.Object3D, rTop: number, rBot: number, h: number, mat: THREE.Material, seg = 6, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
    const geo = cachedGeo(`cyl:${rTop}:${rBot}:${h}:${seg}`, () => new THREE.CylinderGeometry(rTop, rBot, h, seg));
    return this.mesh(parent, geo, mat, x, y, z, shadow);
  }

  sphere(parent: THREE.Object3D, r: number, mat: THREE.Material, detail = 0, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
    const geo = cachedGeo(`ico:${r}:${detail}`, () => new THREE.IcosahedronGeometry(r, detail));
    return this.mesh(parent, geo, mat, x, y, z, shadow);
  }

  cone(parent: THREE.Object3D, r: number, h: number, mat: THREE.Material, seg = 6, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
    const geo = cachedGeo(`cone:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg));
    return this.mesh(parent, geo, mat, x, y, z, shadow);
  }

  flash(color = 0xffffff, duration = 0.12): void {
    this.flashColor.set(color);
    this.flashT = duration;
  }

  setTint(color: number, amount: number): void {
    this.tint.set(color);
    this.tintAmount = amount;
  }

  updateFlash(dt: number): void {
    this.flashT = Math.max(0, this.flashT - dt);
    const k = this.flashT > 0 ? Math.min(1, this.flashT / 0.06) : 0;
    for (const m of this.materials) {
      const base = this.baseEmissive.get(m)!;
      if (k > 0) {
        m.emissive.copy(this.flashColor);
        m.emissiveIntensity = 1.4 * k + base.intensity * (1 - k);
      } else if (this.tintAmount > 0) {
        m.emissive.copy(base.color).lerp(this.tint, this.tintAmount);
        m.emissiveIntensity = Math.max(base.intensity, 0.6 * this.tintAmount);
      } else {
        m.emissive.copy(base.color);
        m.emissiveIntensity = base.intensity;
      }
    }
  }

  setOpacity(o: number): void {
    for (const m of this.materials) {
      m.transparent = o < 1;
      m.opacity = o;
      m.depthWrite = o >= 1;
    }
  }

  dispose(): void {
    for (const m of this.materials) m.dispose();
  }
}
