import { EnemyBrain } from '../logic/ai';
import { WardenBrain } from '../logic/boss-ai';
import { findPath, hasLineOfSight } from '../logic/pathfinding';
import { moveWithCollision, separate } from '../logic/collision';
import { angleOf, dist, norm, sub, type Vec2 } from '../logic/vec';
import { ENEMIES, type EnemyId } from '../data/enemies';
import { t } from '../data/strings';
import { buildCharacter } from '../render/characters/builders';
import { Actor } from './actor';
import type { World } from './world';
import type { CombatSystem } from './combat-system';
import type { Projectiles } from './projectiles';
import type { Fx } from '../render/vfx/fx';

const REPATH = 0.45;

export function spawnEnemy(world: World, id: EnemyId, pos: Vec2, opts: { group?: string; aggro?: number; facing?: number; summoned?: boolean } = {}): Actor {
  const base = ENEMIES[id];
  const def = opts.aggro ? { ...base, aggroRange: opts.aggro } : base;
  const view = buildCharacter(id);
  const a = new Actor('enemy', id, view, pos, { radius: def.radius, maxHp: def.maxHp, name: t(def.nameKey) });
  a.enemyDef = def;
  a.group = opts.group;
  a.moveSpeed = def.moveSpeed * (0.92 + Math.random() * 0.16);
  a.armor = def.armor;
  a.damage = def.damage;
  a.summoned = !!opts.summoned;
  a.brain = id === 'warden' ? new WardenBrain(def) : new EnemyBrain(def);
  view.setFacing(opts.facing ?? Math.random() * Math.PI * 2, true);
  view.play('idle');
  // desync idle cycles
  view.update(Math.random() * 2);
  world.add(a);
  return a;
}

export class EnemyController {
  constructor(
    private readonly world: World,
    private readonly combat: CombatSystem,
    private readonly projectiles: Projectiles,
    private readonly fx: Fx,
  ) {}

  update(dt: number): void {
    const w = this.world;
    const player = w.player;
    for (const e of w.actors) {
      if (e.kind !== 'enemy' || !e.alive || !(e.brain instanceof EnemyBrain)) continue;
      const def = e.enemyDef!;
      if (e.stun > 0 || (e.view.anim.current === 'hit' && e.view.anim.busy)) continue;
      const los = dist(e.pos, player.pos) < 14 && hasLineOfSight(w.grid, e.pos, player.pos);
      const cmd = e.brain.update({ dt, self: e.pos, target: player.pos, targetAlive: player.alive, hasLos: los, home: e.spawn });

      if (cmd.face) e.view.setFacing(angleOf(sub(cmd.face, e.pos)));
      if (cmd.startWindup) {
        if (def.ranged) {
          e.view.play('shoot', e.view.anim.strikeTime('shoot') / def.windup, true);
          this.fx.aimLine(e.pos.x, e.pos.z, player.pos.x, player.pos.z, def.windup);
        } else {
          e.view.play('attack', e.view.anim.strikeTime('attack') / def.windup, true);
        }
        e.path = [];
      }
      if (cmd.strike) this.strike(e);
      if (cmd.move) this.moveToward(e, cmd.move, dt, los);
      else if (!e.view.anim.busy && e.view.anim.current !== 'idle') e.view.play('idle');
    }
    this.separateEnemies();
  }

  private strike(e: Actor): void {
    const def = e.enemyDef!;
    const p = this.world.player;
    if (!p.alive) return;
    if (def.ranged) {
      this.projectiles.fireArrow(e, p.pos.x, p.pos.z, def.ranged.projectileSpeed);
      return;
    }
    const hits = this.combat.meleeHits(e, def.attackRange + 0.25, def.attackArcDeg * 2, e.view.facing);
    if (hits.includes(p)) this.combat.dealDamage(e, p, 1, { knockback: 2 });
  }

  private moveToward(e: Actor, to: Vec2, dt: number, los: boolean): void {
    const w = this.world;
    let waypoint = to;
    const direct = los && dist(e.pos, to) < 12 && hasLineOfSight(w.grid, e.pos, to, e.radius * 0.8);
    if (!direct) {
      e.repathTimer -= dt;
      if (e.repathTimer <= 0 || e.path.length === 0) {
        e.repathTimer = REPATH + Math.random() * 0.2;
        e.path = findPath(w.grid, e.pos, to);
      }
      if (e.path.length === 0) return;
      waypoint = e.path[0];
      if (dist(e.pos, waypoint) < 0.2) {
        e.path.shift();
        if (e.path.length === 0) return;
        waypoint = e.path[0];
      }
    } else {
      e.path = [];
    }
    const n = norm(sub(waypoint, e.pos));
    const step = Math.min(dist(e.pos, waypoint), e.moveSpeed * dt);
    e.pos = moveWithCollision(w.grid, e.pos, { x: n.x * step, z: n.z * step }, e.radius);
    e.view.setFacing(angleOf(n));
    if (!e.view.anim.busy && e.view.anim.current !== 'walk') e.view.play('walk', e.moveSpeed / 2.6);
  }

  private separateEnemies(): void {
    const w = this.world;
    const list = w.actors.filter((a) => a.alive && a.kind !== 'npc');
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.kind === 'player' || b.kind === 'player') {
          // enemies yield to the player
          const [en, pl] = a.kind === 'player' ? [b, a] : [a, b];
          const push = separate(en.pos, en.radius, pl.pos, pl.radius);
          if (push.x || push.z) en.pos = moveWithCollision(w.grid, en.pos, { x: push.x * 2, z: push.z * 2 }, en.radius);
          continue;
        }
        const push = separate(a.pos, a.radius, b.pos, b.radius);
        if (!push.x && !push.z) continue;
        const heavyA = a.def === 'warden';
        const heavyB = b.def === 'warden';
        if (!heavyA) a.pos = moveWithCollision(w.grid, a.pos, heavyB ? { x: push.x * 2, z: push.z * 2 } : push, a.radius);
        if (!heavyB) b.pos = moveWithCollision(w.grid, b.pos, heavyA ? { x: -push.x * 2, z: -push.z * 2 } : { x: -push.x, z: -push.z }, b.radius);
      }
  }
}
