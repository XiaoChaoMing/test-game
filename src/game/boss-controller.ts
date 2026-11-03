import { WardenBrain, WARDEN_ATTACKS, type WardenCommand } from '../logic/boss-ai';
import { findPath, hasLineOfSight } from '../logic/pathfinding';
import { moveWithCollision } from '../logic/collision';
import { angleDiff, angleOf, dist, norm, sub, type Vec2 } from '../logic/vec';
import type { Actor } from './actor';
import type { World } from './world';
import type { CombatSystem } from './combat-system';
import type { Fx } from '../render/vfx/fx';
import { spawnEnemy } from './enemy-controller';

export class BossController {
  active = false;
  defeated = false;
  private addsAlive: Actor[] = [];
  private repath = 0;
  private enrageAnnounced = false;
  private introTimer = 0;

  constructor(
    private readonly world: World,
    private readonly combat: CombatSystem,
    private readonly fx: Fx,
    readonly boss: Actor,
  ) {}

  private get brain(): WardenBrain {
    return this.boss.brain as WardenBrain;
  }

  start(): void {
    if (this.active || this.defeated) return;
    this.active = true;
    this.introTimer = 1.6;
    const b = this.boss;
    b.view.setFacing(angleOf(sub(this.world.player.pos, b.pos)));
    b.view.play('roar', 1, true);
    this.world.camera.shake(0.5, 1.2);
    this.world.particles.emit('dust', { x: b.pos.x, y: 0.3, z: b.pos.z }, 30);
    this.world.particles.emit('soul', { x: b.pos.x, y: 2.5, z: b.pos.z }, 30);
    this.world.bus.emit('bossStarted', {});
  }

  /** player died: boss returns to full strength, adds vanish */
  reset(): void {
    const b = this.boss;
    if (!b.alive) return;
    this.active = false;
    this.enrageAnnounced = false;
    b.hp = b.maxHp;
    b.pos = { ...b.spawn };
    b.path = [];
    b.burn = null;
    this.brain.reset();
    b.view.rig.setTint(0, 0);
    b.view.play('idle');
    for (const a of this.addsAlive) if (!a.removed) this.world.remove(a);
    this.addsAlive = [];
  }

  update(dt: number): void {
    const b = this.boss;
    this.addsAlive = this.addsAlive.filter((a) => a.alive && !a.removed);
    if (!b.alive) {
      if (!this.defeated) this.onDefeated();
      return;
    }
    if (!this.active) return;
    if (this.introTimer > 0) {
      this.introTimer -= dt;
      return;
    }
    if (b.stun > 0) return;
    const w = this.world;
    const p = w.player;
    const cmd = this.brain.update({ dt, self: b.pos, target: p.pos, targetAlive: p.alive, hasLos: true, hpRatio: b.hpRatio, addsAlive: this.addsAlive.length });
    if (this.brain.enraged && !this.enrageAnnounced) {
      this.enrageAnnounced = true;
      b.view.rig.setTint(0xff2a10, 0.45);
      w.camera.shake(0.4, 0.6);
      w.particles.emit('ember', { x: b.pos.x, y: 2, z: b.pos.z }, 40);
    }
    if (this.brain.enraged && Math.random() < dt * 10) w.particles.emit('ember', { x: b.pos.x + (Math.random() - 0.5), y: 1 + Math.random() * 3, z: b.pos.z + (Math.random() - 0.5) }, 1);
    this.apply(cmd, dt);
  }

