export type EnemyId = 'husk' | 'hound' | 'archer' | 'warden';

export type EnemyDef = {
  id: EnemyId;
  nameKey: string;
  maxHp: number;
  damage: number;
  armor: number;
  moveSpeed: number;
  radius: number;
  aggroRange: number;
  attackRange: number;
  /** half-angle in degrees that a melee strike still connects within */
  attackArcDeg: number;
  windup: number;
  recover: number;
  xp: number;
  potionDropChance: number;
  retreatAfterAttack?: number;
  ranged?: { projectileSpeed: number; preferredRange: number };
};

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  husk: {
    id: 'husk', nameKey: 'enemy.husk', maxHp: 40, damage: 8, armor: 0, moveSpeed: 2.2, radius: 0.45,
    aggroRange: 9, attackRange: 1.4, attackArcDeg: 70, windup: 0.5, recover: 0.7, xp: 10, potionDropChance: 0.12,
  },
  hound: {
    id: 'hound', nameKey: 'enemy.hound', maxHp: 28, damage: 6, armor: 0, moveSpeed: 5.5, radius: 0.4,
    aggroRange: 12, attackRange: 1.3, attackArcDeg: 70, windup: 0.3, recover: 0.4, xp: 12, potionDropChance: 0.1,
    retreatAfterAttack: 1.2,
  },
  archer: {
    id: 'archer', nameKey: 'enemy.archer', maxHp: 30, damage: 9, armor: 0, moveSpeed: 2.6, radius: 0.42,
    aggroRange: 11, attackRange: 9, attackArcDeg: 180, windup: 0.8, recover: 0.9, xp: 15, potionDropChance: 0.15,
    ranged: { projectileSpeed: 13, preferredRange: 7 },
  },
  warden: {
    id: 'warden', nameKey: 'enemy.warden', maxHp: 900, damage: 22, armor: 3, moveSpeed: 2.4, radius: 1.3,
    aggroRange: 14, attackRange: 3.2, attackArcDeg: 90, windup: 1.1, recover: 1.0, xp: 200, potionDropChance: 1,
  },
};
