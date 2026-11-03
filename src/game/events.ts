import type { Actor } from './actor';
import type { SkillId } from '../data/skills';
import type { SkillCheck } from '../logic/combat';

export type GameEvents = {
  damaged: { actor: Actor; amount: number; crit: boolean; source: Actor | null };
  killed: { actor: Actor; by: Actor | null };
  playerDied: Record<string, never>;
  skillUsed: { id: SkillId };
  skillDenied: { id: SkillId | 'potion'; reason: SkillCheck | 'empty' | 'full' };
  potionUsed: Record<string, never>;
  pickup: { kind: 'potion' };
  talk: { npc: Actor };
  trigger: { id: string };
  levelUp: { level: number };
  xp: { amount: number };
  hpChanged: { ratio: number };
  bossStarted: Record<string, never>;
  bossDefeated: Record<string, never>;
};
