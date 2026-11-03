import * as THREE from 'three';
import type { GameContext, Scene } from './scene';
import { Stage, MATS } from './cinema';
import { t } from '../data/strings';
import { buildCharacter, type CharacterView } from '../render/characters/builders';
import { cachedGeo } from '../render/characters/rig';

type ShotRuntime = { update(time: number, dt: number): void };
type Shot = { duration: number; lines: [string, string]; build(stage: Stage): ShotRuntime };

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (x: number) => x * x * (3 - 2 * x);
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function camPath(cam: THREE.PerspectiveCamera, u: number, from: THREE.Vector3, to: THREE.Vector3, lookFrom: THREE.Vector3, lookTo: THREE.Vector3): void {
  const k = smooth(Math.min(1, Math.max(0, u)));
  cam.position.lerpVectors(from, to, k);
  cam.lookAt(new THREE.Vector3().lerpVectors(lookFrom, lookTo, k));
}

// ---------------------------------------------------------------- shots

const sanctum: Shot = {
  duration: 18,
  lines: ['intro.1.a', 'intro.1.b'],
  build(s) {
    s.env(0x0d1018, 0x141824, 40, 160);
    s.hemi(0x6a7898, 0x2a2018, 2.2);
    s.moon(0xa8bce8, 2.6, 30, 34, 26);
    s.ground(0x2e2b2a);
    // hill
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 6 + (i % 3);
      s.prop({ kind: 'cliff-rock', x: Math.cos(a) * r, z: Math.sin(a) * r, scale: 1.6 + (i % 4) * 0.3, seed: i });
    }
    // tower
    const tower = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x5a5856, roughness: 0.95, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 1, flatShading: true });
    for (let i = 0; i < 7; i++) {
      const r = 2.6 - i * 0.18;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.1, r, 2.4, 10), i % 2 ? stone : dark);
      seg.position.y = 1.2 + i * 2.4;
      seg.castShadow = true;
      seg.receiveShadow = true;
      tower.add(seg);
      if (i > 0 && i < 6) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.3), MATS.void);
        win.position.set(Math.sin(i) * (r - 0.05), 1.2 + i * 2.4, Math.cos(i) * (r - 0.05));
        win.lookAt(0, win.position.y, 0);
        tower.add(win);
      }
    }
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.6, 0.6, 10), dark);
    crown.position.y = 17.4;
    tower.add(crown);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.4), stone);
      m.position.set(Math.cos(a) * 2.0, 18.0, Math.sin(a) * 2.0);
      m.rotation.y = -a;
      tower.add(m);
    }
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.6, 0.8, 10), MATS.iron);
    bowl.position.y = 18.4;
    tower.add(bowl);
    s.root.add(tower);
    // the Eternal Flame (dies at the end of the shot)
    const flame = new THREE.Group();
    const outer = new THREE.Mesh(cachedGeo('flame-o', () => new THREE.ConeGeometry(0.12, 0.42, 5)), MATS.flame);
    const inner = new THREE.Mesh(cachedGeo('flame-i', () => new THREE.ConeGeometry(0.06, 0.24, 5)), MATS.flameCore);
    outer.position.y = 0.18;
    inner.position.y = 0.12;
    flame.add(outer, inner);
    flame.position.y = 18.7;
    flame.scale.setScalar(7);
    s.root.add(flame);
    const fireLight = s.light(0xff8a3a, 400, 60, 0, 21, 0);
    s.particles.setAmbient('ash', 30, 25, 25);
    let died = false;
    return {
      update(time, dt) {
        camPath(s.camera, time / 18, v3(30, 4, 30), v3(22, 20, 18), v3(0, 9, 0), v3(0, 17.5, 0));
        const life = time < 13 ? 1 : Math.max(0, 1 - (time - 13) / 1.6);
        const fl = 1 + Math.sin(time * 12) * 0.08 + Math.sin(time * 27) * 0.05;
        flame.scale.set(7 * life * fl, 7 * life * (fl + 0.1), 7 * life * fl);
        flame.rotation.y = time * 1.5;
        fireLight.intensity = 400 * life * fl;
        if (life > 0 && Math.random() < dt * 25 * life) s.particles.emit('ember', { x: (Math.random() - 0.5) * 1.5, y: 19.2, z: (Math.random() - 0.5) * 1.5 }, 1);
        if (!died && life <= 0) {
          died = true;
          s.particles.emit('smoke', { x: 0, y: 19.5, z: 0 }, 40);
          s.particles.addEmitter('smoke', 0, 19.2, 0, 4);
        }
      },
    };
  },
};

