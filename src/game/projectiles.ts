import * as THREE from 'three';
import type { Actor } from './actor';
import type { World } from './world';
import type { CombatSystem } from './combat-system';
import { cachedGeo } from '../render/characters/rig';
import { markShared } from '../render/dispose';

type Projectile = { mesh: THREE.Object3D; x: number; z: number; vx: number; vz: number; life: number; src: Actor; mult: number };

const arrowMat = markShared(new THREE.MeshBasicMaterial({ color: 0x9fe6ff, toneMapped: false }));
const shaftMat = markShared(new THREE.MeshStandardMaterial({ color: 0x3a2a1e }));

export class Projectiles {
  private list: Projectile[] = [];

  constructor(private readonly world: World, private readonly combat: CombatSystem) {}

  fireArrow(src: Actor, toX: number, toZ: number, speed: number): void {
    const dx = toX - src.pos.x;
    const dz = toZ - src.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(cachedGeo('arrow-shaft', () => new THREE.BoxGeometry(0.04, 0.04, 0.8)), shaftMat);
    const head = new THREE.Mesh(cachedGeo('arrow-head', () => new THREE.ConeGeometry(0.06, 0.18, 4).rotateX(Math.PI / 2)), arrowMat);
    head.position.z = 0.45;
    g.add(shaft, head);
    g.position.set(src.pos.x, 1.25, src.pos.z);
    g.rotation.y = Math.atan2(dx, dz);
    this.world.root.add(g);
    this.list.push({ mesh: g, x: src.pos.x, z: src.pos.z, vx: (dx / l) * speed, vz: (dz / l) * speed, life: 2, src, mult: 1 });
  }

  update(dt: number): void {
    const w = this.world;
    const p = w.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const pr = this.list[i];
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.z += pr.vz * dt;
      pr.mesh.position.set(pr.x, 1.25, pr.z);
      if (Math.random() < 0.5) w.particles.emit('soul', { x: pr.x, y: 1.25, z: pr.z }, 1, { x: 0, y: 0.2, z: 0 });
      let done = pr.life <= 0 || !w.grid.isWalkableWorld({ x: pr.x, z: pr.z });
      if (!done && p.alive && Math.hypot(p.pos.x - pr.x, p.pos.z - pr.z) < p.radius + 0.15) {
        this.combat.dealDamage(pr.src, p, pr.mult, { dir: { x: pr.vx, z: pr.vz }, knockback: 1.5 });
        done = true;
      }
      if (done) {
        w.particles.emit('hitspark', { x: pr.x, y: 1.2, z: pr.z }, 4);
        w.root.remove(pr.mesh);
        this.list.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const pr of this.list) this.world.root.remove(pr.mesh);
    this.list = [];
  }
}
