import { describe, expect, it } from 'vitest';
import { addXp, MAX_LEVEL, statsForLevel, xpToNext } from '../../src/logic/progression';

describe('progression', () => {
  it('uses 40*level^2 per level and Infinity at max', () => {
    expect(xpToNext(1)).toBe(40);
    expect(xpToNext(2)).toBe(160);
    expect(xpToNext(MAX_LEVEL)).toBe(Infinity);
  });
  it('can gain multiple levels at once', () => {
    expect(addXp({ level: 1, xp: 0 }, 210)).toEqual({ level: 3, xp: 10, levelsGained: 2 });
  });
  it('stops at max level and stops accumulating xp', () => {
    expect(addXp({ level: 4, xp: 0 }, 99999)).toEqual({ level: 5, xp: 0, levelsGained: 1 });
    expect(addXp({ level: 5, xp: 0 }, 500)).toEqual({ level: 5, xp: 0, levelsGained: 0 });
  });
  it('scales +15% hp and +10% damage per level', () => {
    expect(statsForLevel(1)).toEqual({ maxHp: 120, damage: 14 });
    expect(statsForLevel(3)).toEqual({ maxHp: 156, damage: 16.8 });
  });
});
