import type * as THREE from 'three';
import type { GameRenderer, Quality } from '../render/renderer';
import type { Input } from '../core/input';
import type { IsoCamera } from '../render/camera';

export interface Scene {
  enter(): void | Promise<void>;
  update(dt: number): void;
  render(): void;
  exit(): void;
}

export type Settings = { quality: Quality; tutorial: boolean };

export type GameContext = {
  gr: GameRenderer;
  input: Input;
  ui: HTMLElement;
  camera: IsoCamera;
  settings: Settings;
  scenes: SceneManager;
  canvas: HTMLCanvasElement;
};

/** Switches scenes through a fade-to-black using the grade pass. */
export class SceneManager {
  current: Scene | null = null;
  private fade = 0;
  private fadeDir: 0 | 1 | -1 = 0;
  private pending: Scene | null = null;
  private fadeSpeed = 2.5;

  constructor(private readonly grade: { uniforms: Record<string, THREE.IUniform> }) {}

  go(next: Scene, fadeSeconds = 0.4): void {
    if (!this.current) {
      this.current = next;
      void next.enter();
      this.fade = 1;
      this.fadeDir = -1;
      return;
    }
    this.pending = next;
    this.fadeDir = 1;
    this.fadeSpeed = 1 / Math.max(0.05, fadeSeconds);
  }

  get transitioning(): boolean {
    return this.fadeDir !== 0;
  }

  update(dt: number): void {
    if (this.fadeDir !== 0) {
      this.fade += this.fadeDir * this.fadeSpeed * dt;
      if (this.fadeDir === 1 && this.fade >= 1) {
        this.fade = 1;
        this.current?.exit();
        this.current = this.pending;
        this.pending = null;
        void this.current?.enter();
        this.fadeDir = -1;
      } else if (this.fadeDir === -1 && this.fade <= 0) {
        this.fade = 0;
        this.fadeDir = 0;
      }
    }
    this.grade.uniforms.uFade.value = this.fade;
    this.current?.update(dt);
  }

  render(): void {
    this.current?.render();
  }
}
