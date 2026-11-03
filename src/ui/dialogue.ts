export type Line = { speaker: string; text: string };

/** Modal dialogue box with typewriter text; advance by click or Space/Enter. */
export class Dialogue {
  private readonly el: HTMLElement;
  private readonly speaker: HTMLElement;
  private readonly text: HTMLElement;
  private lines: Line[] = [];
  private idx = 0;
  private shown = 0;
  private resolve: (() => void) | null = null;
  open = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'dialogue';
    this.el.innerHTML = '<div class="speaker"></div><div class="text"></div><div class="more">▸ Click / Space</div>';
    this.speaker = this.el.querySelector('.speaker')!;
    this.text = this.el.querySelector('.text')!;
    this.el.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.advance();
    });
    parent.appendChild(this.el);
  }

  show(lines: Line[]): Promise<void> {
    this.lines = lines;
    this.idx = 0;
    this.shown = 0;
    this.open = true;
    this.el.style.display = 'block';
    this.render();
    return new Promise((r) => (this.resolve = r));
  }

  advance(): void {
    if (!this.open) return;
    const line = this.lines[this.idx];
    if (this.shown < line.text.length) {
      this.shown = line.text.length;
      this.render();
      return;
    }
    this.idx++;
    this.shown = 0;
    if (this.idx >= this.lines.length) {
      this.open = false;
      this.el.style.display = 'none';
      this.resolve?.();
      this.resolve = null;
      return;
    }
    this.render();
  }

  update(dt: number): void {
    if (!this.open) return;
    const line = this.lines[this.idx];
    if (this.shown < line.text.length) {
      this.shown = Math.min(line.text.length, this.shown + dt * 55);
      this.render();
    }
  }

  private render(): void {
    const line = this.lines[this.idx];
    this.speaker.textContent = line.speaker;
    this.text.textContent = line.text.slice(0, Math.floor(this.shown));
  }

  dispose(): void {
    this.el.remove();
  }
}
