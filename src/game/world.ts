import * as THREE from 'three';
import { EventBus } from '../core/events';
import { mulberry32 } from '../core/rng';
import type { NavGrid } from '../logic/grid';
import { dist, type Vec2 } from '../logic/vec';
import type { IsoCamera } from '../render/camera';
import type { LightPool } from '../render/lighting';
import type { Particles } from '../render/vfx/particles';
import type { Actor } from './actor';
import type { GameEvents } from './events';

export type PickResult = { actor?: Actor; ground?: Vec2 };

/** Runtime state of one level: actors, nav grid, shared services. */
export class World {
  readonly actors: Actor[] = [];
  readonly bus = new EventBus<GameEvents>();
  readonly rng = mulberry32(1337);
  player!: Actor;
  time = 0;
  /** remaining real seconds of hit-stop */
  private hitStopLeft = 0;
  paused = false;

  constructor(
    readonly root: THREE.Group,
    public grid: NavGrid,
    readonly camera: IsoCamera,
    readonly particles: Particles,
    readonly lights: LightPool,
  ) {}

  add(a: Actor): Actor {
    this.actors.push(a);
    this.root.add(a.view.root);
    a.syncView();
    return a;
  }

  remove(a: Actor): void {
    const i = this.actors.indexOf(a);
    if (i >= 0) this.actors.splice(i, 1);
    a.removed = true;
    this.root.remove(a.view.root);
    a.view.rig.dispose();
  }

  enemies(): Actor[] {
    return this.actors.filter((a) => a.kind === 'enemy');
  }

  enemiesNear(p: Vec2, r: number): Actor[] {
    return this.actors.filter((a) => a.kind === 'enemy' && a.alive && dist(a.pos, p) <= r + a.radius);
  }

  hitStop(seconds: number): void {
    this.hitStopLeft = Math.max(this.hitStopLeft, seconds);
  }

  /** scale applied to gameplay dt (hit-stop slows the world briefly) */
  timeScale(realDt: number): number {
    if (this.hitStopLeft > 0) {
      this.hitStopLeft -= realDt;
      return 0.05;
    }
    return 1;
  }

  /** Pick an actor under the cursor (vertical-cylinder test), else the ground point. */
  pick(ndc: { x: number; y: number }, filter: (a: Actor) => boolean = () => true): PickResult {
    const ray = this.camera.rayFromNdc(ndc.x, ndc.y).ray;
    let best: Actor | undefined;
    let bestScore = Infinity;
    for (const a of this.actors) {
      if (!a.alive || !filter(a)) continue;
      // intersect the ray with a few horizontal planes along the actor's height
      for (const f of [0.25, 0.55, 0.85]) {
        const y = a.height * f;
        const t = (y - ray.origin.y) / ray.direction.y;
        const x = ray.origin.x + ray.direction.x * t;
        const z = ray.origin.z + ray.direction.z * t;
        const d = Math.hypot(x - a.pos.x, z - a.pos.z);
        const reach = Math.max(a.radius * 1.15, 0.45);
        if (d < reach) {
          const score = d / reach - f * 0.01;
          if (score < bestScore) {
            bestScore = score;
            best = a;
          }
        }
      }
    }
    const ground = this.camera.screenToGround(ndc.x, ndc.y) ?? undefined;
    return { actor: best, ground };
  }

  headPosition(a: Actor, extra = 0.3): THREE.Vector3 {
    return new THREE.Vector3(a.pos.x, a.height + extra, a.pos.z);
  }
}
