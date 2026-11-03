import * as THREE from 'three';
import type { PropLight } from './props';

type PoolEntry = { def: PropLight; seed: number; dist2: number };

/**
 * Many light sources, few real lights: each frame the `max` sources nearest the
 * focus are assigned to a fixed set of PointLights (so shader light count never changes).
 */
export class LightPool {
  private readonly entries: PoolEntry[] = [];
  private readonly lights: THREE.PointLight[] = [];
  private max: number;

  constructor(private readonly scene: THREE.Object3D, max: number) {
    this.max = max;
    for (let i = 0; i < 8; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 1, 1.6);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
    }
  }

  setMax(n: number): void {
    this.max = n;
  }

  register(def: PropLight): PropLight {
    this.entries.push({ def, seed: Math.random() * 100, dist2: 0 });
    return def;
  }

  unregister(def: PropLight): void {
    const i = this.entries.findIndex((e) => e.def === def);
    if (i >= 0) this.entries.splice(i, 1);
  }

  update(focus: THREE.Vector3, t: number): void {
    for (const e of this.entries) e.dist2 = (e.def.x - focus.x) ** 2 + (e.def.z - focus.z) ** 2;
    const sorted = [...this.entries].sort((a, b) => a.dist2 - b.dist2);
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      const e = i < this.max ? sorted[i] : undefined;
      if (!e) {
        l.intensity = 0;
        l.visible = i < this.max;
        continue;
      }
      l.visible = true;
      l.position.set(e.def.x, e.def.y, e.def.z);
      l.color.setHex(e.def.color);
      l.distance = e.def.distance;
      const f = e.def.flicker ? 0.85 + Math.sin(t * 11 + e.seed) * 0.06 + Math.sin(t * 23.7 + e.seed * 3) * 0.05 + Math.sin(t * 5.1 + e.seed) * 0.04 : 1;
      // fade lights in/out at the edge of the active set to avoid popping
      l.intensity = e.def.intensity * f;
    }
  }

  dispose(): void {
    for (const l of this.lights) this.scene.remove(l);
    this.entries.length = 0;
  }
}

/** Moonlight whose shadow frustum follows the camera focus for crisp local shadows. */
export class MoonLight {
  readonly light: THREE.DirectionalLight;
  private readonly offset = new THREE.Vector3(-13, 24, 9);

  constructor(scene: THREE.Object3D, color: number, intensity: number, shadowSize: number) {
    this.light = new THREE.DirectionalLight(color, intensity);
    this.light.castShadow = true;
    const cam = this.light.shadow.camera;
    cam.left = -20;
    cam.right = 20;
    cam.top = 20;
    cam.bottom = -20;
    cam.near = 1;
    cam.far = 80;
    this.light.shadow.bias = -0.0008;
    this.light.shadow.normalBias = 0.03;
    this.setShadowSize(shadowSize);
    scene.add(this.light, this.light.target);
  }

  setShadowSize(n: number): void {
    this.light.shadow.mapSize.set(n, n);
    this.light.shadow.map?.dispose();
    this.light.shadow.map = null as never;
  }

  dispose(): void {
    this.light.shadow.dispose();
    this.light.removeFromParent();
    this.light.target.removeFromParent();
  }

  update(focus: THREE.Vector3): void {
    // snap to texel grid to avoid shimmering
    const texel = 40 / this.light.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    this.light.target.position.set(fx, 0, fz);
    this.light.position.set(fx + this.offset.x, this.offset.y, fz + this.offset.z);
    this.light.target.updateMatrixWorld();
  }
}
