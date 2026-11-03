import { describe, expect, it } from 'vitest';
import { Tutorial } from '../../src/logic/tutorial';
import { t } from '../../src/data/strings';

const happy = (tut: Tutorial, hpRatio = 0.6) => {
  tut.handle({ type: 'reachedElder' });
  tut.handle({ type: 'talkedElder' });
  tut.handle({ type: 'groupCleared', group: 'lone' });
  tut.handle({ type: 'skillUsed', skill: 'cleave' });
  tut.handle({ type: 'groupCleared', group: 'pack' });
  tut.handle({ type: 'hpChanged', ratio: hpRatio });
  tut.handle({ type: 'skillUsed', skill: 'charge' });
  tut.handle({ type: 'groupCleared', group: 'hound' });
};

describe('Tutorial', () => {
  it('walks the full happy path to done', () => {
    const tut = new Tutorial();
    expect(tut.step).toBe('move');
    happy(tut);
    expect(tut.step).toBe('potion');
    tut.handle({ type: 'potionUsed' });
    expect(tut.step).toBe('clear');
    tut.handle({ type: 'groupCleared', group: 'graveyard' });
    expect(tut.step).toBe('done');
    expect(tut.hint()).toBeNull();
  });

  it('skips the potion step when hp is full on reaching it', () => {
    const tut = new Tutorial();
    happy(tut, 1);
    expect(tut.step).toBe('clear');
  });

  it('does not skip steps when later events arrive early', () => {
    const tut = new Tutorial();
    tut.handle({ type: 'talkedElder' });
    tut.handle({ type: 'groupCleared', group: 'lone' });
    expect(tut.step).toBe('move');
  });

  it('cleave step needs both the skill use and the pack cleared', () => {
    const tut = new Tutorial();
    tut.handle({ type: 'reachedElder' });
    tut.handle({ type: 'talkedElder' });
    tut.handle({ type: 'groupCleared', group: 'lone' });
    tut.handle({ type: 'groupCleared', group: 'pack' });
    expect(tut.step).toBe('cleave');
    expect(tut.handle({ type: 'skillUsed', skill: 'cleave' })).toBe(true);
    expect(tut.step).toBe('charge');
  });

  it('still advances while disabled but shows no hint', () => {
    const tut = new Tutorial(false);
    expect(tut.hint()).toBeNull();
    tut.handle({ type: 'reachedElder' });
    expect(tut.step).toBe('talk');
    tut.setEnabled(true);
    expect(tut.hint()).toBe('tut.talk');
  });

  it('never regresses when old events are re-sent (e.g. after respawn)', () => {
    const tut = new Tutorial();
    happy(tut);
    const before = tut.step;
    expect(tut.handle({ type: 'reachedElder' })).toBe(false);
    expect(tut.step).toBe(before);
  });
});

describe('strings', () => {
  it('interpolates variables', () => {
    expect(t('hud.level', { n: 3 })).toContain('3');
  });
  it('returns the key for missing strings', () => {
    expect(t('nope.missing')).toBe('nope.missing');
  });
});
