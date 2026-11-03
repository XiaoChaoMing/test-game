import * as THREE from 'three';
import { buildProp, animateFlames, MATS } from '../render/props';
import type { PropPlacement } from '../data/maps/types';
import { Particles } from '../render/vfx/particles';
import type { GameContext } from './scene';
import { disposeObject } from '../render/dispose';

/** Small toolkit for hand-built cinematic sets (title, intro, ending). */
export class Stage {
  readonly root = new THREE.Group();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  readonly particles: Particles;
  readonly flames: THREE.Object3D[] = [];
  private flickers: { light: THREE.PointLight; base: number; seed: number }[] = [];
  time = 0;

  constructor(private readonly ctx: GameContext) {
    ctx.gr.scene.add(this.root);
    this.particles = new Particles(this.root, 3000);
    this.resize();
  }

  resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  env(background: number, fog: number, near: number, far: number): void {
    this.ctx.gr.scene.background = new THREE.Color(background);
    this.ctx.gr.scene.fog = new THREE.Fog(fog, near, far);
  }

  ground(color: number, size = 200, y = 0): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(size, size, 60, 60).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, Math.sin(pos.getX(i) * 0.3) * Math.cos(pos.getZ(i) * 0.25) * 0.15);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
    m.position.y = y;
    m.receiveShadow = true;
    this.root.add(m);
    return m;
  }

  prop(p: PropPlacement): THREE.Object3D {
    const b = buildProp(p);
    this.root.add(b.staticGroup);
    for (const d of b.dynamic) {
      this.root.add(d);
      this.flames.push(d);
    }
    for (const l of b.lights) this.light(l.color, l.intensity, l.distance, l.x, l.y, l.z, l.flicker);
    for (const e of b.emitters) this.particles.addEmitter(e.preset, e.x, e.y, e.z, e.rate);
    return b.staticGroup;
  }

  light(color: number, intensity: number, distance: number, x: number, y: number, z: number, flicker = false): THREE.PointLight {
    const l = new THREE.PointLight(color, intensity, distance, 1.6);
    l.position.set(x, y, z);
    this.root.add(l);
    if (flicker) this.flickers.push({ light: l, base: intensity, seed: Math.random() * 100 });
    return l;
  }

  moon(color: number, intensity: number, x: number, y: number, z: number): THREE.DirectionalLight {
    const d = new THREE.DirectionalLight(color, intensity);
    d.position.set(x, y, z);
    d.castShadow = true;
    d.shadow.mapSize.set(1024, 1024);
    const c = d.shadow.camera;
    c.left = -30;
    c.right = 30;
    c.top = 30;
    c.bottom = -30;
    c.far = 120;
    this.root.add(d, d.target);
    return d;
  }

  hemi(sky: number, ground: number, intensity: number): void {
    this.root.add(new THREE.HemisphereLight(sky, ground, intensity));
  }

  update(dt: number): void {
    this.time += dt;
    animateFlames(this.flames, this.time);
    for (const f of this.flickers) f.light.intensity = f.base * (0.85 + Math.sin(this.time * 11 + f.seed) * 0.08 + Math.sin(this.time * 23 + f.seed) * 0.05);
    const h = this.ctx.gr.renderer.domElement.height;
    this.particles.setPixelScale(h / (2 * Math.tan((this.camera.fov * Math.PI) / 360)), true);
    this.particles.update(dt, { x: this.camera.position.x, z: this.camera.position.z });
  }

  render(): void {
    this.ctx.gr.render(this.camera);
  }

  dispose(): void {
    this.particles.dispose();
    this.ctx.gr.scene.remove(this.root);
    disposeObject(this.root);
  }
}

export { MATS };
