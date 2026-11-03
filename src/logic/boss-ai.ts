import type { EnemyDef } from '../data/enemies';
import type { AiCommand, AiInput } from './ai';
import { angleOf, dist, norm, sub, type Vec2 } from './vec';

export type BossAttack = 'slam' | 'sweep' | 'summon';

export type Telegraph = { kind: BossAttack; at: Vec2; radius: number; duration: number; arcDeg?: number; facing?: number };

export type WardenInput = AiInput & { hpRatio: number; addsAlive: number };

export type WardenCommand = AiCommand & { attack?: BossAttack; telegraph?: Telegraph; strikeAt?: Telegraph };

export const WARDEN_ATTACKS = {
  slam: { windup: 1.1, radius: 3.5, reach: 2.6 },
  sweep: { windup: 0.7, radius: 3.2, arcDeg: 180 },
  summon: { windup: 1.0, interval: 18, count: 2, maxAdds: 4 },
} as const;

const ENRAGE_RATIO = 0.5;
const ENRAGE_MULT = 0.7;
const EPS = 1e-6;

export class WardenBrain {
  state: 'idle' | 'chase' | 'windup' | 'recover' | 'dead' = 'idle';
  enraged = false;
  private timer = 0;
  private summonTimer: number = WARDEN_ATTACKS.summon.interval;
  private pending: Telegraph | null = null;
  private cycle = 0;

  constructor(readonly def: EnemyDef) {}

  windupFor(kind: BossAttack): number {
    return WARDEN_ATTACKS[kind].windup * (this.enraged ? ENRAGE_MULT : 1);
  }

  private recoverTime(): number {
    return this.def.recover * (this.enraged ? ENRAGE_MULT : 1);
  }

  reset(): void {
    this.state = 'idle';
    this.enraged = false;
    this.timer = 0;
    this.summonTimer = WARDEN_ATTACKS.summon.interval;
    this.pending = null;
    this.cycle = 0;
  }

  kill(): void {
    this.state = 'dead';
  }

  update(i: WardenInput): WardenCommand {
    if (this.state === 'dead') return {};
    if (i.hpRatio < ENRAGE_RATIO) this.enraged = true;
    if (!i.targetAlive) return {};
    const d = dist(i.self, i.target);
    if (this.state !== 'idle') this.summonTimer -= i.dt;

    switch (this.state) {
      case 'idle':
        if (d > this.def.aggroRange) return {};
        this.state = 'chase';
        return this.chase(i, d);
      case 'chase':
        return this.chase(i, d);
      case 'windup':
        this.timer += i.dt;
        if (this.timer >= (this.pending?.duration ?? 0) - EPS) {
          const t = this.pending!;
          this.pending = null;
          this.state = 'recover';
          this.timer = 0;
          return { strike: true, attack: t.kind, strikeAt: t };
        }
        return {};
      case 'recover':
        this.timer += i.dt;
        if (this.timer >= this.recoverTime() - EPS) {
          this.state = 'chase';
          this.timer = 0;
        }
        return {};
      default:
        return {};
    }
  }

  private chase(i: WardenInput, d: number): WardenCommand {
    if (this.summonTimer <= 0 && i.addsAlive < WARDEN_ATTACKS.summon.maxAdds) {
      this.summonTimer = WARDEN_ATTACKS.summon.interval;
      return this.begin({ kind: 'summon', at: i.self, radius: 2.5, duration: this.windupFor('summon') }, i);
    }
    if (d <= WARDEN_ATTACKS.sweep.radius) {
      this.cycle++;
      if (this.cycle % 3 === 0) return this.slam(i);
      return this.begin(
        { kind: 'sweep', at: i.self, radius: WARDEN_ATTACKS.sweep.radius, duration: this.windupFor('sweep'), arcDeg: WARDEN_ATTACKS.sweep.arcDeg, facing: angleOf(sub(i.target, i.self)) },
        i,
      );
    }
    if (d <= WARDEN_ATTACKS.slam.reach + WARDEN_ATTACKS.slam.radius * 0.6) return this.slam(i);
    return { move: i.target };
  }

  private slam(i: WardenInput): WardenCommand {
    const dir = norm(sub(i.target, i.self));
    const reach = Math.min(dist(i.self, i.target), WARDEN_ATTACKS.slam.reach);
    const at = { x: i.self.x + dir.x * reach, z: i.self.z + dir.z * reach };
    return this.begin({ kind: 'slam', at, radius: WARDEN_ATTACKS.slam.radius, duration: this.windupFor('slam') }, i);
  }

  private begin(t: Telegraph, i: WardenInput): WardenCommand {
    this.state = 'windup';
    this.timer = 0;
    this.pending = t;
    return { startWindup: true, telegraph: t, face: i.target };
  }
}
