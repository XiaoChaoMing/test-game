import * as THREE from 'three';
import { PLAYER_BASE } from '../data/player';
import type { World } from './world';
import type { PlayerState } from './player-state';
import type { Vec2 } from '../logic/vec';
import { disposeObject, markShared } from '../render/dispose';

type Pickup = { obj: THREE.Group; pos: Vec2; t: number };

const flaskMat = markShared(new THREE.MeshStandardMaterial({ color: 0xc01010, emissive: 0x800000, emissiveIntensity: 1.2, roughness: 0.3 }));
const corkMat = markShared(new THREE.MeshStandardMaterial({ color: 0x8a6a3a }));
const glowMat = markShared(new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));

export class Pickups {
  private list: Pickup[] = [];

  constructor(private readonly world: World, private readonly ps: PlayerState) {}

  dropPotion(at: Vec2): void {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), flaskMat);
    body.position.y = 0.2;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 6), flaskMat);
    neck.position.y = 0.38;
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6), corkMat);
    cork.position.y = 0.46;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.03;
    body.castShadow = true;
    g.add(body, neck, cork, glow);
    g.position.set(at.x, 0, at.z);
    this.world.root.add(g);
    this.list.push({ obj: g, pos: { ...at }, t: Math.random() * 6 });
  }

  update(dt: number): void {
    const p = this.world.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const it = this.list[i];
      it.t += dt;
      it.obj.position.y = Math.sin(it.t * 3) * 0.06 + 0.05;
      it.obj.rotation.y = it.t;
      if (!p.alive) continue;
      const d = Math.hypot(p.pos.x - it.pos.x, p.pos.z - it.pos.z);
      if (d < 0.9 && this.ps.potions < PLAYER_BASE.maxPotions) {
        this.ps.potions++;
        this.world.particles.emit('heal', { x: it.pos.x, y: 0.4, z: it.pos.z }, 12);
        this.world.root.remove(it.obj);
        disposeObject(it.obj);
        this.list.splice(i, 1);
        this.world.bus.emit('pickup', { kind: 'potion' });
      }
    }
  }

  clear(): void {
    for (const it of this.list) {
      this.world.root.remove(it.obj);
      disposeObject(it.obj);
    }
    this.list = [];
  }
}
