import './menus.css';
import { t } from '../data/strings';
import type { Settings } from '../scenes/scene';

export type PauseActions = { onResume(): void; onQuality(): void; onTutorial(): void; onRestart(): void };

export class PauseMenu {
  private el: HTMLElement | null = null;

  constructor(private readonly parent: HTMLElement, private readonly settings: Settings, private readonly actions: PauseActions) {}

  get open(): boolean {
    return !!this.el;
  }

  show(): void {
    if (this.el) return;
    this.el = document.createElement('div');
    this.el.className = 'screen pause';
    this.parent.appendChild(this.el);
    this.render();
  }

  private render(): void {
    if (!this.el) return;
    const s = this.settings;
    this.el.innerHTML = `<div class="panel">
      <h2>${t('pause.title')}</h2>
      <button class="btn" data-a="resume">${t('pause.resume')}</button>
      <button class="btn" data-a="quality">${t('pause.quality', { q: t(`pause.quality.${s.quality}`) })}</button>
      <button class="btn" data-a="tutorial">${t('pause.tutorial', { s: t(s.tutorial ? 'pause.on' : 'pause.off') })}</button>
      <button class="btn" data-a="restart">${t('pause.restart')}</button>
      <div class="hint">${t('pause.controls')}</div>
    </div>`;
    this.el.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
      b.addEventListener('click', () => {
        const a = b.dataset.a;
        if (a === 'resume') this.actions.onResume();
        if (a === 'quality') this.actions.onQuality();
        if (a === 'tutorial') this.actions.onTutorial();
        if (a === 'restart') this.actions.onRestart();
        this.render();
      }),
    );
  }

  hide(): void {
    this.el?.remove();
    this.el = null;
  }
}
