import { describe, expect, it } from 'vitest';
import { WardenBrain, type WardenInput } from '../../src/logic/boss-ai';
import { ENEMIES } from '../../src/data/enemies';

const input = (over: Partial<WardenInput> = {}): WardenInput => ({
  dt: 0.05,
  self: { x: 0, z: 0 },
  target: { x: 2, z: 0 },
  targetAlive: true,
  hasLos: true,
  hpRatio: 1,
  addsAlive: 0,
  ...over,
});

describe('WardenBrain', () => {
  it('enrages below 50% hp and shortens windups', () => {
    const b = new WardenBrain(ENEMIES.warden);
    const calm = b.windupFor('slam');
    b.update(input({ hpRatio: 0.4 }));
    expect(b.enraged).toBe(true);
    expect(b.windupFor('slam')).toBeCloseTo(calm * 0.7);
  });

  it('reset() clears enrage and timers', () => {
    const b = new WardenBrain(ENEMIES.warden);
    b.update(input({ hpRatio: 0.3 }));
    b.reset();
    expect(b.enraged).toBe(false);
    expect(b.state).toBe('idle');
  });

  it('telegraphs an attack before striking, and strikes once', () => {
    const b = new WardenBrain(ENEMIES.warden);
    const cmds = [];
    for (let i = 0; i < 80; i++) cmds.push(b.update(input()));
    const tele = cmds.findIndex((c) => c.telegraph);
    const strike = cmds.findIndex((c) => c.strike);
    expect(tele).toBeGreaterThanOrEqual(0);
    expect(strike).toBeGreaterThan(tele);
    expect(cmds[strike].attack).toBe(cmds[tele].telegraph!.kind);
  });

  it('never summons when 4 adds are alive', () => {
    const b = new WardenBrain(ENEMIES.warden);
    const kinds = [];
    for (let i = 0; i < 2000; i++) {
      const c = b.update(input({ addsAlive: 4 }));
      if (c.telegraph) kinds.push(c.telegraph.kind);
    }
    expect(kinds).not.toContain('summon');
    expect(kinds.length).toBeGreaterThan(0);
  });

  it('summons once the summon timer is up and adds are below 4', () => {
    const b = new WardenBrain(ENEMIES.warden);
    const kinds = [];
    for (let i = 0; i < 1000; i++) {
      const c = b.update(input({ addsAlive: 0 }));
      if (c.telegraph) kinds.push(c.telegraph.kind);
    }
    expect(kinds).toContain('summon');
  });
});
