import type { SkillDef } from '../data/skills';

export const CRIT_CHANCE = 0.08;
export const CRIT_MULT = 1.6;
const FURY_DECAY_DELAY = 3;
const FURY_DECAY_RATE = 6;

export function computeDamage(base: number, mult: number, armor: number, rng: () => number): { amount: number; crit: boolean } {
  const variance = 0.9 + rng() * 0.2;
  const crit = rng() < CRIT_CHANCE;
  const raw = base * mult * variance * (crit ? CRIT_MULT : 1) - armor;
  return { amount: Math.max(1, Math.round(raw)), crit };
}

export class FuryPool {
  value = 0;
  private idle = 0;
  constructor(readonly max: number) {}

  gain(n: number): void {
    this.value = Math.min(this.max, this.value + n);
    this.idle = 0;
  }

  trySpend(n: number): boolean {
    if (this.value < n) return false;
    this.value -= n;
    this.idle = 0;
    return true;
  }

  tick(dt: number, inCombat: boolean): void {
    if (inCombat) {
      this.idle = 0;
      return;
    }
    const before = this.idle;
    this.idle += dt;
    const decayTime = this.idle - Math.max(before, FURY_DECAY_DELAY);
    if (decayTime > 0) this.value = Math.max(0, this.value - decayTime * FURY_DECAY_RATE);
  }

  get ratio(): number {
    return this.value / this.max;
  }
}

export class Cooldowns {
  private timers = new Map<string, { left: number; total: number }>();

  start(id: string, seconds: number): void {
    if (seconds > 0) this.timers.set(id, { left: seconds, total: seconds });
  }
  ready(id: string): boolean {
    return this.remaining(id) <= 0;
  }
  remaining(id: string): number {
    return this.timers.get(id)?.left ?? 0;
  }
  ratio(id: string): number {
    const t = this.timers.get(id);
    return t ? t.left / t.total : 0;
  }
  tick(dt: number): void {
    for (const [id, t] of this.timers) {
      t.left -= dt;
      if (t.left <= 0) this.timers.delete(id);
    }
  }
  reset(): void {
    this.timers.clear();
  }
}

export type SkillCheck = 'ok' | 'fury' | 'cooldown' | 'locked';

export function canUseSkill(def: SkillDef, fury: number, cds: Cooldowns, mapIndex: 1 | 2): SkillCheck {
  if (mapIndex < def.unlockMap) return 'locked';
  if (!cds.ready(def.id)) return 'cooldown';
  if (fury < def.fury) return 'fury';
  return 'ok';
}
