import { t } from '../data/strings';

export class TutorialPanel {
  private readonly el: HTMLElement;
  private current: string | null = null;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'tutorial';
    parent.appendChild(this.el);
  }

  set(key: string | null): void {
    if (key === this.current) return;
    this.current = key;
    if (!key) {
      this.el.classList.remove('show');
      return;
    }
    this.el.classList.remove('show');
    setTimeout(() => {
      if (this.current !== key) return;
      this.el.innerHTML = `<div class="h">Hướng dẫn</div>${t(key)}`;
      this.el.classList.add('show');
    }, 250);
  }

  dispose(): void {
    this.el.remove();
  }
}
