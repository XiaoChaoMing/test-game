import { PLAYER_BASE } from '../data/player';
import { SKILLS, type SkillId } from '../data/skills';
import { findPath } from '../logic/pathfinding';
import { moveWithCollision, separate } from '../logic/collision';
import { angleOf, dist, norm, sub, type Vec2 } from '../logic/vec';
import type { Input } from '../core/input';
import type { Actor } from './actor';
import type { World } from './world';
import type { CombatSystem } from './combat-system';
import type { SkillsSystem } from './skills-system';
import type { Fx } from '../render/vfx/fx';

type Intent = { kind: 'none' } | { kind: 'move' } | { kind: 'attack'; target: Actor } | { kind: 'talk'; npc: Actor };

const HOLD_REPATH = 0.12;
const CHASE_REPATH = 0.25;
const TALK_RANGE = 2.4;

export class PlayerController {
  intent: Intent = { kind: 'none' };
  hovered: Actor | null = null;
  private repath = 0;
  private swingCd = 0;
  private swinging = false;
  /** blocks movement while an attack animation is committed */
  private commit = 0;
  enabled = true;

  constructor(
    private readonly world: World,
    private readonly input: Input,
    private readonly combat: CombatSystem,
    private readonly skills: SkillsSystem,
    private readonly fx: Fx,
  ) {}

  private get p(): Actor {
    return this.world.player;
  }

  cancel(): void {
    this.intent = { kind: 'none' };
    this.p.path = [];
  }

  /** death/respawn: drop any half-finished swing so attacking works again */
  reset(): void {
    this.cancel();
    this.swinging = false;
    this.commit = 0;
    this.swingCd = 0;
    this.p.view.anim.onStrike = null;
  }

  update(dt: number): void {
    const p = this.p;
    this.swingCd = Math.max(0, this.swingCd - dt);
    this.commit = Math.max(0, this.commit - dt);
    const pick = this.world.pick(this.input.mouseNdc, (a) => a.kind !== 'player');
    this.hovered = pick.actor ?? null;
    if (!p.alive) return;

    if (this.enabled) this.readInput(dt, pick.actor, pick.ground);

    if (this.skills.busy) return;
    switch (this.intent.kind) {
      case 'attack':
        this.updateAttack(dt, this.intent.target);
        break;
      case 'talk':
        this.updateTalk(dt, this.intent.npc);
        break;
      case 'move':
        this.followPath(dt);
        break;
      default:
        this.idle();
    }
  }

  private readInput(dt: number, hoverActor: Actor | undefined, ground: Vec2 | undefined): void {
    const inp = this.input;
    const aim = ground ?? this.p.pos;
    const keys: [string, SkillId][] = [['Digit1', 'cleave'], ['Digit2', 'charge'], ['Digit3', 'nova']];
    for (const [code, id] of keys) {
      if (inp.keyPressed(code) && !this.skills.busy) {
        const r = this.skills.tryUse(id, aim);
        if (r === 'ok') {
          this.commit = 0;
          this.swinging = false;
          if (this.intent.kind === 'move') this.intent = { kind: 'none' };
        }
      }
    }
    if (inp.keyPressed('KeyQ')) this.skills.usePotion();

    if (inp.leftPressed) {
      if (hoverActor && hoverActor.kind === 'enemy') {
        this.intent = { kind: 'attack', target: hoverActor };
        this.repath = 0;
      } else if (hoverActor && hoverActor.kind === 'npc') {
        this.intent = { kind: 'talk', npc: hoverActor };
        this.repath = 0;
      } else if (ground) {
        this.moveTo(ground);
        this.fx.shockwave(ground.x, ground.z, 0.6, 0x9a8a70);
      }
    } else if (inp.leftDown) {
      // holding: keep attacking the same target, or keep following the cursor
      if (this.intent.kind === 'attack' && !this.intent.target.alive) {
        this.intent = { kind: 'none' };
      }
      if (this.intent.kind === 'move' || this.intent.kind === 'none') {
        this.repath -= dt;
        if (this.repath <= 0 && ground) {
          this.repath = HOLD_REPATH;
          if (dist(ground, this.p.pos) > 0.6) this.moveTo(ground);
        }
      }
    }
  }

