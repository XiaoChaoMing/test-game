import * as THREE from 'three';

export type ParticlePreset = 'ash' | 'spark' | 'blood' | 'dust' | 'ember' | 'soul' | 'smoke' | 'fire' | 'bone' | 'heal' | 'levelup' | 'hitspark' | 'mote';

type PresetDef = {
  additive: boolean;
  life: [number, number];
  size: [number, number];
  speed: [number, number];
  spread: number; // 0 = along dir, 1 = sphere
  gravity: number;
  drag: number;
  colors: [number, number];
  upBias: number;
  sizeEnd: number; // multiplier at end of life
  alpha: number;
};

const PRESETS: Record<ParticlePreset, PresetDef> = {
  ash: { additive: false, life: [6, 10], size: [0.07, 0.13], speed: [0.1, 0.4], spread: 1, gravity: -0.25, drag: 0.2, colors: [0x8a8580, 0x55524e], upBias: 0, sizeEnd: 1, alpha: 0.85 },
  spark: { additive: true, life: [0.4, 1.0], size: [0.05, 0.1], speed: [0.4, 1.2], spread: 0.6, gravity: 0.6, drag: 0.8, colors: [0xffc070, 0xff6a20], upBias: 1, sizeEnd: 0.3, alpha: 1 },
  ember: { additive: true, life: [1.0, 2.2], size: [0.06, 0.12], speed: [0.5, 1.6], spread: 0.5, gravity: 0.9, drag: 0.6, colors: [0xffb050, 0xff5a10], upBias: 1.2, sizeEnd: 0.2, alpha: 1 },
  fire: { additive: true, life: [0.3, 0.7], size: [0.25, 0.45], speed: [1, 3], spread: 1, gravity: 1.5, drag: 2.5, colors: [0xffd080, 0xff4a10], upBias: 0.6, sizeEnd: 0.1, alpha: 1 },
  blood: { additive: false, life: [0.35, 0.7], size: [0.07, 0.14], speed: [2, 5], spread: 0.7, gravity: -12, drag: 1.5, colors: [0x8a0e0e, 0x4a0606], upBias: 0.6, sizeEnd: 0.6, alpha: 1 },
  bone: { additive: false, life: [0.4, 0.8], size: [0.06, 0.11], speed: [2, 5], spread: 0.8, gravity: -14, drag: 1, colors: [0xd8ccb0, 0x9a9078], upBias: 0.8, sizeEnd: 0.8, alpha: 1 },
  dust: { additive: false, life: [0.6, 1.2], size: [0.25, 0.5], speed: [0.8, 2.2], spread: 1, gravity: 0.3, drag: 3, colors: [0x6b625a, 0x3e3934], upBias: 0.2, sizeEnd: 1.8, alpha: 0.55 },
  smoke: { additive: false, life: [2.5, 4], size: [0.4, 0.7], speed: [0.2, 0.5], spread: 0.4, gravity: 0.35, drag: 0.4, colors: [0x2a2826, 0x1a1918], upBias: 1, sizeEnd: 2.6, alpha: 0.35 },
  soul: { additive: true, life: [1.2, 2.4], size: [0.08, 0.16], speed: [0.3, 1.0], spread: 0.8, gravity: 0.7, drag: 0.6, colors: [0x9fe6ff, 0x3f8cff], upBias: 1, sizeEnd: 0.2, alpha: 1 },
  heal: { additive: true, life: [0.6, 1.1], size: [0.08, 0.15], speed: [0.6, 1.6], spread: 0.4, gravity: 1.2, drag: 0.5, colors: [0xff6060, 0xffc0a0], upBias: 1, sizeEnd: 0.2, alpha: 1 },
  levelup: { additive: true, life: [0.8, 1.6], size: [0.1, 0.2], speed: [1, 4], spread: 0.5, gravity: 1.5, drag: 0.8, colors: [0xffe090, 0xff8a3a], upBias: 1.4, sizeEnd: 0.2, alpha: 1 },
  hitspark: { additive: true, life: [0.12, 0.25], size: [0.08, 0.16], speed: [4, 9], spread: 0.9, gravity: -4, drag: 4, colors: [0xffffff, 0xffc070], upBias: 0.3, sizeEnd: 0.2, alpha: 1 },
  mote: { additive: true, life: [4, 8], size: [0.04, 0.08], speed: [0.05, 0.2], spread: 1, gravity: 0.05, drag: 0.1, colors: [0x7fa8d8, 0x3f5c88], upBias: 0, sizeEnd: 1, alpha: 0.7 },
};

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec4 aColor;
  uniform float uScale;
  uniform float uAtten;
  varying vec4 vColor;
  #include <fog_pars_vertex>
  void main() {
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = min(18.0, aSize * uScale * (uAtten > 0.5 ? 1.0 / max(0.1, -mvPosition.z) : 1.0));
    #include <fog_vertex>
  }