const ashFields: Shot = {
  duration: 18,
  lines: ['intro.2.a', 'intro.2.b'],
  build(s) {
    s.env(0x15151a, 0x2a2826, 12, 70);
    s.hemi(0x6a6c78, 0x2a2420, 1.6);
    s.moon(0xb8b4b0, 1.4, -20, 30, 10);
    s.ground(0x5a5652);
    const ruins = [[-8, -6], [6, -10], [14, -4], [-2, -16], [20, -14], [-14, -14]];
    ruins.forEach(([x, z], i) => s.prop({ kind: 'house-ruin', x, z, rot: i * 0.7, seed: i + 3 }));
    for (let i = 0; i < 40; i++) {
      const x = -30 + (i * 37) % 60;
      const z = -26 + ((i * 53) % 30);
      s.prop({ kind: i % 3 ? 'dead-tree' : 'pine-dead', x, z, scale: 1 + (i % 4) * 0.25, seed: i });
    }
    for (let i = 0; i < 12; i++) s.prop({ kind: 'fence', x: -20 + i * 1, z: 2 + Math.sin(i) * 0.3, rot: Math.PI / 2 + 0.1 * (i % 3) });
    s.prop({ kind: 'cart', x: 4, z: -1, rot: 0.4 });
    s.particles.setAmbient('ash', 260, 30, 16);
    return {
      update(time) {
        camPath(s.camera, time / 18, v3(-24, 3.2, 10), v3(16, 4.6, 8), v3(-14, 2, -6), v3(20, 2, -10));
      },
    };
  },
};

const graveyard: Shot = {
  duration: 18,
  lines: ['intro.3.a', 'intro.3.b'],
  build(s) {
    s.env(0x080a12, 0x0c1018, 18, 70);
    s.hemi(0x4a5a7a, 0x181818, 2.0);
    s.moon(0x7a9ad8, 1.8, -10, 30, -20);
    s.ground(0x34322e);
    for (let gx = 0; gx < 6; gx++)
      for (let gz = 0; gz < 4; gz++) s.prop({ kind: gx % 2 ? 'gravestone' : 'grave-cross', x: -7.5 + gx * 3, z: -9 + gz * 3.2, rot: (gx * gz) % 3 * 0.15, seed: gx * 4 + gz });
    s.prop({ kind: 'dead-tree', x: 8, z: -6, scale: 1.6, seed: 4 });
    s.prop({ kind: 'statue', x: -9, z: -1 });
    s.prop({ kind: 'torch', x: 5, z: 1 });
    for (let i = 0; i < 14; i++) s.prop({ kind: 'stone-wall', x: -10 + i, z: 3 });
    const blue = s.light(0x4a8aff, 30, 25, 0, 4, -4, true);
    void blue;
    const risers: { v: CharacterView; delay: number; x: number; z: number }[] = [];
    const spots = [[-4.5, -5.5], [1.5, -2.6], [-1.5, -8.5], [4.5, -5.6], [-6.5, -2.4]];
    spots.forEach(([x, z], i) => {
      const v = buildCharacter(i === 3 ? 'archer' : 'husk');
      v.root.position.set(x, -2.2, z + 1.2);
      v.setFacing(Math.PI * 0.15, true);
      v.play('idle');
      s.root.add(v.root);
      risers.push({ v, delay: 2 + i * 1.6, x, z: z + 1.2 });
    });
    s.particles.setAmbient('mote', 40, 14, 4);
    return {
      update(time, dt) {
        camPath(s.camera, time / 18, v3(10, 5, 14), v3(4, 2.4, 6), v3(0, 0.5, -4), v3(-1, 1.2, -5));
        for (const r of risers) {
          const k = Math.min(1, Math.max(0, (time - r.delay) / 2.4));
          r.v.root.position.y = lerp(-2.2, 0, smooth(k));
          if (k > 0 && k < 1 && Math.random() < dt * 20) {
            s.particles.emit('dust', { x: r.x, y: 0.1, z: r.z }, 1);
            s.particles.emit('soul', { x: r.x, y: 0.4, z: r.z }, 1);
          }
          if (k >= 1 && r.v.anim.current === 'idle' && time > r.delay + 3) r.v.play('walk', 0.6);
          if (r.v.anim.current === 'walk') r.v.root.position.z += dt * 0.5;
          r.v.update(dt);
        }
      },
    };
  },
};

