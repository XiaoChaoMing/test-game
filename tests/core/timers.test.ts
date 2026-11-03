import { describe, expect, it } from 'vitest';
import { GameTimers } from '../../src/core/timers';

describe('GameTimers', () => {
  it('fires only through update (so pausing = not updating delays it)', () => {
    const t = new GameTimers();
    let fired = 0;
    t.after(1, () => fired++);
    t.update(0.6);
    expect(fired).toBe(0);
    t.update(0.5);
    expect(fired).toBe(1);
    t.update(5);
    expect(fired).toBe(1);
  });
  it('clear() cancels pending callbacks (scene exit)', () => {
    const t = new GameTimers();
    let fired = 0;
    t.after(0.1, () => fired++);
    t.clear();
    t.update(1);
    expect(fired).toBe(0);
  });
});
