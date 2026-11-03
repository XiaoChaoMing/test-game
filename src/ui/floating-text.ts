import * as THREE from 'three';

type Floater = { el: HTMLElement; pos: THREE.Vector3; life: number; max: number; vx: number; rise: number };

/** Damage numbers and small labels projected from world space. */
export class FloatingText {
  private items: Floater[] = [];
  private readonly v = new THREE.Vector3();

  constructor(private readonly root: HTMLElement, private readonly camera: THREE.Camera) {}

  spawn(text: string, pos: THREE.Vector3, cls = '', life = 0.9): void {
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.textContent = text;
    this.root.appendChild(el);
    this.items.push({ el, pos: pos.clone(), life, max: life, vx: (Math.random() - 0.5) * 40, rise: 60 + Math.random() * 20 });
    if (this.items.length > 60) this.remove(0);
  }

  private remove(i: number): void {
    this.items[i].el.remove();
    this.items.splice(i, 1);
  }

  update(dt: number, w: number, h: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.remove(i);
        continue;
      }
      const u = 1 - f.life / f.max;
      this.v.copy(f.pos).project(this.camera);
      const x = (this.v.x * 0.5 + 0.5) * w + f.vx * u;
      const y = (-this.v.y * 0.5 + 0.5) * h - f.rise * (1 - (1 - u) * (1 - u));
      const pop = u < 0.12 ? 1 + (0.12 - u) * 4 : 1;
      f.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${pop})`;
      f.el.style.left = '0';
      f.el.style.top = '0';
      f.el.style.opacity = String(u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1);
    }
  }

  clear(): void {
    for (const f of this.items) f.el.remove();
    this.items = [];
  }
}
