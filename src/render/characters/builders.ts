import * as THREE from 'three';
import { Rig } from './rig';
import { Animator, houndClips, humanoidClips, type AnimName, type HumanoidStyle } from './animator';
import type { EnemyId } from '../../data/enemies';
import { angleDiff } from '../../logic/vec';

export type CharacterKind = 'wanderer' | EnemyId | 'elder';

export type CharacterView = {
  root: THREE.Group;
  rig: Rig;
  anim: Animator;
  height: number;
  /** world-space-trackable point at the weapon tip (for slash trails) */
  weaponTip?: THREE.Object3D;
  /** light-emitting point (wanderer chest spark, elder lantern) */
  glowPoint?: THREE.Object3D;
  play(a: AnimName, speed?: number, restart?: boolean): void;
  update(dt: number): void;
  flash(color?: number): void;
  setFacing(rad: number, immediate?: boolean): void;
  readonly facing: number;
};

type HumanoidSpec = {
  scale: number;
  skin: THREE.Material;
  torso: THREE.Material;
  legs: THREE.Material;
  arms: THREE.Material;
  feet: THREE.Material;
  bony?: boolean;
  torsoW?: number;
};

type HumanoidParts = {
  hips: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  handL: THREE.Group;
  handR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
};

/** Shared humanoid skeleton. Zero rotation = standing, arms down, facing +z. */
function humanoid(rig: Rig, s: HumanoidSpec): HumanoidParts {
  const tw = s.torsoW ?? 0.48;
  const limb = s.bony ? 0.07 : 0.15;
  rig.body.scale.setScalar(s.scale);

  const hips = rig.joint('hips', rig.body, 0, 0.95, 0);
  rig.box(hips, tw * 0.85, 0.2, 0.26, s.legs, 0, 0, 0);

  for (const side of [-1, 1] as const) {
    const n = side < 0 ? 'L' : 'R';
    const leg = rig.joint(`leg${n}`, hips, side * 0.13, -0.06, 0);
    if (s.bony) rig.cyl(leg, 0.045, 0.04, 0.44, s.legs, 5, 0, -0.22, 0);
    else rig.box(leg, limb + 0.02, 0.46, limb + 0.04, s.legs, 0, -0.22, 0);
    const shin = rig.joint(`shin${n}`, leg, 0, -0.45, 0);
    if (s.bony) rig.cyl(shin, 0.04, 0.035, 0.42, s.legs, 5, 0, -0.21, 0);
    else rig.box(shin, limb, 0.44, limb + 0.02, s.legs, 0, -0.22, 0);
    rig.box(shin, limb + 0.03, 0.08, 0.26, s.feet, 0, -0.45, 0.05);
  }

  const spine = rig.joint('spine', hips, 0, 0.08, 0);
  if (s.bony) {
    rig.cyl(spine, 0.04, 0.04, 0.32, s.torso, 5, 0, 0.15, -0.04);
  } else {
    rig.box(spine, tw * 0.82, 0.3, 0.26, s.torso, 0, 0.15, 0);
  }
  const chest = rig.joint('chest', spine, 0, 0.3, 0);
  if (s.bony) {
    for (let i = 0; i < 4; i++) rig.box(chest, tw * (0.75 - i * 0.08), 0.04, 0.24, s.torso, 0, 0.32 - i * 0.08, 0.0);
    rig.cyl(chest, 0.045, 0.045, 0.4, s.torso, 5, 0, 0.18, -0.08);
  } else {
    rig.box(chest, tw, 0.4, 0.3, s.torso, 0, 0.18, 0);
  }
  const head = rig.joint('head', chest, 0, 0.42, 0);
  rig.box(head, 0.06, 0.1, 0.06, s.skin, 0, 0.0, 0);
  rig.box(head, 0.24, 0.27, 0.25, s.skin, 0, 0.17, 0.01);

  const hands: Record<string, THREE.Group> = {};
  const arms: Record<string, THREE.Group> = {};
  for (const side of [-1, 1] as const) {
    const n = side < 0 ? 'L' : 'R';
    const arm = rig.joint(`arm${n}`, chest, side * (tw / 2 + 0.07), 0.34, 0);
    arms[n] = arm;
    if (s.bony) rig.cyl(arm, 0.04, 0.035, 0.34, s.arms, 5, 0, -0.17, 0);
    else rig.box(arm, limb - 0.01, 0.36, limb - 0.01, s.arms, 0, -0.17, 0);
    const fore = rig.joint(`fore${n}`, arm, 0, -0.34, 0);
    if (s.bony) rig.cyl(fore, 0.035, 0.03, 0.3, s.arms, 5, 0, -0.15, 0);
    else rig.box(fore, limb - 0.03, 0.32, limb - 0.03, s.arms, 0, -0.15, 0);
    const hand = new THREE.Group();
    hand.position.set(0, -0.33, 0);
    fore.add(hand);
    rig.box(hand, 0.09, 0.1, 0.1, s.skin, 0, 0, 0);
    hands[n] = hand;
  }
  rig.height = 1.85 * s.scale;
  return { hips, spine, chest, head, handL: hands.L, handR: hands.R, armL: arms.L, armR: arms.R };
}