  private apply(cmd: WardenCommand, dt: number): void {
    const b = this.boss;
    const w = this.world;
    if (cmd.face) b.view.setFacing(angleOf(sub(cmd.face, b.pos)));
    if (cmd.telegraph) {
      const t = cmd.telegraph;
      const anim = t.kind === 'slam' ? 'slam' : t.kind === 'sweep' ? 'sweep' : 'roar';
      b.view.play(anim, b.view.anim.strikeTime(anim) / t.duration, true);
      if (t.kind === 'slam') this.fx.telegraph(t.at.x, t.at.z, t.radius, t.duration);
      if (t.kind === 'sweep') this.fx.telegraph(t.at.x, t.at.z, t.radius, t.duration, t.arcDeg, t.facing);
      if (t.kind === 'summon') this.fx.telegraph(t.at.x, t.at.z, 3.5, t.duration, 360, 0, 0x3fb4ff);
      b.path = [];
    }
    if (cmd.strike && cmd.strikeAt) this.resolve(cmd.strikeAt);
    if (cmd.move) {
      const to = cmd.move;
      let wp: Vec2 = to;
      if (!hasLineOfSight(w.grid, b.pos, to, b.radius * 0.7)) {
        this.repath -= dt;
        if (this.repath <= 0 || b.path.length === 0) {
          this.repath = 0.5;
          b.path = findPath(w.grid, b.pos, to);
        }
        if (!b.path.length) return;
        wp = b.path[0];
        if (dist(b.pos, wp) < 0.3) b.path.shift();
      }
      const n = norm(sub(wp, b.pos));
      const speed = b.moveSpeed * (this.brain.enraged ? 1.25 : 1);
      b.pos = moveWithCollision(w.grid, b.pos, { x: n.x * speed * dt, z: n.z * speed * dt }, b.radius * 0.8);
      b.view.setFacing(angleOf(n));
      if (!b.view.anim.busy && b.view.anim.current !== 'walk') b.view.play('walk', 0.7);
      if (Math.random() < dt * 3) w.camera.shake(0.06, 0.1);
    } else if (!b.view.anim.busy && b.view.anim.current !== 'idle') b.view.play('idle');
  }

  private resolve(t: NonNullable<WardenCommand['strikeAt']>): void {
    const w = this.world;
    const b = this.boss;
    const p = w.player;
    if (t.kind === 'slam') {
      this.fx.shockwave(t.at.x, t.at.z, t.radius + 0.8);
      w.particles.emit('dust', { x: t.at.x, y: 0.3, z: t.at.z }, 26);
      w.particles.ring('dust', { x: t.at.x, y: 0.2, z: t.at.z }, t.radius * 0.8, 20);
      w.camera.shake(0.7, 0.35);
      if (p.alive && dist(p.pos, t.at) <= t.radius + p.radius * 0.5) this.combat.dealDamage(b, p, 1.3, { knockback: 8, dir: norm(sub(p.pos, t.at)) });
    } else if (t.kind === 'sweep') {
      this.fx.slash(b.pos.x, b.pos.z, t.facing ?? b.view.facing, t.radius, t.arcDeg ?? 180, 0x9fd8ff, 1.2, 1.2);
      w.camera.shake(0.35, 0.2);
      const d = dist(p.pos, b.pos);
      const ang = Math.abs(angleDiff(t.facing ?? 0, angleOf(sub(p.pos, b.pos))));
      if (p.alive && d <= t.radius + p.radius && ang <= ((t.arcDeg ?? 180) * Math.PI) / 360) this.combat.dealDamage(b, p, 1.0, { knockback: 7 });
    } else {
      const n = WARDEN_ATTACKS.summon.count;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random();
        const pos = { x: b.pos.x + Math.sin(a) * 3, z: b.pos.z + Math.cos(a) * 3 };
        if (!w.grid.isWalkableWorld(pos)) continue;
        const add = spawnEnemy(w, 'husk', pos, { group: 'adds', aggro: 40, summoned: true });
        add.view.root.position.y = -1.6;
        add.stun = 0.8;
        this.addsAlive.push(add);
        w.particles.emit('soul', { x: pos.x, y: 0.3, z: pos.z }, 24);
        w.particles.emit('dust', { x: pos.x, y: 0.2, z: pos.z }, 10);
      }
    }
  }

  /** rising adds animation (called each frame by the level) */
  animateAdds(dt: number): void {
    for (const a of this.addsAlive) {
      const y = a.view.root.position.y;
      if (y < 0) a.view.root.position.y = Math.min(0, y + dt * 2.2);
    }
  }

  private onDefeated(): void {
    this.defeated = true;
    this.active = false;
    const w = this.world;
    const b = this.boss;
    for (const a of this.addsAlive) if (a.alive) this.combat.kill(a, null);
    w.hitStop(0.9);
    w.camera.shake(0.9, 1.0);
    this.fx.pillar(b.pos.x, b.pos.z, 0xffc070, 14, 3.5, 1.4);
    this.fx.shockwave(b.pos.x, b.pos.z, 9, 0xff8a3a);
    w.particles.emit('ember', { x: b.pos.x, y: 1.5, z: b.pos.z }, 120);
    w.particles.emit('soul', { x: b.pos.x, y: 2.5, z: b.pos.z }, 60);
    b.view.rig.setTint(0, 0);
    w.bus.emit('bossDefeated', {});
  }
}
