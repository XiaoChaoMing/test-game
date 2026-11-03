import type { CharacterView } from '../render/characters/builders';
import type { EnemyBrain } from '../logic/ai';
import type { WardenBrain } from '../logic/boss-ai';
import type { EnemyDef } from '../data/enemies';
import type { Vec2 } from '../logic/vec';

export type ActorKind = 'player' | 'enemy' | 'npc';

let nextId = 1;

export class Actor {
  readonly id = nextId++;
  pos: Vec2;
  radius: number;
  hp: number;
  maxHp: number;
  alive = true;
  name: string;
  group?: string;
  enemyDef?: EnemyDef;
  brain?: EnemyBrain | WardenBrain;
  /** remaining path waypoints */
  path: Vec2[] = [];
  repathTimer = 0;
  knock: Vec2 = { x: 0, z: 0 };
  burn: { dps: number; left: number; acc: number; source: Actor | null } | null = null;
  deadTime = 0;
  /** seconds this actor is rooted (stagger, casting) */
  stun = 0;
  moveSpeed = 0;
  armor = 0;
  damage = 0;
  spawn: Vec2;
  /** set on adds summoned by the boss */
  summoned = false;
  removed = false;

  constructor(
    readonly kind: ActorKind,
    readonly def: string,
    readonly view: CharacterView,
    pos: Vec2,
    opts: { radius: number; maxHp: number; name: string },
  ) {
    this.pos = { ...pos };
    this.spawn = { ...pos };
    this.radius = opts.radius;
    this.maxHp = opts.maxHp;
    this.hp = opts.maxHp;
    this.name = opts.name;
  }

  get hpRatio(): number {
    return this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
  }

  get height(): number {
    return this.view.height;
  }

  syncView(): void {
    this.view.root.position.x = this.pos.x;
    this.view.root.position.z = this.pos.z;
  }
}