`;
const FRAG = /* glsl */ `
  varying vec4 vColor;
  #include <fog_pars_fragment>
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.15, r) * vColor.a;
    gl_FragColor = vec4(vColor.rgb, a);
    #include <fog_fragment>
  }
`;

class Layer {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly baseSize: Float32Array;
  private readonly preset: Uint8Array;
  private readonly startCol: Float32Array;
  private cursor = 0;
  private alive = 0;

  constructor(readonly capacity: number, additive: boolean) {
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 4);
    this.size = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);
    this.preset = new Uint8Array(capacity);
    this.startCol = new Float32Array(capacity * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 40 }, uAtten: { value: 0 } }]),
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      fog: true,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 10 : 9;
  }

  spawn(presetIdx: number, def: PresetDef, x: number, y: number, z: number, dx: number, dy: number, dz: number, c0: THREE.Color, c1: THREE.Color): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    // direction: blend of given dir and a random sphere
    let rx = Math.random() * 2 - 1;
    let ry = Math.random() * 2 - 1;
    let rz = Math.random() * 2 - 1;
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl;
    ry /= rl;
    rz /= rl;
    const s = def.spread;
    let vx = dx * (1 - s) + rx * s;
    let vy = dy * (1 - s) + ry * s + def.upBias * 0.5;
    let vz = dz * (1 - s) + rz * s;
    const vl = Math.hypot(vx, vy, vz) || 1;
    const sp = rnd(def.speed[0], def.speed[1]);
    vx = (vx / vl) * sp;
    vy = (vy / vl) * sp;
    vz = (vz / vl) * sp;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    const life = rnd(def.life[0], def.life[1]);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.baseSize[i] = rnd(def.size[0], def.size[1]);
    this.preset[i] = presetIdx;
    const k = Math.random();
    this.startCol[i * 6] = c0.r + (c1.r - c0.r) * k;
    this.startCol[i * 6 + 1] = c0.g + (c1.g - c0.g) * k;
    this.startCol[i * 6 + 2] = c0.b + (c1.b - c0.b) * k;
    this.alive++;
  }

  update(dt: number, defs: PresetDef[]): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) {
        this.size[i] = 0;
        continue;
      }
      const def = defs[this.preset[i]];
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.size[i] = 0;
        this.col[i * 4 + 3] = 0;
        this.alive--;
        continue;
      }
      const drag = Math.exp(-def.drag * dt);
      this.vel[i * 3] *= drag;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag + def.gravity * dt;
      this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02 && def.gravity < 0) {
        this.pos[i * 3 + 1] = 0.02;
        this.vel[i * 3] *= 0.5;
        this.vel[i * 3 + 1] = 0;
        this.vel[i * 3 + 2] *= 0.5;
      }
      const u = 1 - this.life[i] / this.maxLife[i];
      const fadeIn = Math.min(1, u * 8);
      const fadeOut = Math.min(1, (1 - u) * 3);
      this.size[i] = this.baseSize[i] * (1 + (def.sizeEnd - 1) * u);
      this.col[i * 4] = this.startCol[i * 6];
      this.col[i * 4 + 1] = this.startCol[i * 6 + 1];
      this.col[i * 4 + 2] = this.startCol[i * 6 + 2];
      this.col[i * 4 + 3] = def.alpha * fadeIn * fadeOut;
    }
    const geo = this.points.geometry;
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  }
}

const PRESET_NAMES = Object.keys(PRESETS) as ParticlePreset[];
const PRESET_DEFS = PRESET_NAMES.map((n) => PRESETS[n]);

export class Particles {
  private readonly additive: Layer;
  private readonly normal: Layer;
  private readonly colorCache = new Map<number, THREE.Color>();
  scale = 1;
  private ambient: { preset: ParticlePreset; rate: number; acc: number; area: number; height: number } | null = null;
  private emitters: { preset: ParticlePreset; x: number; y: number; z: number; rate: number; acc: number }[] = [];

  constructor(readonly parent: THREE.Object3D, budget = 4000) {
    this.additive = new Layer(budget, true);
    this.normal = new Layer(budget, false);
    parent.add(this.additive.points, this.normal.points);
  }

  private color(hex: number): THREE.Color {
    let c = this.colorCache.get(hex);
    if (!c) {
      c = new THREE.Color(hex);
      this.colorCache.set(hex, c);
    }
    return c;
  }

  /** pixel scale: world units → pixels for the ortho camera */
  setPixelScale(px: number, perspective = false): void {
    for (const m of [this.additive.material, this.normal.material]) {
      m.uniforms.uScale.value = px;
      m.uniforms.uAtten.value = perspective ? 1 : 0;
    }
  }

  emit(preset: ParticlePreset, pos: { x: number; y: number; z: number }, count = 10, dir?: { x: number; y: number; z: number }): void {
    const def = PRESETS[preset];
    const idx = PRESET_NAMES.indexOf(preset);
    const layer = def.additive ? this.additive : this.normal;
    const n = Math.max(1, Math.round(count * this.scale));
    const c0 = this.color(def.colors[0]);
    const c1 = this.color(def.colors[1]);
    for (let i = 0; i < n; i++) layer.spawn(idx, def, pos.x, pos.y, pos.z, dir?.x ?? 0, dir?.y ?? 1, dir?.z ?? 0, c0, c1);
  }

  /** ring burst on the ground plane */
  ring(preset: ParticlePreset, center: { x: number; y: number; z: number }, radius: number, count: number): void {
    const n = Math.max(1, Math.round(count * this.scale));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = { x: center.x + Math.sin(a) * radius, y: center.y, z: center.z + Math.cos(a) * radius };
      this.emit(preset, p, 1, { x: Math.sin(a), y: 0.4, z: Math.cos(a) });
    }
  }

  setAmbient(preset: ParticlePreset | null, rate = 0, area = 30, height = 12): void {
    this.ambient = preset ? { preset, rate, acc: 0, area, height } : null;
  }

  addEmitter(preset: ParticlePreset, x: number, y: number, z: number, rate: number): void {
    this.emitters.push({ preset, x, y, z, rate, acc: Math.random() });
  }

  clearEmitters(): void {
    this.emitters = [];
  }

  update(dt: number, focus: { x: number; z: number }): void {
    if (this.ambient) {
      const a = this.ambient;
      a.acc += a.rate * this.scale * dt;
      while (a.acc >= 1) {
        a.acc -= 1;
        const x = focus.x + (Math.random() - 0.5) * a.area * 2;
        const z = focus.z + (Math.random() - 0.5) * a.area * 2;
        this.emit(a.preset, { x, y: Math.random() * a.height + 1, z }, 1, { x: 0.3, y: -1, z: 0.1 });
      }
    }
    for (const e of this.emitters) {
      const d2 = (e.x - focus.x) ** 2 + (e.z - focus.z) ** 2;
      if (d2 > 30 * 30) continue;
      e.acc += e.rate * dt;
      while (e.acc >= 1) {
        e.acc -= 1;
        this.emit(e.preset, { x: e.x + (Math.random() - 0.5) * 0.2, y: e.y, z: e.z + (Math.random() - 0.5) * 0.2 }, 1);
      }
    }
    this.additive.update(dt, PRESET_DEFS);
    this.normal.update(dt, PRESET_DEFS);
  }

  dispose(): void {
    this.parent.remove(this.additive.points, this.normal.points);
    this.additive.points.geometry.dispose();
    this.normal.points.geometry.dispose();
    this.additive.material.dispose();
    this.normal.material.dispose();
  }
}
