import './style.css';
import { createLoop } from './core/loop';
import { Input } from './core/input';
import { createRenderer, type Quality } from './render/renderer';
import { IsoCamera } from './render/camera';
import { SceneManager, type GameContext } from './scenes/scene';
import { LevelScene } from './scenes/level';
import { TitleScene } from './scenes/title';
import { IntroScene } from './scenes/intro';
import { EndingScene } from './scenes/ending';
import { PlayerState } from './game/player-state';
import { Tutorial } from './logic/tutorial';
import { EMBERFALL } from './data/maps/emberfall';
import { CRYPT } from './data/maps/crypt';
import { PauseMenu } from './ui/menus';
import { runRigGallery } from './debug/rig-gallery';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const params = new URLSearchParams(location.search);

function boot(): void {
  const quality: Quality = params.get('q') === 'low' ? 'low' : 'high';
  const gr = createRenderer(canvas, quality);
  const camera = new IsoCamera(window.innerWidth / window.innerHeight);
  const input = new Input(canvas);
  const scenes = new SceneManager(gr.grade);
  const ctx: GameContext = { gr, input, ui, camera, settings: { quality, tutorial: true }, scenes, canvas };

  const onResize = () => {
    gr.resize(window.innerWidth, window.innerHeight);
    camera.resize(window.innerWidth / window.innerHeight);
  };
  window.addEventListener('resize', onResize);
  onResize();

  let ps = new PlayerState();
  let tutorial = new Tutorial(ctx.settings.tutorial);

  const level = (which: 'emberfall' | 'crypt'): LevelScene => {
    let def = which === 'crypt' ? CRYPT : EMBERFALL;
    const at = params.get('at');
    if (at && import.meta.env.DEV) {
      const [x, z] = at.split(',').map(Number);
      def = { ...def, playerStart: { x, z } };
    }
    return new LevelScene(ctx, def, ps, tutorial, {
      onExit: (next) => scenes.go(level(next), 0.9),
      onFinish: () => scenes.go(ending(), 1.5),
    });
  };
  const ending = () =>
    new EndingScene(ctx, ps, () => {
      ps = new PlayerState();
      tutorial = new Tutorial(ctx.settings.tutorial);
      scenes.go(title(), 0.8);
    });
  const intro = () => new IntroScene(ctx, () => scenes.go(level('emberfall'), 1.2));
  const title = () => new TitleScene(ctx, () => scenes.go(intro(), 1.0));

  const pause = new PauseMenu(ui, ctx.settings, {
    onResume: () => togglePause(false),
    onQuality: () => {
      ctx.settings.quality = ctx.settings.quality === 'high' ? 'low' : 'high';
      gr.setQuality(ctx.settings.quality);
    },
    onTutorial: () => {
      ctx.settings.tutorial = !ctx.settings.tutorial;
      tutorial.setEnabled(ctx.settings.tutorial);
    },
    onRestart: () => {
      const cur = scenes.current;
      togglePause(false);
      if (cur instanceof LevelScene) scenes.go(level(cur.def.id), 0.6);
    },
  });
  const togglePause = (open: boolean) => {
    const cur = scenes.current;
    if (!(cur instanceof LevelScene)) return;
    cur.world.paused = open;
    if (open) pause.show();
    else pause.hide();
  };

  if (import.meta.env.DEV) (window as unknown as { __ashfall: unknown }).__ashfall = { ctx, scenes, get ps() { return ps; }, get tutorial() { return tutorial; } };

  const startAt = params.get('level');
  if (startAt === 'emberfall' || startAt === 'crypt') scenes.go(level(startAt));
  else if (params.has('intro')) scenes.go(intro());
  else scenes.go(title());

  const perf = { frames: 0, acc: 0, worst: 0, fps: 0, calls: 0, tris: 0 };
  let statsEl: HTMLElement | null = null;
  if (params.has('stats')) {
    statsEl = document.createElement('div');
    statsEl.style.cssText = 'position:fixed;left:8px;top:8px;font:12px monospace;color:#9f9;background:rgba(0,0,0,.6);padding:4px 6px;z-index:99';
    document.body.appendChild(statsEl);
  }
  (window as unknown as { __perf: typeof perf }).__perf = perf;
  gr.renderer.info.autoReset = false;
  let lastCalls = 0;
  let lastTris = 0;
  let cpuMs = 0;
  (window as unknown as { __cpu: () => number }).__cpu = () => cpuMs;
  createLoop(
    (dt) => {
      perf.frames++;
      perf.acc += dt;
      perf.worst = Math.max(perf.worst, dt);
      if (perf.acc >= 1) {
        perf.fps = perf.frames / perf.acc;
        perf.calls = lastCalls;
        perf.tris = lastTris;
        if (statsEl) statsEl.textContent = `${perf.fps.toFixed(0)} fps · worst ${(perf.worst * 1000).toFixed(0)}ms · ${perf.calls} calls · ${(perf.tris / 1000).toFixed(0)}k tris`;
        perf.frames = 0;
        perf.acc = 0;
        perf.worst = 0;
      }
      const cur = scenes.current;
      if (pause.open && !(cur instanceof LevelScene && cur.world?.paused)) pause.hide();
      if (cur instanceof LevelScene && input.keyPressed('Escape') && !cur.dialogue.open && !scenes.transitioning) {
        togglePause(!pause.open);
        input.consume('Escape');
      }
      scenes.update(dt);
      input.endFrame();
    },
    () => {
      const t0 = performance.now();
      gr.renderer.info.reset();
      scenes.render();
      lastCalls = gr.renderer.info.render.calls;
      lastTris = gr.renderer.info.render.triangles;
      cpuMs = cpuMs * 0.9 + (performance.now() - t0) * 0.1;
    },
  ).start();
}

if (params.has('rigs') && import.meta.env.DEV) runRigGallery(canvas);
else void document.fonts.ready.then(boot);
