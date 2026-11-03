import { PLAYER_BASE } from '../data/player';

export const MAX_LEVEL = 5;

export const xpToNext = (level: number): number => (level >= MAX_LEVEL ? Infinity : 40 * level * level);

export function addXp(state: { level: number; xp: number }, gained: number): { level: number; xp: number; levelsGained: number } {
  let { level, xp } = state;
  if (level >= MAX_LEVEL) return { level, xp: 0, levelsGained: 0 };
  xp += gained;
  let levelsGained = 0;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    levelsGained++;
  }
  if (level >= MAX_LEVEL) xp = 0;
  return { level, xp, levelsGained };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function statsForLevel(level: number): { maxHp: number; damage: number } {
  const l = Math.min(Math.max(level, 1), MAX_LEVEL) - 1;
  return { maxHp: round2(PLAYER_BASE.maxHp * (1 + 0.15 * l)), damage: round2(PLAYER_BASE.damage * (1 + 0.1 * l)) };
}