  moveTo(target: Vec2): void {
    const p = this.p;
    p.path = findPath(this.world.grid, p.pos, target, p.radius);
    this.intent = p.path.length ? { kind: 'move' } : { kind: 'none' };
  }

  private idle(): void {
    const v = this.p.view;
    if (!v.anim.busy && v.anim.current !== 'idle') v.play('idle');
  }

  private followPath(dt: number): void {
    const p = this.p;
    if (this.commit > 0) return;
    if (p.path.length === 0) {
      this.intent = { kind: 'none' };
      this.idle();
      return;
    }
    this.step(dt, p.path[0]);
    if (dist(p.pos, p.path[0]) < 0.12) p.path.shift();
  }

  /** move toward a point this frame; returns true when it moved */
  private step(dt: number, to: Vec2): boolean {
    const p = this.p;
    const d = dist(p.pos, to);
    if (d < 1e-3) return false;
    const speed = PLAYER_BASE.moveSpeed;
    const n = norm(sub(to, p.pos));
    const travel = Math.min(d, speed * dt);
    let next = moveWithCollision(this.world.grid, p.pos, { x: n.x * travel, z: n.z * travel }, p.radius);
    // don't walk through live enemies or npcs
    for (const a of this.world.actors) {
      if (a === p || !a.alive) continue;
      const push = separate(next, p.radius, a.pos, a.radius);
      if (push.x || push.z) next = moveWithCollision(this.world.grid, next, { x: push.x * 2, z: push.z * 2 }, p.radius);
    }
    p.pos = next;
    p.view.setFacing(angleOf(n));
    if (!p.view.anim.busy && p.view.anim.current !== 'walk') p.view.play('walk', 1.1);
    return true;
  }

  private updateAttack(dt: number, target: Actor): void {
    const p = this.p;
    if (!target.alive) {
      if (!this.swinging) this.intent = { kind: 'none' };
      return;
    }
    const reach = SKILLS.basic.range + target.radius;
    const d = dist(p.pos, target.pos);
    if (d > reach && !this.swinging) {
      this.repath -= dt;
      if (this.repath <= 0 || p.path.length === 0) {
        this.repath = CHASE_REPATH;
        p.path = findPath(this.world.grid, p.pos, target.pos);
      }
      if (p.path.length) {
        this.step(dt, p.path[0]);
        if (dist(p.pos, p.path[0]) < 0.15) p.path.shift();
      }
      return;
    }
    p.path = [];
    p.view.setFacing(angleOf(sub(target.pos, p.pos)));
    if (this.swingCd <= 0 && !this.swinging) {
      this.swinging = true;
      this.swingCd = PLAYER_BASE.attackInterval;
      this.commit = PLAYER_BASE.attackInterval * 0.6;
      const speed = 0.5 / PLAYER_BASE.attackInterval;
      p.view.anim.onStrike = () => {
        this.swinging = false;
        if (!p.alive) return;
        this.fx.slash(p.pos.x, p.pos.z, p.view.facing, SKILLS.basic.range + 0.2, 110, 0xffd0a0, 1.0, 0.35);
        if (target.alive && dist(p.pos, target.pos) <= reach + 0.4) {
          this.combat.dealDamage(p, target, SKILLS.basic.damageMult, { fury: this.combat.basicFury(), knockback: 2 });
        }
      };
      p.view.play('attack', speed, true);
    }
    if (!this.input.leftDown && !this.swinging && this.swingCd <= 0) {
      // released: finish this swing then stop
      this.intent = { kind: 'none' };
    }
  }

  private updateTalk(dt: number, npc: Actor): void {
    const p = this.p;
    if (dist(p.pos, npc.pos) <= TALK_RANGE) {
      p.path = [];
      p.view.setFacing(angleOf(sub(npc.pos, p.pos)));
      this.intent = { kind: 'none' };
      this.idle();
      this.world.bus.emit('talk', { npc });
      return;
    }
    this.repath -= dt;
    if (this.repath <= 0 || p.path.length === 0) {
      this.repath = CHASE_REPATH;
      p.path = findPath(this.world.grid, p.pos, npc.pos);
    }
    if (p.path.length) {
      this.step(dt, p.path[0]);
      if (dist(p.pos, p.path[0]) < 0.15) p.path.shift();
    }
  }
}
