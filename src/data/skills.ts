export type SkillId = 'basic' | 'cleave' | 'charge' | 'nova';

export type SkillDef = {
  id: SkillId;
  nameKey: string;
  descKey: string;
  fury: number;
  cooldown: number;
  damageMult: number;
  range: number;
  arcDeg?: number;
  radius?: number;
  unlockMap: 1 | 2;
  slot: 0 | 1 | 2 | 3;
  hotkey: string;
};

export const BASIC_FURY_GAIN = 8;
export const NOVA_BURN = { ratioPerSecond: 0.25, duration: 3 };
export const CHARGE_SPEED = 22;

export const SKILLS: Record<SkillId, SkillDef> = {
  basic: { id: 'basic', nameKey: 'skill.basic', descKey: 'skill.basic.desc', fury: 0, cooldown: 0, damageMult: 1.0, range: 1.6, unlockMap: 1, slot: 0, hotkey: 'LMB' },
  cleave: { id: 'cleave', nameKey: 'skill.cleave', descKey: 'skill.cleave.desc', fury: 20, cooldown: 0, damageMult: 1.4, range: 2.4, arcDeg: 140, unlockMap: 1, slot: 1, hotkey: '1' },
  charge: { id: 'charge', nameKey: 'skill.charge', descKey: 'skill.charge.desc', fury: 15, cooldown: 6, damageMult: 1.2, range: 8, unlockMap: 1, slot: 2, hotkey: '2' },
  nova: { id: 'nova', nameKey: 'skill.nova', descKey: 'skill.nova.desc', fury: 40, cooldown: 12, damageMult: 2.0, range: 0, radius: 4.5, unlockMap: 2, slot: 3, hotkey: '3' },
};
