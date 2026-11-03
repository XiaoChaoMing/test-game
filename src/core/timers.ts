/** Game-time delayed callbacks: they only advance when update() runs, so pausing delays them and clear() cancels them. */
export class GameTimers {
  private items: { left: number; fn: () => void }[] = [];

  after(seconds: number, fn: () => void): void {
    this.items.push({ left: seconds, fn });
  }

  update(dt: number): void {
    const due: (() => void)[] = [];
    this.items = this.items.filter((it) => {
      it.left -= dt;
      if (it.left <= 0) {
        due.push(it.fn);
        return false;
      }
      return true;
    });
    for (const fn of due) fn();
  }

  clear(): void {
    this.items = [];
  }
}
