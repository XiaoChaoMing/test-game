export const MAX_DT = 0.1;

export const clampDt = (raw: number): number => Math.min(MAX_DT, Math.max(0, raw));

export type Loop = { start(): void; stop(): void };

export function createLoop(update: (dt: number) => void, render: (alpha: number) => void): Loop {
  let running = false;
  let last = 0;
  let handle = 0;
  const frame = (now: number) => {
    if (!running) return;
    const dt = clampDt((now - last) / 1000);
    last = now;
    update(dt);
    render(1);
    handle = requestAnimationFrame(frame);
  };
  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      handle = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(handle);
    },
  };
}
