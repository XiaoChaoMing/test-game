import { describe, expect, it } from 'vitest';
import { canUseSkill, computeDamage, Cooldowns, FuryPool } from '../../src/logic/combat';
import { SKILLS } from '../../src/data/skills';

const fixed = (...vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe('computeDamage', () => {
  it('is deterministic for a fixed rng and applies variance then armor', () => {
    // variance roll 0.5 -> x1.0, crit roll 0.9 -> no crit
    expect(computeDamage(20, 1, 2, fixed(0.5, 0.9))).toEqual({ amount: 18, crit: false });
  });
  it('crits when the crit roll is below 0.08 (x1.6)', () => {
    expect(computeDamage(20, 1, 0, fixed(0.5, 0.05))).toEqual({ amount: 32, crit: true });
  });
  it('never deals less than 1', () => {
    expect(computeDamage(1, 1, 50, fixed(0, 0.9)).amount).toBe(1);
  });
});

describe('FuryPool', () => {
  it('refuses to spend more than it has and leaves the value unchanged', () => {
    const f = new FuryPool(100);
    f.gain(10);
    expect(f.trySpend(20)).toBe(false);
    expect(f.value).toBe(10);
    expect(f.trySpend(10)).toBe(true);
    expect(f.value).toBe(0);
  });
  it('caps at max and decays only after 3s out of combat', () => {
    const f = new FuryPool(100);
    f.gain(150);
    expect(f.value).toBe(100);
    f.tick(2, false);
    expect(f.value).toBe(100);
    f.tick(2, false);
    expect(f.value).toBeLessThan(100);
    const before = f.value;
    f.tick(1, true);
    expect(f.value).toBe(before);
  });
});

describe('Cooldowns', () => {
  it('tracks remaining time and readiness', () => {
    const c = new Cooldowns();
    expect(c.ready('charge')).toBe(true);
    c.start('charge', 6);
    expect(c.ready('charge')).toBe(false);
    c.tick(5);
    expect(c.remaining('charge')).toBeCloseTo(1);
    c.tick(1.01);
    expect(c.ready('charge')).toBe(true);
  });
});

describe('canUseSkill', () => {
  it('reports fury, cooldown and locked reasons', () => {
    const c = new Cooldowns();
    expect(canUseSkill(SKILLS.cleave, 10, c, 1)).toBe('fury');
    expect(canUseSkill(SKILLS.cleave, 20, c, 1)).toBe('ok');
    c.start('charge', 6);
    expect(canUseSkill(SKILLS.charge, 100, c, 1)).toBe('cooldown');
    expect(canUseSkill(SKILLS.nova, 100, c, 1)).toBe('locked');
    expect(canUseSkill(SKILLS.nova, 100, c, 2)).toBe('ok');
  });
  it('uses the spec costs', () => {
    expect(SKILLS.cleave.fury).toBe(20);
    expect(SKILLS.charge.fury).toBe(15);
    expect(SKILLS.charge.cooldown).toBe(6);
    expect(SKILLS.nova.fury).toBe(40);
    expect(SKILLS.nova.cooldown).toBe(12);
  });
});
