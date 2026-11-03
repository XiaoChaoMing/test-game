import * as THREE from 'three';
import { createLoop } from '../core/loop';
import { createRenderer } from '../render/renderer';
import { IsoCamera } from '../render/camera';
import { buildCharacter, type CharacterKind } from '../render/characters/builders';
import type { AnimName } from '../render/characters/animator';

export function runRigGallery(canvas: HTMLCanvasElement): void {
  const gr = createRenderer(canvas, 'high');
  const cam = new IsoCamera(window.innerWidth / window.innerHeight);
  cam.setZoom(1.3, true);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x3b3530 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  gr.scene.add(ground);
  const moon = new THREE.DirectionalLight(0x9fb0d8, 2.2);
  moon.position.set(-8, 14, 6);
  moon.castShadow = true;
  gr.scene.add(moon, new THREE.HemisphereLight(0x606880, 0x201810, 1.4));
  const warm = new THREE.PointLight(0xff8a3a, 30, 12);
  warm.position.set(0, 2, 2);
  gr.scene.add(warm);

  const kinds: CharacterKind[] = ['wanderer', 'husk', 'hound', 'archer', 'elder', 'warden'];
  const params = new URLSearchParams(location.search);
  const forced = params.get('anim') as AnimName | null;
  const views = kinds.map((k, i) => {
    const v = buildCharacter(k);
    v.root.position.set((i - 2.5) * 2.2, 0, (i - 2.5) * -2.2 * 0 );
    v.setFacing(Math.PI / 4, true);
    gr.scene.add(v.root);
    return v;
  });
  const cycle: AnimName[] = ['idle', 'walk', 'attack', 'hit', 'cast', 'die'];
  let t = 0;
  let idx = -1;
  const onResize = () => {
    gr.resize(window.innerWidth, window.innerHeight);
    cam.resize(window.innerWidth / window.innerHeight);
  };
  window.addEventListener('resize', onResize);
  onResize();
  createLoop(
    (dt) => {
      t += dt;
      const ni = Math.floor(t / 2) % cycle.length;
      if (ni !== idx) {
        idx = ni;
        for (const v of views) v.play(forced ?? cycle[ni], 1, true);
      }
      for (const v of views) v.update(dt);
      cam.follow(new THREE.Vector3(0, 0, 0), dt);
    },
    () => gr.render(cam.camera),
  ).start();
}