const wanderer: Shot = {
  duration: 17,
  lines: ['intro.4.a', 'intro.4.b'],
  build(s) {
    s.env(0x0c0c12, 0x16161c, 20, 80);
    s.hemi(0x6a7490, 0x2a2018, 2.2);
    s.moon(0x8fa3c8, 1.8, -20, 30, 15);
    s.ground(0x4a4038);
    // road to the village gate
    const road = new THREE.Mesh(new THREE.PlaneGeometry(3, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 1 }));
    road.position.set(0, 0.02, -10);
    road.receiveShadow = true;
    s.root.add(road);
    s.prop({ kind: 'torch', x: -2.2, z: -14 });
    s.prop({ kind: 'torch', x: 2.2, z: -14 });
    for (let i = 0; i < 8; i++) {
      s.prop({ kind: 'fence', x: -3 - i * 0.95, z: -14.5, rot: 0 });
      s.prop({ kind: 'fence', x: 3 + i * 0.95, z: -14.5, rot: 0 });
    }
    s.prop({ kind: 'house-ruin', x: -9, z: -21, rot: 0.3, seed: 1 });
    s.prop({ kind: 'house-ruin', x: 8, z: -23, rot: -0.2, seed: 2 });
    s.prop({ kind: 'campfire', x: 1, z: -24 });
    s.prop({ kind: 'banner', x: -2.6, z: -15, rot: 0 });
    for (let i = 0; i < 16; i++) s.prop({ kind: i % 2 ? 'dead-tree' : 'rock', x: (i % 2 ? -1 : 1) * (6 + (i * 7) % 10), z: 6 - i * 2.2, seed: i, scale: 1.1 });
    const hero = buildCharacter('wanderer');
    hero.root.position.set(0, 0, 8);
    hero.setFacing(Math.PI, true);
    hero.play('walk', 0.9);
    s.root.add(hero.root);
    const spark = s.light(0xff8a3a, 3, 5, 0, 1.6, 8);
    s.particles.setAmbient('ash', 90, 20, 12);
    return {
      update(time, dt) {
        const z = 8 - Math.min(time, 13) * 1.0;
        hero.root.position.z = z;
        if (time > 13 && hero.anim.current === 'walk') hero.play('idle');
        hero.update(dt);
        spark.position.set(0, 1.4, z - 0.6);
        if (Math.random() < dt * 6) s.particles.emit('ember', { x: 0, y: 1.3, z: z + 0.15 }, 1);
        camPath(s.camera, time / 17, v3(3, 1.6, 12), v3(6, 8, 4), v3(0, 1.4, 6), v3(0, 0.8, -8));
      },
    };
  },
};

const SHOTS: Shot[] = [sanctum, ashFields, graveyard, wanderer];

export class IntroScene implements Scene {
  private stage: Stage | null = null;
  private runtime: ShotRuntime | null = null;
  private shotIdx = -1;
  private shotTime = 0;
  private overlay!: HTMLElement;
  private lineA!: HTMLElement;
  private lineB!: HTMLElement;
  private fading = false;
  private done = false;
  private readonly onResize = () => this.stage?.resize();

  constructor(private readonly ctx: GameContext, private readonly onDone: () => void) {}

  enter(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'screen letterbox';
    this.overlay.style.pointerEvents = 'none';
    this.overlay.innerHTML = `<div class="narration"><div class="line a"></div><div class="line b"></div></div><div class="skip-hint">${t('intro.skip')}</div>`;
    this.lineA = this.overlay.querySelector('.line.a')!;
    this.lineB = this.overlay.querySelector('.line.b')!;
    this.ctx.ui.appendChild(this.overlay);
    window.addEventListener('resize', this.onResize);
    this.nextShot();
  }

  private nextShot(): void {
    this.stage?.dispose();
    this.shotIdx++;
    if (this.shotIdx >= SHOTS.length) {
      this.finish();
      return;
    }
    const shot = SHOTS[this.shotIdx];
    this.stage = new Stage(this.ctx);
    this.runtime = shot.build(this.stage);
    this.shotTime = 0;
    this.lineA.classList.remove('show');
    this.lineB.classList.remove('show');
    this.lineA.textContent = t(shot.lines[0]);
    this.lineB.textContent = t(shot.lines[1]);
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.onDone();
  }

  update(dt: number): void {
    const inp = this.ctx.input;
    if (inp.keyPressed('Space') || inp.keyPressed('Escape') || inp.keyPressed('Enter')) this.finish();
    if (!this.stage || !this.runtime || this.done) return;
    const shot = SHOTS[this.shotIdx];
    this.shotTime += dt;
    this.runtime.update(this.shotTime, dt);
    this.stage.update(dt);
    if (this.shotTime > 1.0) this.lineA.classList.add('show');
    if (this.shotTime > 5.5) this.lineB.classList.add('show');
    if (this.shotTime > shot.duration - 2.2) {
      this.lineA.classList.remove('show');
      this.lineB.classList.remove('show');
    }
    // fade to black between shots using the grade pass
    const g = this.ctx.gr.grade.uniforms.uFade;
    const fadeIn = Math.max(0, 1 - this.shotTime / 1.2);
    const fadeOut = Math.max(0, (this.shotTime - (shot.duration - 1.2)) / 1.2);
    if (!this.ctx.scenes.transitioning) g.value = Math.min(1, Math.max(fadeIn, fadeOut));
    this.fading = fadeOut >= 1;
    if (this.fading) this.nextShot();
  }

  render(): void {
    this.stage?.render();
  }

  exit(): void {
    this.stage?.dispose();
    this.stage = null;
    this.overlay.remove();
    window.removeEventListener('resize', this.onResize);
  }
}
