import * as THREE from 'three';
import { disposeObject } from '../dispose';

type Transient = { obj: THREE.Object3D; life: number; max: number; update: (u: number, dt: number) => void };

const additive = (color: number, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });

const TELE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const TELE_FRAG = /* glsl */ `
  uniform float uProgress;
  uniform float uArc;   // half-angle in radians (PI = full circle)
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float ang = abs(atan(p.x, p.y));
    if (ang > uArc) discard;
    float edge = smoothstep(0.9, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
    float sideEdge = uArc < 3.1 ? smoothstep(uArc - 0.06, uArc, ang) : 0.0;
    float fill = r < uProgress ? 0.35 : 0.1;
    float ringFront = smoothstep(uProgress - 0.04, uProgress, r) * (1.0 - smoothstep(uProgress, uProgress + 0.01, r));
    float a = (fill + edge * 0.9 + sideEdge * 0.8 + ringFront * 0.6) * uAlpha;
    gl_FragColor = vec4(uColor, a);
  }
`;

export class Fx {
  private items: Transient[] = [];

  constructor(private readonly parent: THREE.Object3D) {}

  private add(obj: THREE.Object3D, life: number, update: (u: number, dt: number) => void): void {
    this.parent.add(obj);
    this.items.push({ obj, life, max: life, update });
  }

  /** flat crescent slash at height y, centered on facing */
  slash(x: number, z: number, facing: number, radius: number, arcDeg: number, color = 0xffc080, y = 0.9, width = 0.55): void {
    const arc = (arcDeg * Math.PI) / 180;
    const geo = new THREE.RingGeometry(radius - width, radius, 24, 1, -arc / 2, arc);
    const mat = additive(color, 0.9);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = facing - Math.PI / 2;
    g.add(m);
    // RingGeometry angle 0 = +x in its plane; after rotations it points along facing
    this.add(g, 0.22, (u) => {
      mat.opacity = 0.9 * (1 - u);
      const s = 0.85 + u * 0.25;
      g.scale.set(s, 1, s);
      m.rotation.z = -u * 0.5;
    });
    void m;
  }

  /** expanding fire ring for Ember Nova */
  nova(x: number, z: number, radius: number): void {
    const geo = new THREE.RingGeometry(0.7, 1, 48);
    const mat = additive(0xff8a3a, 1);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.15, z);
    this.add(m, 0.55, (u) => {
      const s = 0.5 + u * radius;
      m.scale.set(s, s, 1);
      mat.opacity = 1 - u * u;
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 32), additive(0xff9040, 0.3));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, 0.1, z);
    const dm = disc.material as THREE.MeshBasicMaterial;
    this.add(disc, 0.35, (u) => {
      const s = radius * (0.3 + u * 0.8);
      disc.scale.set(s, s, 1);
      dm.opacity = 0.3 * (1 - u);
    });
  }

  /** ground shockwave (boss slam, charge impact) */
  shockwave(x: number, z: number, radius: number, color = 0xd0c0a0): void {
    const geo = new THREE.RingGeometry(0.85, 1, 40);
    const mat = additive(color, 0.8);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.12, z);
    this.add(m, 0.4, (u) => {
      const s = 0.3 + u * radius;
      m.scale.set(s, s, 1);
      mat.opacity = 0.8 * (1 - u);
    });
  }

  /** vertical light pillar (level up, nova unlock, boss death) */
  pillar(x: number, z: number, color = 0xffc070, height = 6, life = 1.2, radius = 0.8): void {
    const geo = new THREE.CylinderGeometry(radius, radius, height, 16, 1, true);
    geo.translate(0, height / 2, 0);
    const mat = additive(color, 0.6);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 0, z);
    this.add(m, life, (u) => {
      mat.opacity = 0.6 * (1 - u) * Math.min(1, u * 8);
      m.scale.set(1 - u * 0.6, 1, 1 - u * 0.6);
    });
  }

  /** red ground decal that fills over `duration` */
  telegraph(x: number, z: number, radius: number, duration: number, arcDeg = 360, facing = 0, color = 0xff2a1a): void {
    const mat = new THREE.ShaderMaterial({
      vertexShader: TELE_VERT,
      fragmentShader: TELE_FRAG,
      uniforms: {
        uProgress: { value: 0 },
        uArc: { value: (Math.min(360, arcDeg) * Math.PI) / 360 },
        uColor: { value: new THREE.Color(color) },
        uAlpha: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
    m.rotation.x = -Math.PI / 2;
    const g = new THREE.Group();
    g.position.set(x, 0.06, z);
    g.rotation.y = facing + Math.PI;
    g.add(m);
    this.add(g, duration + 0.12, (u) => {
      const t = u * (duration + 0.12);
      mat.uniforms.uProgress.value = Math.min(1, t / duration);
      mat.uniforms.uAlpha.value = t > duration ? 1 - (t - duration) / 0.12 : Math.min(1, t * 6);
    });
  }

  /** thin aim line from a to b (archer windup) */
  aimLine(ax: number, az: number, bx: number, bz: number, duration: number): void {
    const len = Math.hypot(bx - ax, bz - az);
    const geo = new THREE.PlaneGeometry(0.08, len);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, len / 2);
    const mat = additive(0xff3020, 0.0);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(ax, 0.08, az);
    m.rotation.y = Math.atan2(bx - ax, bz - az);
    this.add(m, duration, (u) => {
      mat.opacity = 0.15 + u * 0.55;
    });
  }

  /** streak behind a dash */
  streak(ax: number, az: number, bx: number, bz: number): void {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.1) return;
    const geo = new THREE.PlaneGeometry(0.9, len);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, len / 2);
    const mat = additive(0xff9a4a, 0.5);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(ax, 0.9, az);
    m.rotation.y = Math.atan2(bx - ax, bz - az);
    this.add(m, 0.35, (u) => {
      mat.opacity = 0.5 * (1 - u);
      m.scale.x = 1 - u;
    });
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      const u = Math.min(1, 1 - it.life / it.max);
      it.update(u, dt);
      if (it.life <= 0) {
        this.parent.remove(it.obj);
        it.obj.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
          }
        });
        this.items.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const it of this.items) {
      this.parent.remove(it.obj);
      disposeObject(it.obj);
    }
    this.items = [];
  }
}
