import * as THREE from 'three';
import { computeDamage } from '../logic/combat';
import { addXp } from '../logic/progression';
import { norm, sub, type Vec2 } from '../logic/vec';
import { moveWithCollision } from '../logic/collision';
import { BASIC_FURY_GAIN } from '../data/skills';
import type { Actor } from './actor';
import type { World } from './world';
import type { PlayerState } from './player-state';
import { EnemyBrain } from '../logic/ai';

export type DamageOpts = { knockback?: number; dir?: Vec2; fury?: number; silent?: boolean; noHitStop?: boolean; preset?: 'blood' | 'bone' | 'fire' };

const BODY_SINK_AFTER = 2.2;
const BODY_REMOVE_AFTER = 4;

export class CombatSystem {
  invulnerable = false;

  constructor(private readonly world: World, private readonly ps: PlayerState) {}

  /** Returns the damage dealt. Handles feedback, death, xp, fury. */
  dealDamage(src: Actor | null, dst: Actor, mult: number, opts: DamageOpts = {}): number {
    if (!dst.alive) return 0;
    if (dst.kind === 'player' && this.invulnerable) return 0;
    const w = this.world;
    const base = src ? src.damage : 10;
    const { amount, crit } = computeDamage(base, mult, dst.armor, w.rng);
    dst.hp = Math.max(0, dst.hp - amount);
    w.bus.emit('damaged', { actor: dst, amount, crit, source: src });

    // feedback
    dst.view.flash(dst.kind === 'player' ? 0xff3020 : 0xffffff);
    const hitPos = { x: dst.pos.x, y: dst.height * 0.6, z: dst.pos.z };
    const dir = opts.dir ?? (src ? norm(sub(dst.pos, src.pos)) : { x: 0, z: 0 });
    const preset = opts.preset ?? (dst.def === 'archer' || dst.def === 'warden' ? 'bone' : 'blood');
    w.particles.emit(preset, hitPos, crit ? 14 : 8, { x: dir.x, y: 0.5, z: dir.z });
    w.particles.emit('hitspark', hitPos, crit ? 8 : 4, { x: dir.x, y: 0.3, z: dir.z });
    if (dst.kind === 'player') {
      w.camera.shake(0.25, 0.18);
      this.ps.inCombatTimer = 4;
      w.bus.emit('hpChanged', { ratio: dst.hpRatio });
    } else {
      if (src?.kind === 'player') {
        if (!opts.noHitStop) w.hitStop(crit ? 0.11 : 0.055);
        w.camera.shake(crit ? 0.35 : 0.15, crit ? 0.2 : 0.12);
        if (opts.fury) this.ps.fury.gain(opts.fury);
        this.ps.inCombatTimer = 4;
      }
      if (dst.brain instanceof EnemyBrain) dst.brain.onHit();
      if (opts.knockback && dst.def !== 'warden') {
        dst.knock = { x: dir.x * opts.knockback, z: dir.z * opts.knockback };
      }
      if (dst.alive && dst.hp > 0 && dst.def !== 'warden' && dst.stun <= 0 && !dst.view.anim.busy) dst.view.play('hit', 1, true);
    }

    if (dst.hp <= 0) this.kill(dst, src);
    return amount;
  }

  basicFury(): number {
    return BASIC_FURY_GAIN;
  }

  kill(a: Actor, by: Actor | null): void {
    if (!a.alive) return;
    a.alive = false;
    a.deadTime = 0;
    a.path = [];
    a.brain?.kill();
    a.view.play('die', 1, true);
    const w = this.world;
    if (a.kind === 'enemy') {
      this.ps.kills++;
      const def = a.enemyDef!;
      if (!a.summoned) {
        const r = addXp({ level: this.ps.level, xp: this.ps.xp }, def.xp);
        const oldMax = w.player.maxHp;
        this.ps.level = r.level;
        this.ps.xp = r.xp;
        w.bus.emit('xp', { amount: def.xp });
        if (r.levelsGained > 0) {
          const s = this.ps.stats;
          w.player.maxHp = s.maxHp;
          w.player.damage = s.damage;
          w.player.hp = Math.min(s.maxHp, w.player.hp + (s.maxHp - oldMax) + s.maxHp * 0.3);
          w.particles.emit('levelup', { x: w.player.pos.x, y: 0.3, z: w.player.pos.z }, 50);
          w.bus.emit('levelUp', { level: r.level });
          w.bus.emit('hpChanged', { ratio: w.player.hpRatio });
        }
      }
      w.particles.emit(def.id === 'archer' || def.id === 'warden' ? 'bone' : 'blood', { x: a.pos.x, y: 0.6, z: a.pos.z }, 16);
      w.particles.emit('dust', { x: a.pos.x, y: 0.2, z: a.pos.z }, 6);
    }
    w.bus.emit('killed', { actor: a, by });
    if (a.kind === 'player') w.bus.emit('playerDied', {});
  }

  update(dt: number): void {
    const w = this.world;
    for (const a of [...w.actors]) {
      // knockback slide
      if (a.knock.x !== 0 || a.knock.z !== 0) {
        a.pos = moveWithCollision(w.grid, a.pos, { x: a.knock.x * dt, z: a.knock.z * dt }, a.radius);
        const decay = Math.exp(-10 * dt);
        a.knock.x *= decay;
        a.knock.z *= decay;
        if (Math.hypot(a.knock.x, a.knock.z) < 0.05) a.knock = { x: 0, z: 0 };
      }
      if (a.stun > 0) a.stun -= dt;
      // burn ticks
      if (a.burn && a.alive) {
        a.burn.left -= dt;
        a.burn.acc += dt;
        if (Math.random() < dt * 8) w.particles.emit('fire', { x: a.pos.x, y: a.height * 0.5, z: a.pos.z }, 1);
        if (a.burn.acc >= 0.5) {
          a.burn.acc -= 0.5;
          const amount = Math.max(1, Math.round(a.burn.dps * 0.5));
          a.hp = Math.max(0, a.hp - amount);
          w.bus.emit('damaged', { actor: a, amount, crit: false, source: a.burn.source });
          if (a.hp <= 0) this.kill(a, a.burn.source);
        }
        if (a.burn && a.burn.left <= 0) a.burn = null;
      }
      // corpses
      if (!a.alive && a.kind === 'enemy') {
        a.deadTime += dt;
        if (a.deadTime > BODY_SINK_AFTER) a.view.root.position.y = -(a.deadTime - BODY_SINK_AFTER) * 0.6;
        if (a.deadTime > BODY_REMOVE_AFTER) w.remove(a);
      }
    }
  }

  meleeHits(src: Actor, range: number, arcDeg: number, facing: number): Actor[] {
    const w = this.world;
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    const half = (arcDeg * Math.PI) / 360;
    return w.actors.filter((a) => {
      if (!a.alive || a === src) return false;
      if (src.kind === 'player' ? a.kind !== 'enemy' : a.kind !== 'player') return false;
      const dx = a.pos.x - src.pos.x;
      const dz = a.pos.z - src.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range + a.radius) return false;
      if (d < a.radius + src.radius * 0.5) return true;
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d)));
      return ang <= half;
    });
  }

  static tmp = new THREE.Vector3();
}
