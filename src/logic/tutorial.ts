import type { SkillId } from '../data/skills';

export type TutorialStep = 'move' | 'talk' | 'attack' | 'cleave' | 'charge' | 'potion' | 'clear' | 'done';

export type TutorialEvent =
  | { type: 'reachedElder' }
  | { type: 'talkedElder' }
  | { type: 'enemyKilled'; group: string }
  | { type: 'skillUsed'; skill: SkillId }
  | { type: 'potionUsed' }
  | { type: 'groupCleared'; group: string }
  | { type: 'hpChanged'; ratio: number };

const ORDER: TutorialStep[] = ['move', 'talk', 'attack', 'cleave', 'charge', 'potion', 'clear', 'done'];

/** Facts accumulate forever; the step is the first one whose condition is unmet — so it never regresses. */
export class Tutorial {
  step: TutorialStep = 'move';
  private facts = new Set<string>();
  private hpRatio = 1;
  private potionSkipped = false;

  constructor(public enabled = true) {}

  setEnabled(b: boolean): void {
    this.enabled = b;
  }

  handle(e: TutorialEvent): boolean {
    switch (e.type) {
      case 'reachedElder':
      case 'talkedElder':
      case 'potionUsed':
        this.facts.add(e.type);
        break;
      case 'skillUsed':
        this.facts.add(`skill:${e.skill}`);
        break;
      case 'groupCleared':
        this.facts.add(`cleared:${e.group}`);
        break;
      case 'hpChanged':
        this.hpRatio = e.ratio;
        break;
      case 'enemyKilled':
        break;
    }
    return this.advance();
  }

  private done(step: TutorialStep): boolean {
    const f = this.facts;
    switch (step) {
      case 'move': return f.has('reachedElder');
      case 'talk': return f.has('talkedElder');
      case 'attack': return f.has('cleared:lone');
      case 'cleave': return f.has('skill:cleave') && f.has('cleared:pack');
      case 'charge': return f.has('skill:charge') && f.has('cleared:hound');
      case 'potion': return f.has('potionUsed') || this.potionSkipped;
      case 'clear': return f.has('cleared:graveyard');
      case 'done': return false;
    }
  }

  private advance(): boolean {
    const startIdx = ORDER.indexOf(this.step);
    let idx = startIdx;
    while (idx < ORDER.length - 1 && this.done(ORDER[idx])) {
      idx++;
      if (ORDER[idx] === 'potion' && this.hpRatio >= 1 && !this.facts.has('potionUsed')) this.potionSkipped = true;
    }
    this.step = ORDER[idx];
    return idx !== startIdx;
  }

  hint(): string | null {
    if (!this.enabled || this.step === 'done') return null;
    return `tut.${this.step}`;
  }
}