function makeView(rig: Rig, anim: Animator, extra: Partial<CharacterView> = {}): CharacterView {
  let facing = 0;
  let target = 0;
  const view: CharacterView = {
    root: rig.root,
    rig,
    anim,
    height: rig.height,
    ...extra,
    play: (a, speed = 1, restart = false) => anim.play(a, speed, restart),
    update(dt) {
      const d = angleDiff(facing, target);
      const step = Math.min(Math.abs(d), 16 * dt);
      facing += Math.sign(d) * step;
      rig.root.rotation.y = facing;
      anim.update(dt);
      rig.updateFlash(dt);
    },
    flash: (color = 0xffffff) => rig.flash(color),
    setFacing(rad, immediate = false) {
      target = rad;
      if (immediate) {
        facing = rad;
        rig.root.rotation.y = rad;
      }
    },
    get facing() {
      return facing;
    },
  };
  return view;
}

// ------------------------------------------------------------------ wanderer

function buildWanderer(): CharacterView {
  const rig = new Rig();
  const leather = rig.mat({ color: 0x2e2622 });
  const steel = rig.mat({ color: 0x6a6f78, metalness: 0.55, roughness: 0.45 });
  const cloth = rig.mat({ color: 0x4a1c16 });
  const skin = rig.mat({ color: 0xa88268 });
  const boots = rig.mat({ color: 0x1a1513 });
  const ember = rig.mat({ color: 0xff8a3a, emissive: 0xff6a1a, emissiveIntensity: 3 });
  const blade = rig.mat({ color: 0xb8bec8, metalness: 0.8, roughness: 0.25, emissive: 0x3a1204, emissiveIntensity: 1 });
  const p = humanoid(rig, { scale: 1, skin, torso: steel, legs: leather, arms: leather, feet: boots });

  // pauldrons, belt, hood, cape
  for (const side of [-1, 1]) rig.box(p.chest, 0.2, 0.12, 0.3, steel, side * 0.3, 0.38, 0).rotation.z = side * -0.35;
  rig.box(p.hips, 0.48, 0.07, 0.3, boots, 0, 0.1, 0);
  rig.box(p.hips, 0.32, 0.28, 0.06, cloth, 0, -0.18, 0.13); // tabard front
  const hood = rig.box(p.head, 0.3, 0.3, 0.3, cloth, 0, 0.2, -0.02);
  hood.scale.set(1, 1, 1);
  rig.cone(p.head, 0.17, 0.22, cloth, 4, 0, 0.36, -0.08).rotation.set(-0.5, Math.PI / 4, 0);
  rig.box(p.head, 0.2, 0.06, 0.02, rig.mat({ color: 0x000000 }), 0, 0.2, 0.14, false); // shadowed face slit
  const cape = rig.joint('cape', p.chest, 0, 0.38, -0.17);
  rig.box(cape, 0.5, 0.95, 0.04, cloth, 0, -0.47, 0).rotation.x = 0.12;
  // the last spark: glowing gem on chest
  const gem = rig.sphere(p.chest, 0.06, ember, 0, 0, 0.24, 0.16, false);
  // sword in right hand: blade points forward (+z) when arm hangs
  const sword = new THREE.Group();
  sword.position.set(0, -0.02, 0.02);
  sword.rotation.x = 0.25;
  p.handR.add(sword);
  rig.box(sword, 0.05, 0.05, 0.22, leather, 0, 0, -0.02);
  rig.box(sword, 0.3, 0.05, 0.06, steel, 0, 0, 0.1);
  rig.box(sword, 0.07, 0.025, 0.95, blade, 0, 0, 0.6);
  const tip = new THREE.Object3D();
  tip.position.set(0, 0, 1.05);
  sword.add(tip);

  const style: HumanoidStyle = { hunch: 0.02, armsForward: 0, limp: 0, weapon: 'sword', heavy: 0 };
  const anim = new Animator(rig, humanoidClips(style));
  return makeView(rig, anim, { weaponTip: tip, glowPoint: gem });
}

