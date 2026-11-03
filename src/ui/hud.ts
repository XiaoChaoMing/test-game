import './hud.css';
import { ICONS } from './icons';
import { t } from '../data/strings';
import { SKILLS, type SkillId } from '../data/skills';

const el = (cls: string, html = '', tag = 'div') => {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

type SlotEls = { root: HTMLElement; cd: HTMLElement; cdText: HTMLElement };

export class Hud {
  readonly root = el('hud');
  private hpFill: HTMLElement;
  private hpLabel: HTMLElement;
  private furyFill: HTMLElement;
  private furyLabel: HTMLElement;
  private xpFill: HTMLElement;
  private levelText: HTMLElement;
  private potionText: HTMLElement;
  private slots = new Map<SkillId | 'potion', SlotEls>();
  private target: HTMLElement;
  private targetName: HTMLElement;
  private targetFill: HTMLElement;
  private boss: HTMLElement;
  private bossName: HTMLElement;
  private bossFill: HTMLElement;
  private bossLag: HTMLElement;
  private toastEl: HTMLElement;
  private toastTimer = 0;
  private deniedEl: HTMLElement;
  private deniedTimer = 0;
  private mapTitle: HTMLElement;
  readonly floaters: HTMLElement;
  readonly deathEl: HTMLElement;

  constructor(parent: HTMLElement) {
    this.floaters = el('floaters');
    this.root.appendChild(this.floaters);
    const bottom = el('bottom');
    const hp = el('orb hp', '<div class="fill"><div class="wave"></div></div><div class="shine"></div><div class="label"></div>');
    const fury = el('orb fury', '<div class="fill"><div class="wave"></div></div><div class="shine"></div><div class="label"></div>');
    this.hpFill = hp.querySelector('.fill')!;
    this.hpLabel = hp.querySelector('.label')!;
    this.furyFill = fury.querySelector('.fill')!;
    this.furyLabel = fury.querySelector('.label')!;
    const center = el('center-bar');
    const lp = el('levelpot');
    this.levelText = el('', '', 'span');
    this.potionText = el('', '', 'span');
    lp.append(this.levelText, this.potionText);
    const skills = el('skills');
    const order: (SkillId | 'potion')[] = ['basic', 'cleave', 'charge', 'nova', 'potion'];
    for (const id of order) {
      const key = id === 'potion' ? 'Q' : id === 'basic' ? 'LMB' : SKILLS[id].hotkey;
      const cost = id === 'potion' || id === 'basic' ? '' : String(SKILLS[id].fury);
      const s = el('slot', `<div class="icon">${ICONS[id]}</div><div class="cd" style="height:0"></div><div class="cdtext"></div><div class="key">${key}</div><div class="cost">${cost}</div>`);
      s.title = id === 'potion' ? t('hud.potions') : `${t(SKILLS[id].nameKey)} — ${t(SKILLS[id].descKey)}`;
      skills.appendChild(s);
      this.slots.set(id, { root: s, cd: s.querySelector('.cd')!, cdText: s.querySelector('.cdtext')! });
    }
    const xp = el('xpbar', '<div class="fill"></div>');
    this.xpFill = xp.querySelector('.fill')!;
    center.append(lp, skills, xp);
    bottom.append(hp, center, fury);
    this.root.appendChild(bottom);

    this.target = el('target', '<div class="name"></div><div class="bar"><div class="fill"></div></div>');
    this.targetName = this.target.querySelector('.name')!;
    this.targetFill = this.target.querySelector('.fill')!;
    this.boss = el('boss', '<div class="name"></div><div class="bar"><div class="lag"></div><div class="fill"></div></div>');
    this.bossName = this.boss.querySelector('.name')!;
    this.bossFill = this.boss.querySelector('.fill')!;
    this.bossLag = this.boss.querySelector('.lag')!;
    this.toastEl = el('toast');
    this.deniedEl = el('denied-text');
    this.mapTitle = el('maptitle', '<div class="line"></div><div class="t"></div><div class="line"></div>');
    this.deathEl = el('death', `<div class="t">${t('hud.died')}</div><div class="s">${t('hud.respawn')}</div>`);
    this.root.append(this.target, this.boss, this.toastEl, this.deniedEl, this.mapTitle, this.deathEl);
    parent.appendChild(this.root);
  }

  setHp(cur: number, max: number): void {
    this.hpFill.style.height = `${Math.max(0, Math.min(1, cur / max)) * 100}%`;
    this.hpLabel.textContent = `${Math.ceil(cur)} / ${Math.round(max)}`;
  }

  setFury(cur: number, max: number): void {
    this.furyFill.style.height = `${(cur / max) * 100}%`;
    this.furyLabel.textContent = `${Math.floor(cur)}`;
  }

  setXp(ratio: number, level: number): void {
    this.xpFill.style.width = `${Math.min(1, ratio) * 100}%`;
    this.levelText.innerHTML = `<b>${t('hud.level', { n: level })}</b>`;
  }

  setPotions(n: number): void {
    this.potionText.innerHTML = `${t('hud.potions')}: <b>${n}</b>`;
  }

  setSkill(id: SkillId | 'potion', s: { cdRatio: number; cdLeft: number; usable: boolean; locked: boolean }): void {
    const slot = this.slots.get(id);
    if (!slot) return;
    slot.cd.style.height = `${s.cdRatio * 100}%`;
    slot.cdText.textContent = s.cdLeft > 0 ? s.cdLeft.toFixed(s.cdLeft < 1 ? 1 : 0) : '';
    slot.root.classList.toggle('unusable', !s.usable && !s.locked);
    slot.root.classList.toggle('locked', s.locked);
  }

  flashDenied(id: SkillId | 'potion', text: string): void {
    const slot = this.slots.get(id);
    if (slot) {
      slot.root.classList.remove('denied');
      void slot.root.offsetWidth;
      slot.root.classList.add('denied');
    }
    this.deniedEl.textContent = text;
    this.deniedEl.classList.add('show');
    this.deniedTimer = 1.2;
  }

  flashUsed(id: SkillId | 'potion'): void {
    const slot = this.slots.get(id);
    if (!slot) return;
    slot.root.classList.remove('flash');
    void slot.root.offsetWidth;
    slot.root.classList.add('flash');
  }

  setTarget(name: string | null, ratio = 0): void {
    this.target.style.display = name ? 'block' : 'none';
    if (name) {
      this.targetName.textContent = name;
      this.targetFill.style.width = `${ratio * 100}%`;
    }
  }

  setBoss(name: string | null, ratio = 0, enraged = false): void {
    this.boss.style.display = name ? 'block' : 'none';
    if (!name) return;
    this.bossName.textContent = name;
    this.bossFill.style.width = `${ratio * 100}%`;
    this.bossLag.style.width = `${ratio * 100}%`;
    this.boss.classList.toggle('enraged', enraged);
  }

  toast(text: string, seconds = 2.6): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastTimer = seconds;
  }

  showMapTitle(text: string): void {
    this.mapTitle.querySelector('.t')!.textContent = text;
    this.mapTitle.classList.add('show');
    setTimeout(() => this.mapTitle.classList.remove('show'), 3000);
  }

  showDeath(show: boolean): void {
    this.deathEl.classList.toggle('show', show);
  }

  update(dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }
    if (this.deniedTimer > 0) {
      this.deniedTimer -= dt;
      if (this.deniedTimer <= 0) this.deniedEl.classList.remove('show');
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
