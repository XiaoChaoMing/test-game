import { describe, expect, it } from 'vitest';
import { EnemyBrain, type AiInput } from '../../src/logic/ai';
import { ENEMIES } from '../../src/data/enemies';

const input = (over: Partial<AiInput> = {}): AiInput => ({
  dt: 0.05,
  self: { x: 0, z: 0 },
  target: { x: 100, z: 0 },
  targetAlive: true,
  hasLos: true,
  ...over,
});

const run = (b: EnemyBrain, i: AiInput, seconds: number) => {
  const cmds = [];
  for (let t = 0; t < seconds - 1e-9; t += i.dt) cmds.push(b.update(i));
  return cmds;
};

describe('EnemyBrain (husk)', () => {
  it('stays idle when the target is beyond aggro range', () => {
    const b = new EnemyBrain(ENEMIES.husk);
    b.update(input({ target: { x: ENEMIES.husk.aggroRange + 1, z: 0 } }));
    expect(b.state).toBe('idle');
  });

  it('chases inside aggro range', () => {
    const b = new EnemyBrain(ENEMIES.husk);
    const cmd = b.update(input({ target: { x: 5, z: 0 } }));
    expect(b.state).toBe('chase');
    expect(cmd.move).toEqual({ x: 5, z: 0 });
  });

  it('winds up in attack range, strikes exactly once after windup, then recovers', () => {
    const b = new EnemyBrain(ENEMIES.husk);
    const i = input({ target: { x: 1, z: 0 } });
    const first = b.update(i);
    expect(b.state).toBe('windup');
    expect(first.startWindup).toBe(true);
    const cmds = run(b, i, ENEMIES.husk.windup + 0.05);
    expect(cmds.filter((c) => c.strike).length).toBe(1);
    expect(b.state).toBe('recover');
  });

  it('goes idle when the target is dead', () => {
    const b = new EnemyBrain(ENEMIES.husk);
    b.update(input({ target: { x: 5, z: 0 } }));
    b.update(input({ target: { x: 5, z: 0 }, targetAlive: false }));
    expect(b.state).toBe('idle');
  });

  it('wakes up from idle when hit even outside aggro range', () => {
    const b = new EnemyBrain(ENEMIES.husk);
    b.onHit();
    b.update(input({ target: { x: 30, z: 0 } }));
    expect(b.state).toBe('chase');
  });
});

describe('EnemyBrain (hound)', () => {
  it('retreats after a bite', () => {
    const b = new EnemyBrain(ENEMIES.hound);
    const i = input({ target: { x: 1, z: 0 } });
    run(b, i, ENEMIES.hound.windup + ENEMIES.hound.recover + 0.15);
    expect(b.state).toBe('retreat');
  });
});

describe('EnemyBrain (archer)', () => {
  it('backs away when the target is too close', () => {
    const b = new EnemyBrain(ENEMIES.archer);
    b.onHit();
    const cmd = b.update(input({ target: { x: 2, z: 0 } }));
    expect(cmd.move).toBeDefined();
    expect(cmd.move!.x).toBeLessThan(0);
  });
  it('does not attack without line of sight', () => {
    const b = new EnemyBrain(ENEMIES.archer);
    const cmd = b.update(input({ target: { x: 7, z: 0 }, hasLos: false }));
    expect(b.state).toBe('chase');
    expect(cmd.startWindup).toBeFalsy();
  });
  it('shoots from preferred range with line of sight', () => {
    const b = new EnemyBrain(ENEMIES.archer);
    const cmd = b.update(input({ target: { x: 7, z: 0 } }));
    expect(cmd.startWindup).toBe(true);
  });
});

describe('EnemyBrain leash', () => {
  it('returns home when the target runs past the leash, then idles there', () => {
    const b = new EnemyBrain(ENEMIES.husk);
    const home = { x: 0, z: 0 };
    b.update(input({ target: { x: 5, z: 0 }, home }));
    expect(b.state).toBe('chase');
    const cmd = b.update(input({ self: { x: 10, z: 0 }, target: { x: 40, z: 0 }, home }));
    expect(b.state).toBe('return');
    expect(cmd.move).toEqual(home);
    b.update(input({ self: { x: 0.3, z: 0 }, target: { x: 40, z: 0 }, home }));
    expect(b.state).toBe('idle');
  });
});