// ------------------------------------------------------------------ husk

function buildHusk(): CharacterView {
  const rig = new Rig();
  const flesh = rig.mat({ color: 0x77735c });
  const rot = rig.mat({ color: 0x4f5340 });
  const rags = rig.mat({ color: 0x3a3028 });
  const eye = rig.mat({ color: 0xffc040, emissive: 0xffa020, emissiveIntensity: 2.5 });
  const bone = rig.mat({ color: 0xc8bc9c });
  const p = humanoid(rig, { scale: 0.95 + Math.random() * 0.12, skin: flesh, torso: rot, legs: rags, arms: flesh, feet: rot, torsoW: 0.42 });
  rig.box(p.hips, 0.44, 0.32, 0.28, rags, 0, -0.12, 0); // loincloth
  rig.box(p.chest, 0.3, 0.06, 0.04, bone, 0, 0.18, 0.16); // exposed ribs
  rig.box(p.chest, 0.28, 0.06, 0.04, bone, 0, 0.08, 0.16);
  for (const side of [-1, 1]) {
    rig.box(p.head, 0.05, 0.04, 0.02, eye, side * 0.06, 0.2, 0.135, false);
    const hand = side < 0 ? p.handL : p.handR;
    for (let i = -1; i <= 1; i++) rig.cone(hand, 0.02, 0.14, bone, 4, i * 0.03, -0.1, 0.03).rotation.x = Math.PI;
  }
  rig.box(p.head, 0.18, 0.06, 0.08, rot, 0, 0.04, 0.1); // slack jaw
  const style: HumanoidStyle = { hunch: 0.45, armsForward: 0.9, limp: 0.6, weapon: 'claws', heavy: 0.15 };
  return makeView(rig, new Animator(rig, humanoidClips(style)));
}

// ------------------------------------------------------------------ archer

function buildArcher(): CharacterView {
  const rig = new Rig();
  const bone = rig.mat({ color: 0xcfc3a3 });
  const rag = rig.mat({ color: 0x2c2e36 });
  const eye = rig.mat({ color: 0x8fe0ff, emissive: 0x40b8ff, emissiveIntensity: 3 });
  const wood = rig.mat({ color: 0x4b3424 });
  const p = humanoid(rig, { scale: 1, skin: bone, torso: bone, legs: bone, arms: bone, feet: bone, bony: true, torsoW: 0.4 });
  // skull tweak + hood
  rig.cone(p.head, 0.2, 0.36, rag, 5, 0, 0.3, -0.03);
  for (const side of [-1, 1]) rig.box(p.head, 0.05, 0.05, 0.02, eye, side * 0.06, 0.18, 0.135, false);
  rig.box(p.hips, 0.4, 0.34, 0.26, rag, 0, -0.15, 0).rotation.x = 0.05;
  // quiver
  const quiver = rig.cyl(p.chest, 0.07, 0.06, 0.5, wood, 6, 0.1, 0.2, -0.18);
  quiver.rotation.z = 0.4;
  // bow in left hand: half torus vertical
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 4, 10, Math.PI), wood);
  bow.castShadow = true;
  bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
  bow.position.set(0, -0.02, 0.05);
  p.handL.add(bow);
  const string = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.9, 0.01), rig.mat({ color: 0xbbbbbb }));
  string.position.set(0, -0.02, -0.0);
  p.handL.add(string);
  const tip = new THREE.Object3D();
  tip.position.set(0, 0, 0.3);
  p.handL.add(tip);
  const style: HumanoidStyle = { hunch: 0.1, armsForward: 0, limp: 0, weapon: 'bow', heavy: 0 };
  return makeView(rig, new Animator(rig, humanoidClips(style)), { weaponTip: tip });
}

