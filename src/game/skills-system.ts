import { SKILLS, CHARGE_SPEED, NOVA_BURN, type SkillId } from '../data/skills';
import { PLAYER_BASE } from '../data/player';
import { canUseSkill, type SkillCheck } from '../logic/combat';
import { castToWalkable, moveWithCollision } from '../logic/collision';
import { angleOf, dist, norm, sub, type Vec2 } from '../logic/vec';
import type { World } from './world';
import type { CombatSystem } from './combat-system';
import type { PlayerState } from './player-state';
import type { Fx } from '../render/vfx/fx';
import type { Actor } from './actor';

type Dash = { from: Vec2; to: Vec2; hit: Set<Actor>; t: number; total: number; last: Vec2 };

export class SkillsSystem {
  dash: Dash | null = null;
  /** true while a skill animation/dash owns the player */
  get busy(): boolean {
    return !!this.dash || this.castLock > 0;
  }
  private castLock = 0;
  private potionCd = 0;

  constructor(
    private readonly world: World,
    private readonly combat: CombatSystem,
    private readonly ps: PlayerState,
    private readonly fx: Fx,
  ) {}

  /** death/respawn: stop any dash or cast in progress */
  reset(): void {
    this.dash = null;
    this.castLock = 0;
  }

  tryUse(id: SkillId, aim: Vec2): SkillCheck {
    const p = this.world.player;
    if (!p.alive || this.dash) return 'cooldown';
    const def = SKILLS[id];
    const check = canUseSkill(def, this.ps.fury.value, this.ps.cooldowns, this.ps.mapIndex);
    if (check !== 'ok') {
      this.world.bus.emit('skillDenied', { id, reason: check });
      return check;
    }
    this.ps.fury.trySpend(def.fury);
    this.ps.cooldowns.start(id, def.cooldown);
    const facing = angleOf(sub(aim, p.pos));
    if (Number.isFinite(facing) && dist(aim, p.pos) > 0.05) p.view.setFacing(facing, true);
    p.path = [];
    switch (id) {
      case 'cleave':
        this.cleave(p, p.view.facing);
        break;
      case 'charge':
        this.startCharge(p, aim);
        break;
      case 'nova':
        this.nova(p);
        break;
    }
    this.ps.inCombatTimer = Math.max(this.ps.inCombatTimer, 2);
    this.world.bus.emit('skillUsed', { id });
    return 'ok';
  }

  private cleave(p: Actor, facing: number): void {
    const def = SKILLS.cleave;
    this.castLock = 0.38;
    p.view.anim.onStrike = () => {
      this.fx.slash(p.pos.x, p.pos.z, p.view.facing, def.range + 0.3, def.arcDeg!, 0xffb060, 0.8, 0.9);
      this.world.particles.emit('ember', { x: p.pos.x + Math.sin(facing) * 1.2, y: 0.9, z: p.pos.z + Math.cos(facing) * 1.2 }, 10);
      const hits = this.combat.meleeHits(p, def.range, def.arcDeg!, p.view.facing);
      for (const h of hits) this.combat.dealDamage(p, h, def.damageMult, { knockback: 4, noHitStop: hits.length > 1 });
      if (hits.length > 0) this.world.hitStop(0.08);
    };
    p.view.play('attack', 1.5, true);
  }

  private startCharge(p: Actor, aim: Vec2): void {
    const def = SKILLS.charge;
    let target = aim;
    const d = dist(aim, p.pos);
    if (d > def.range) {
      const n = norm(sub(aim, p.pos));
      target = { x: p.pos.x + n.x * def.range, z: p.pos.z + n.z * def.range };
    }
    const end = castToWalkable(this.world.grid, p.pos, target, p.radius);
    const total = dist(end, p.pos);
    this.dash = { from: { ...p.pos }, to: end, hit: new Set(), t: 0, total: Math.max(total, 0.01), last: { ...p.pos } };
    p.view.play('charge', 1, true);
    this.world.particles.emit('dust', { x: p.pos.x, y: 0.2, z: p.pos.z }, 8);
  }

