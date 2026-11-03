/** Mouse + keyboard state with per-frame edge detection. */
export class Input {
  mouseNdc = { x: 0, y: 0 };
  mousePx = { x: 0, y: 0 };
  leftDown = false;
  leftPressed = false;
  rightPressed = false;
  wheel = 0;
  private pressed = new Set<string>();
  private down = new Set<string>();
  enabled = true;
  private readonly disposers: (() => void)[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    const on = <K extends keyof WindowEventMap>(target: Window | HTMLElement, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn as EventListener, opts);
      this.disposers.push(() => target.removeEventListener(type, fn as EventListener));
    };
    on(window, 'mousemove', (e) => this.setMouse(e.clientX, e.clientY));
    on(canvas, 'mousedown', (e) => {
      this.setMouse(e.clientX, e.clientY);
      if (e.button === 0) {
        this.leftDown = true;
        this.leftPressed = true;
      } else if (e.button === 2) this.rightPressed = true;
    });
    on(window, 'mouseup', (e) => {
      if (e.button === 0) this.leftDown = false;
    });
    on(window, 'blur', () => {
      this.leftDown = false;
      this.down.clear();
    });
    on(canvas, 'contextmenu', (e) => e.preventDefault());
    on(canvas, 'wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    on(window, 'keydown', (e) => {
      if (e.repeat) return;
      this.pressed.add(e.code);
      this.down.add(e.code);
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    on(window, 'keyup', (e) => this.down.delete(e.code));
  }

  private setMouse(cx: number, cy: number): void {
    const r = this.canvas.getBoundingClientRect();
    this.mousePx = { x: cx - r.left, y: cy - r.top };
    this.mouseNdc = { x: ((cx - r.left) / r.width) * 2 - 1, y: -((cy - r.top) / r.height) * 2 + 1 };
  }

  keyPressed(code: string): boolean {
    return this.enabled && this.pressed.has(code);
  }

  keyDown(code: string): boolean {
    return this.enabled && this.down.has(code);
  }

  anyPressed(): boolean {
    return this.pressed.size > 0 || this.leftPressed;
  }

  /** consume a press so later readers in the same frame don't see it */
  consume(code: string): void {
    this.pressed.delete(code);
  }

  consumeClick(): void {
    this.leftPressed = false;
  }

  endFrame(): void {
    this.pressed.clear();
    this.leftPressed = false;
    this.rightPressed = false;
    this.wheel = 0;
  }

  dispose(): void {
    for (const d of this.disposers) d();
  }
}