// ------------------------------------------------------------------ warden (boss)

function buildWarden(): CharacterView {
  const rig = new Rig();
  const iron = rig.mat({ color: 0x2c2f35, metalness: 0.65, roughness: 0.4 });
  const bone = rig.mat({ color: 0xbdb193 });
  const rag = rig.mat({ color: 0x1d1f26 });
  const soul = rig.mat({ color: 0x9fe6ff, emissive: 0x3fb4ff, emissiveIntensity: 1.8 });
  const rust = rig.mat({ color: 0x5a3a26, metalness: 0.3 });
  const p = humanoid(rig, { scale: 2.1, skin: bone, torso: iron, legs: iron, arms: bone, feet: iron, torsoW: 0.6 });
  // massive pauldrons with spikes
  for (const side of [-1, 1]) {
    const pad = rig.box(p.chest, 0.32, 0.18, 0.4, iron, side * 0.4, 0.38, 0);
    pad.rotation.z = side * -0.4;
    rig.cone(p.chest, 0.05, 0.22, bone, 4, side * 0.48, 0.55, 0).rotation.z = side * -0.5;
  }
  // horned helm
  rig.box(p.head, 0.3, 0.3, 0.3, iron, 0, 0.18, 0);
  for (const side of [-1, 1]) {
    const horn = rig.cone(p.head, 0.05, 0.35, bone, 5, side * 0.2, 0.38, -0.02);
    horn.rotation.z = side * -0.7;
  }
  for (const side of [-1, 1]) rig.box(p.head, 0.06, 0.035, 0.02, soul, side * 0.07, 0.19, 0.155, false);
  // soul core in chest
  const core = rig.sphere(p.chest, 0.09, soul, 0, 0, 0.2, 0.15, false);
  // tattered cape + skirt
  const cape = rig.joint('cape', p.chest, 0, 0.38, -0.18);
  rig.box(cape, 0.65, 1.0, 0.04, rag, 0, -0.5, 0).rotation.x = 0.1;
  rig.box(p.hips, 0.56, 0.34, 0.32, rag, 0, -0.16, 0);
  // great maul held in both hands (attached to right)
  const maul = new THREE.Group();
  maul.rotation.x = 0.2;
  p.handR.add(maul);
  rig.box(maul, 0.07, 0.07, 1.25, rust, 0, 0, 0.45);
  rig.box(maul, 0.34, 0.3, 0.42, iron, 0, 0, 1.05);
  for (const sx of [-1, 1]) rig.cone(maul, 0.06, 0.18, bone, 4, sx * 0.22, 0, 1.05).rotation.z = sx * (Math.PI / 2);
  const tip = new THREE.Object3D();
  tip.position.set(0, 0, 1.15);
  maul.add(tip);
  const style: HumanoidStyle = { hunch: 0.18, armsForward: 0, limp: 0, weapon: 'mace', heavy: 1 };
  return makeView(rig, new Animator(rig, humanoidClips(style)), { weaponTip: tip, glowPoint: core });
}

// ------------------------------------------------------------------ elder

