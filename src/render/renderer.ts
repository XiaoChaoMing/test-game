import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export type Quality = 'high' | 'low';

export const QUALITY_PRESETS: Record<Quality, { pixelRatio: number; bloom: boolean; shadowMap: number; maxLights: number; particleScale: number }> = {
  high: { pixelRatio: 2, bloom: true, shadowMap: 2048, maxLights: 6, particleScale: 1 },
  low: { pixelRatio: 1, bloom: false, shadowMap: 1024, maxLights: 3, particleScale: 0.5 },
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 1.05 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uFlash: { value: 0 },
    uFade: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform vec3 uTint;
    uniform float uFlash;
    uniform float uFade;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.2, length(d) * uVignette);
      vec3 col = c.rgb * mix(0.35, 1.0, v);
      col *= uTint;
      col = mix(col, vec3(0.55, 0.05, 0.03), uFlash * (1.0 - v * 0.6));
      col = mix(col, vec3(0.0), uFade);
      gl_FragColor = vec4(col, c.a);
    }
  `,
};

export type GameRenderer = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  composer: EffectComposer;
  quality: Quality;
  grade: ShaderPass;
  setQuality(q: Quality): void;
  resize(w: number, h: number): void;
  render(camera: THREE.Camera): void;
  onQualityChange(fn: (q: Quality) => void): () => void;
};

export function createRenderer(canvas: HTMLCanvasElement, quality: Quality): GameRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0c10);

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, new THREE.PerspectiveCamera());
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.85);
  const grade = new ShaderPass(GradeShader);
  const output = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(grade);
  composer.addPass(output);

  const listeners: ((q: Quality) => void)[] = [];
  let w = 1;
  let h = 1;

  const api: GameRenderer = {
    renderer,
    scene,
    composer,
    quality,
    grade,
    setQuality(q) {
      api.quality = q;
      const p = QUALITY_PRESETS[q];
      bloom.enabled = p.bloom;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.pixelRatio));
      composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.pixelRatio));
      api.resize(w, h);
      for (const fn of listeners) fn(q);
    },
    resize(nw, nh) {
      w = Math.max(1, nw);
      h = Math.max(1, nh);
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
    },
    render(camera) {
      renderPass.camera = camera;
      composer.render();
    },
    onQualityChange(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  };
  api.setQuality(quality);
  return api;
}
