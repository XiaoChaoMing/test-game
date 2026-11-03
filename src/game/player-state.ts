import { PLAYER_BASE } from '../data/player';
import { Cooldowns, FuryPool } from '../logic/combat';
import { statsForLevel } from '../logic/progression';

/** Persistent player progress across maps (plain data + two small helpers). */
export class PlayerState {
  level = 1;
  xp = 0;
  potions: number = PLAYER_BASE.potions;
  readonly fury = new FuryPool(PLAYER_BASE.maxFury);
  readonly cooldowns = new Cooldowns();
  mapIndex: 1 | 2 = 1;
  kills = 0;
  deaths = 0;
  playTime = 0;
  inCombatTimer = 0;

  get stats() {
    return statsForLevel(this.level);
  }

  get inCombat(): boolean {
    return this.inCombatTimer > 0;
  }
}