function buildElder(): CharacterView {
  const rig = new Rig();
  const robe = rig.mat({ color: 0x3e3a4a });
  const robeDark = rig.mat({ color: 0x2a2732 });
  const skin = rig.mat({ color: 0xb79a80 });
  const beard = rig.mat({ color: 0xd8d4cc });
  const wood = rig.mat({ color: 0x4b3424 });
  const lantern = rig.mat({ color: 0xffb060, emissive: 0xff8a2a, emissiveIntensity: 3 });
  const p = humanoid(rig, { scale: 0.95, skin, torso: robe, legs: robeDark, arms: robe, feet: robeDark });
  rig.cone(p.hips, 0.42, 1.05, robeDark, 7, 0, -0.42, 0); // robe skirt
  rig.cone(p.head, 0.2, 0.3, robe, 6, 0, 0.32, -0.04); // hood
  rig.box(p.head, 0.28, 0.12, 0.28, robe, 0, 0.26, -0.02);
  rig.cone(p.head, 0.1, 0.32, beard, 5, 0, -0.04, 0.12).rotation.x = Math.PI;
  const staff = new THREE.Group();
  p.handL.add(staff);
  staff.rotation.x = -0.1;
  rig.cyl(staff, 0.03, 0.03, 1.9, wood, 5, 0, 0.35, 0.05);
  const lamp = rig.box(staff, 0.12, 0.16, 0.12, lantern, 0, 1.35, 0.1, false);
  const style: HumanoidStyle = { hunch: 0.28, armsForward: 0, limp: 0.2, weapon: 'staff', heavy: 0.3 };
  return makeView(rig, new Animator(rig, humanoidClips(style)), { glowPoint: lamp });
}

// ------------------------------------------------------------------ hound

function buildHound(): CharacterView {
  const rig = new Rig();
  const hide = rig.mat({ color: 0x3b3735 });
  const hideDark = rig.mat({ color: 0x252221 });
  const ember = rig.mat({ color: 0xff7a2a, emissive: 0xff5a10, emissiveIntensity: 2.4 });
  const bone = rig.mat({ color: 0xd2c6a8 });
  const spine = rig.joint('spine', rig.body, 0, 0.62, 0);
  rig.box(spine, 0.36, 0.32, 0.85, hide, 0, 0, 0);
  rig.box(spine, 0.4, 0.38, 0.35, hideDark, 0, 0.03, 0.25); // chest
  for (let i = 0; i < 4; i++) rig.box(spine, 0.05, 0.04, 0.12, ember, 0, 0.17, -0.3 + i * 0.18, false);
  for (let i = 0; i < 3; i++) rig.cone(spine, 0.04, 0.14, bone, 4, 0, 0.22, -0.25 + i * 0.2);
  const neck = rig.joint('neck', spine, 0, 0.1, 0.42);
  rig.box(neck, 0.22, 0.22, 0.3, hide, 0, 0.06, 0.12).rotation.x = -0.5;
  const head = rig.joint('head', neck, 0, 0.16, 0.3);
  rig.box(head, 0.26, 0.22, 0.26, hide, 0, 0, 0);
  rig.box(head, 0.16, 0.12, 0.24, hideDark, 0, -0.02, 0.22);
  for (const side of [-1, 1]) {
    rig.box(head, 0.05, 0.04, 0.02, ember, side * 0.08, 0.05, 0.13, false);
    rig.cone(head, 0.05, 0.14, hideDark, 4, side * 0.09, 0.15, -0.05).rotation.x = -0.4;
  }
  const jaw = rig.joint('jaw', head, 0, -0.08, 0.12);
  rig.box(jaw, 0.14, 0.05, 0.24, bone, 0, -0.02, 0.1);
  const legs: [string, number, number][] = [['fl', -1, 0.3], ['fr', 1, 0.3], ['bl', -1, -0.32], ['br', 1, -0.32]];
  for (const [n, side, z] of legs) {
    const up = rig.joint(n, spine, side * 0.15, -0.08, z);
    rig.box(up, 0.1, 0.32, 0.12, hide, 0, -0.15, 0);
    const low = rig.joint(`${n}2`, up, 0, -0.3, 0);
    rig.box(low, 0.07, 0.28, 0.08, hideDark, 0, -0.13, 0);
  }
  const tail = rig.joint('tail', spine, 0, 0.08, -0.43);
  rig.box(tail, 0.06, 0.06, 0.45, hide, 0, 0, -0.2);
  rig.height = 1.0;
  return makeView(rig, new Animator(rig, houndClips()));
}

export function buildCharacter(kind: CharacterKind): CharacterView {
  switch (kind) {
    case 'wanderer': return buildWanderer();
    case 'husk': return buildHusk();
    case 'hound': return buildHound();
    case 'archer': return buildArcher();
    case 'warden': return buildWarden();
    case 'elder': return buildElder();
  }
}
