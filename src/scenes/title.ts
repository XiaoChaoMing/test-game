import * as THREE from 'three';
import type { GameContext, Scene } from './scene';
import { Stage } from './cinema';
import { t } from '../data/strings';

/** Slowly orbiting campfire in the ash, with the game title. */
export function buildCampfireSet(stage: Stage): void {
  stage.env(0x07070a, 0x0c0c10, 10, 40);
  stage.hemi(0x3a4258, 0x1a120c, 0.9);
  stage.ground(0x3e3630);
  stage.prop({ kind: 'campfire', x: 0, z: 0 });
  stage.prop({ kind: 'dead-tree', x: -3.5, z: -2.5, scale: 1.4, seed: 4 });
  stage.prop({ kind: 'gravestone', x: 2.6, z: -2.2, seed: 2 });
  stage.prop({ kind: 'grave-cross', x: 3.6, z: -0.6, seed: 3 });
  stage.prop({ kind: 'rock', x: -2, z: 2.4, seed: 6, scale: 1.2 });
  stage.prop({ kind: 'torch', x: -1.6, z: -3.4 });
  stage.prop({ kind: 'fence', x: 4.5, z: 2.5, rot: 1.2 });
  stage.particles.setAmbient('ash', 60, 12, 8);
}

export class TitleScene implements Scene {
  private stage!: Stage;
  private el!: HTMLElement;
  private ready = false;
  private readonly onResize = () => this.stage.resize();

  constructor(private readonly ctx: GameContext, private readonly onStart: () => void) {}

  enter(): void {
    this.stage = new Stage(this.ctx);
    buildCampfireSet(this.stage);
    this.el = document.createElement('div');
    this.el.className = 'screen title-screen';
    this.el.innerHTML = `<div class="logo">${t('game.title')}</div><div class="rule"></div><div class="sub">${t('game.subtitle')}</div><div class="demo">${t('title.demo')}</div><div class="press">${t('title.start')}</div>`;
    this.el.addEventListener('mousedown', () => this.start());
    this.ctx.ui.appendChild(this.el);
    window.addEventListener('resize', this.onResize);
    setTimeout(() => (this.ready = true), 900);
  }

  private start(): void {
    if (!this.ready) return;
    this.ready = false;
    this.onStart();
  }

  update(dt: number): void {
    if (this.ctx.input.anyPressed()) this.start();
    this.stage.update(dt);
    const a = this.stage.time * 0.08;
    this.stage.camera.position.set(Math.sin(a) * 9, 3.2 + Math.sin(this.stage.time * 0.2) * 0.4, Math.cos(a) * 9);
    this.stage.camera.lookAt(new THREE.Vector3(0, 1.2, 0));
  }

  render(): void {
    this.stage.render();
  }

  exit(): void {
    this.stage.dispose();
    this.el.remove();
    window.removeEventListener('resize', this.onResize);
  }
}