  private nova(p: Actor): void {
    const def = SKILLS.nova;
    this.castLock = 0.55;
    p.view.anim.onStrike = () => {
      const w = this.world;
      this.fx.nova(p.pos.x, p.pos.z, def.radius!);
      this.fx.shockwave(p.pos.x, p.pos.z, def.radius! + 0.5, 0xff8a3a);
      w.particles.ring('fire', { x: p.pos.x, y: 0.4, z: p.pos.z }, 1.0, 36);
      w.particles.emit('ember', { x: p.pos.x, y: 0.6, z: p.pos.z }, 30);
      w.camera.shake(0.45, 0.3);
      w.hitStop(0.09);
      for (const e of w.enemiesNear(p.pos, def.radius!)) {
        this.combat.dealDamage(p, e, def.damageMult, { knockback: 6, noHitStop: true, preset: 'fire' });
        if (e.alive) e.burn = { dps: p.damage * NOVA_BURN.ratioPerSecond * 4, left: NOVA_BURN.duration, acc: 0, source: p };
      }
    };
    p.view.play('cast', 1, true);
  }

  usePotion(): boolean {
    const p = this.world.player;
    if (!p.alive || this.potionCd > 0) return false;
    if (this.ps.potions <= 0) {
      this.world.bus.emit('skillDenied', { id: 'potion', reason: 'empty' });
      return false;
    }
    if (p.hp >= p.maxHp) {
      this.world.bus.emit('skillDenied', { id: 'potion', reason: 'full' });
      return false;
    }
    this.ps.potions--;
    this.potionCd = PLAYER_BASE.potionCooldown;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * PLAYER_BASE.potionHealRatio);
    this.world.particles.emit('heal', { x: p.pos.x, y: 0.4, z: p.pos.z }, 30);
    this.world.bus.emit('potionUsed', {});
    this.world.bus.emit('hpChanged', { ratio: p.hpRatio });
    return true;
  }

  update(dt: number): void {
    this.castLock = Math.max(0, this.castLock - dt);
    this.potionCd = Math.max(0, this.potionCd - dt);
    const d = this.dash;
    if (!d) return;
    const p = this.world.player;
    const w = this.world;
    d.t += dt * CHARGE_SPEED;
    const u = Math.min(1, d.t / d.total);
    const target = { x: d.from.x + (d.to.x - d.from.x) * u, z: d.from.z + (d.to.z - d.from.z) * u };
    p.pos = moveWithCollision(w.grid, p.pos, sub(target, p.pos), p.radius);
    this.fx.streak(d.last.x, d.last.z, p.pos.x, p.pos.z);
    d.last = { ...p.pos };
    w.particles.emit('ember', { x: p.pos.x, y: 0.6, z: p.pos.z }, 2);
    const dir = norm(sub(d.to, d.from));
    for (const e of w.enemiesNear(p.pos, 1.0)) {
      if (d.hit.has(e)) continue;
      d.hit.add(e);
      const side = { x: -dir.z, z: dir.x };
      const sgn = (e.pos.x - p.pos.x) * side.x + (e.pos.z - p.pos.z) * side.z >= 0 ? 1 : -1;
      this.combat.dealDamage(p, e, SKILLS.charge.damageMult, { knockback: 7, dir: norm({ x: dir.x + side.x * sgn, z: dir.z + side.z * sgn }), noHitStop: true });
    }
    if (u >= 1) {
      this.dash = null;
      this.fx.shockwave(p.pos.x, p.pos.z, 2.2);
      w.particles.emit('dust', { x: p.pos.x, y: 0.2, z: p.pos.z }, 10);
      w.camera.shake(0.25, 0.15);
      if (d.hit.size > 0) w.hitStop(0.07);
      p.view.play('idle');
    }
  }
}
