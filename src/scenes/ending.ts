import * as THREE from 'three';
import type { GameContext, Scene } from './scene';
import { Stage } from './cinema';
import { buildCampfireSet } from './title';
import { t } from '../data/strings';
import type { PlayerState } from '../game/player-state';

const fmtTime = (s: number) => `${Math.floor(s / 60)} phút ${String(Math.floor(s % 60)).padStart(2, '0')} giây`;

export class EndingScene implements Scene {
  private stage!: Stage;
  private el!: HTMLElement;
  private readonly onResize = () => this.stage.resize();

  constructor(private readonly ctx: GameContext, private readonly ps: PlayerState, private readonly onRestart: () => void) {}

  enter(): void {
    this.stage = new Stage(this.ctx);
    buildCampfireSet(this.stage);
    this.el = document.createElement('div');
    this.el.className = 'screen ending';
    this.el.style.background = 'radial-gradient(ellipse, rgba(0,0,0,.25), rgba(0,0,0,.75))';
    this.el.innerHTML = `
      <div class="t">${t('end.title')}</div>
      <div class="line">${t('end.line')}</div>
      <div class="stats">
        <div>${t('end.time', { v: fmtTime(this.ps.playTime) })}</div>
        <div>${t('end.kills', { v: this.ps.kills })}</div>
        <div>${t('end.level', { v: this.ps.level })}</div>
        <div>${t('end.deaths', { v: this.ps.deaths })}</div>
      </div>
      <div class="actions"><button class="btn">${t('end.again')}</button></div>
      <div class="thanks">${t('end.thanks')}</div>`;
    this.el.querySelector('button')!.addEventListener('click', () => this.onRestart());
    this.ctx.ui.appendChild(this.el);
    window.addEventListener('resize', this.onResize);
  }

  update(dt: number): void {
    this.stage.update(dt);
    const a = this.stage.time * 0.05 + 1;
    this.stage.camera.position.set(Math.sin(a) * 11, 5, Math.cos(a) * 11);
    this.stage.camera.lookAt(new THREE.Vector3(0, 0.8, 0));
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
