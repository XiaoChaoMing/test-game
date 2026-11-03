import * as THREE from 'three';
import { emptyPose, type Pose, type Rig } from './rig';

export type AnimName = 'idle' | 'walk' | 'attack' | 'cast' | 'hit' | 'die' | 'charge' | 'shoot' | 'roar' | 'slam' | 'sweep' | 'talk';

export type Clip = {
  loop: boolean;
  duration: number;
  /** normalized time (0..1) at which the strike event fires */
  strikeAt?: number;
  /** clip to return to when a one-shot finishes; undefined = hold last frame */
  next?: AnimName;
  /** crossfade time into this clip */
  fade?: number;
  sample(t: number, p: Pose): void;
};

export type ClipSet = Partial<Record<AnimName, Clip>>;

const ease = {
  outCubic: (x: number) => 1 - Math.pow(1 - x, 3),
  inCubic: (x: number) => x * x * x,
  inOut: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outBack: (x: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  },
};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** piecewise keyframe interpolation over normalized time */
export function keys(u: number, frames: [number, number][], e: (x: number) => number = ease.inOut): number {
  if (u <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i];
    const [t0, v0] = frames[i - 1];
    if (u <= t1) return lerp(v0, v1, e(clamp01((u - t0) / (t1 - t0))));
  }
  return frames[frames.length - 1][1];
}

export class Animator {
  current: AnimName = 'idle';
  private clip: Clip;
  private t = 0;
  private speed = 1;
  private fadeT = 1;
  private fadeDur = 0.15;
  private struck = false;
  private snapshot = new Map<string, THREE.Euler>();
  private snapBody = { y: 0, z: 0, rx: 0, rz: 0 };
  private readonly pose = emptyPose();
  onStrike: (() => void) | null = null;
  onEnd: ((name: AnimName) => void) | null = null;

  constructor(private readonly rig: Rig, private readonly clips: ClipSet) {
    this.clip = clips.idle!;
  }

  has(name: AnimName): boolean {
    return !!this.clips[name];
  }

  /** seconds from clip start to its strike event at speed 1 */
  strikeTime(name: AnimName): number {
    const c = this.clips[name];
    return c && c.strikeAt !== undefined ? c.duration * c.strikeAt : 0.3;
  }

  play(name: AnimName, speed = 1, restart = false): void {
    const clip = this.clips[name] ?? this.clips.idle!;
    this.speed = speed;
    if (name === this.current && !restart && clip.loop) return;
    // snapshot current joint rotations for crossfade
    for (const [n, j] of this.rig.joints) {
      let e = this.snapshot.get(n);
      if (!e) {
        e = new THREE.Euler();
        this.snapshot.set(n, e);
      }
      e.copy(j.rotation);
    }
    this.snapBody = { y: this.rig.body.position.y, z: this.rig.body.position.z, rx: this.rig.body.rotation.x, rz: this.rig.body.rotation.z };
    this.current = name;
    this.clip = clip;
    this.t = 0;
    this.fadeT = 0;
    this.fadeDur = clip.fade ?? 0.12;
    this.struck = false;
  }

  /** normalized progress of a one-shot clip */
  get progress(): number {
    return this.clip.loop ? 0 : clamp01(this.t / this.clip.duration);
  }

  get busy(): boolean {
    return !this.clip.loop && this.t < this.clip.duration;
  }

  update(dt: number): void {
    this.t += dt * this.speed;
    this.fadeT += dt;
    const c = this.clip;
    let u: number;
    if (c.loop) {
      u = this.t;
    } else {
      u = Math.min(this.t, c.duration);
      if (c.strikeAt !== undefined && !this.struck && this.t >= c.strikeAt * c.duration) {
        this.struck = true;
        this.onStrike?.();
      }
    }
    const p = this.pose;
    p.rot = {};
    p.bodyY = 0;
    p.bodyZ = 0;
    p.bodyRotX = 0;
    p.bodyRotZ = 0;
    c.sample(u, p);

    const k = this.fadeDur > 0 ? ease.outCubic(clamp01(this.fadeT / this.fadeDur)) : 1;
    for (const [n, j] of this.rig.joints) {
      if (n === 'body') continue;
      const target = p.rot[n];
      const tx = target ? target[0] : 0;
      const ty = target ? target[1] : 0;
      const tz = target ? target[2] : 0;
      const s = this.snapshot.get(n);
      if (k < 1 && s) {
        j.rotation.set(lerp(s.x, tx, k), lerp(s.y, ty, k), lerp(s.z, tz, k));
      } else {
        j.rotation.set(tx, ty, tz);
      }
    }
    const b = this.rig.body;
    b.position.y = lerp(this.snapBody.y, p.bodyY, k);
    b.position.z = lerp(this.snapBody.z, p.bodyZ, k);
    b.rotation.x = lerp(this.snapBody.rx, p.bodyRotX, k);
    b.rotation.z = lerp(this.snapBody.rz, p.bodyRotZ, k);

    if (!c.loop && this.t >= c.duration) {
      if (c.next) {
        const done = this.current;
        this.play(c.next);
        this.onEnd?.(done);
      }
    }
  }
}

// ---------------------------------------------------------------- humanoid clips

export type HumanoidStyle = {
  hunch: number; // forward lean of spine (radians)
  armsForward: number; // zombie reach
  limp: number; // 0..1 asymmetry
  weapon: 'sword' | 'mace' | 'bow' | 'staff' | 'claws';
  heavy: number; // 0..1 slower, bigger windups
};

export function humanoidClips(s: HumanoidStyle): ClipSet {
  const base = (p: Pose) => {
    p.rot.spine = [s.hunch, 0, 0];
    p.rot.head = [-s.hunch * 0.6, 0, 0];
    p.rot.armL = [-s.armsForward, 0, 0.12];
    p.rot.armR = [-s.armsForward, 0, -0.12];
    p.rot.foreL = [-0.15 - s.armsForward * 0.3, 0, 0];
    p.rot.foreR = [-0.25 - s.armsForward * 0.3, 0, 0];
    if (s.weapon === 'bow') p.rot.foreL = [-0.4, 0, 0];
  };

  const idle: Clip = {
    loop: true,
    duration: 1,
    fade: 0.25,
    sample(t, p) {
      base(p);
      const br = Math.sin(t * 2.2);
      p.rot.chest = [br * 0.03, 0, 0];
      p.rot.armL[2] += br * 0.03;
      p.rot.armR[2] -= br * 0.03;
      p.rot.head = [p.rot.head[0] + br * 0.02, Math.sin(t * 0.5) * 0.15 * (1 - s.heavy), 0];
      p.bodyY = br * 0.012;
      if (s.armsForward > 0) {
        p.rot.armL[0] += Math.sin(t * 1.3) * 0.08;
        p.rot.armR[0] += Math.sin(t * 1.3 + 1) * 0.08;
      }
    },
  };

  const walk: Clip = {
    loop: true,
    duration: 1,
    fade: 0.15,
    sample(t, p) {
      base(p);
      const ph = t * Math.PI * 2 * 1.6;
      const sL = Math.sin(ph);
      const sR = Math.sin(ph + Math.PI);
      const swing = 0.65 * (1 - s.heavy * 0.3);
      p.rot.legL = [-sL * swing, 0, 0];
      p.rot.legR = [-sR * swing * (1 - s.limp * 0.6), 0, 0];
      p.rot.shinL = [Math.max(0, sL) * 0.9, 0, 0];
      p.rot.shinR = [Math.max(0, sR) * 0.9 * (1 - s.limp * 0.5), 0, 0];
      const armSwing = 0.5 * (1 - s.armsForward);
      p.rot.armL[0] += sL * armSwing;
      p.rot.armR[0] += sR * armSwing * (s.weapon === 'sword' || s.weapon === 'mace' ? 0.5 : 1);
      p.rot.chest = [0.05, Math.sin(ph) * 0.12, 0];
      p.bodyY = Math.abs(Math.cos(ph)) * 0.07 - 0.03;
      p.bodyRotZ = Math.sin(ph) * (0.03 + s.limp * 0.08);
      p.rot.head = [p.rot.head[0], -Math.sin(ph) * 0.08, 0];
    },
  };

  const attackDur = 0.5 + s.heavy * 0.4;
  const attack: Clip = {
    loop: false,
    duration: attackDur,
    strikeAt: 0.45,
    next: 'idle',
    fade: 0.06,
    sample(t, p) {
      base(p);
      const u = t / attackDur;
      if (s.weapon === 'claws') {
        // two-handed lunging claw
        const reach = keys(u, [[0, 0], [0.35, -0.4], [0.5, 1], [1, 0]]);
        p.rot.armL = [-1.2 - reach * 0.9, 0, 0.3 - reach * 0.3];
        p.rot.armR = [-1.2 - reach * 0.6, 0, -0.3 + reach * 0.3];
        p.rot.foreL = [-0.6 + reach * 0.5, 0, 0];
        p.rot.foreR = [-0.6 + reach * 0.5, 0, 0];
        p.rot.spine = [s.hunch + reach * 0.35, 0, 0];
        p.bodyZ = reach * 0.25;
        return;
      }
      // overhead diagonal slash with torso twist
      const twist = keys(u, [[0, 0], [0.38, 0.75], [0.52, -0.6], [0.75, -0.7], [1, 0]]);
      const arm = keys(u, [[0, -0.4], [0.38, -2.7], [0.52, -0.5], [0.75, -0.3], [1, -0.4]]);
      const fore = keys(u, [[0, -0.3], [0.38, -0.9], [0.52, -0.1], [1, -0.3]]);
      const lean = keys(u, [[0, 0], [0.38, -0.12], [0.52, 0.22], [1, 0]]);
      p.rot.chest = [lean, twist, 0];
      p.rot.armR = [arm, 0, -0.25 + twist * 0.2];
      p.rot.foreR = [fore, 0, 0];
      p.rot.armL = [-0.5 + twist * 0.2, 0, 0.35];
      p.rot.legL = [-0.35 * Math.abs(lean) * 2, 0, 0];
      p.rot.legR = [0.3 * Math.abs(lean) * 2, 0, 0];
      p.bodyZ = keys(u, [[0, 0], [0.38, -0.05], [0.52, 0.18], [1, 0]]);
      p.bodyY = -Math.abs(lean) * 0.15;
    },
  };

  const cast: Clip = {
    loop: false,
    duration: 0.65,
    strikeAt: 0.5,
    next: 'idle',
    fade: 0.06,
    sample(t, p) {
      base(p);
      const u = t / 0.65;
      const up = keys(u, [[0, 0], [0.4, 1], [0.55, -0.3], [1, 0]]);
      p.rot.armL = [-1.4 * Math.max(0, up) - 0.2, 0, 0.6 + up * 0.5];
      p.rot.armR = [-1.4 * Math.max(0, up) - 0.2, 0, -0.6 - up * 0.5];
      p.rot.spine = [s.hunch - up * 0.25, 0, 0];
      const crouch = keys(u, [[0, 0], [0.45, 0], [0.55, 1], [0.8, 1], [1, 0]]);
      p.bodyY = -crouch * 0.25;
      p.rot.legL = [-crouch * 0.6, 0, 0];
      p.rot.legR = [-crouch * 0.6, 0, 0];
      p.rot.shinL = [crouch * 1.1, 0, 0];
      p.rot.shinR = [crouch * 1.1, 0, 0];
    },
  };

  const charge: Clip = {
    loop: true,
    duration: 1,
    fade: 0.05,
    sample(t, p) {
      base(p);
      p.rot.spine = [0.5, 0, 0];
      p.rot.armR = [-1.4, 0, -0.2];
      p.rot.foreR = [-0.2, 0, 0];
      p.rot.armL = [0.6, 0, 0.4];
      const ph = t * 30;
      p.rot.legL = [-Math.sin(ph) * 0.9, 0, 0];
      p.rot.legR = [Math.sin(ph) * 0.9, 0, 0];
      p.bodyY = -0.1;
    },
  };

  const shoot: Clip = {
    loop: false,
    duration: 0.9,
    strikeAt: 0.85,
    next: 'idle',
    fade: 0.1,
    sample(t, p) {
      base(p);
      const u = t / 0.9;
      const draw = keys(u, [[0, 0], [0.3, 1], [0.84, 1], [0.9, 0.2], [1, 0]]);
      p.rot.chest = [0, -0.9 * draw, 0];
      p.rot.armL = [-1.5 * draw, 0.0, 0.1];
      p.rot.foreL = [-0.05, 0, 0];
      p.rot.armR = [-1.4 * draw, 0, -0.4 * draw];
      p.rot.foreR = [-1.6 * draw, 0, 0];
      p.rot.head = [0, 0.8 * draw, 0];
    },
  };

  const hit: Clip = {
    loop: false,
    duration: 0.25,
    next: 'idle',
    fade: 0.03,
    sample(t, p) {
      base(p);
      const u = t / 0.25;
      const k = keys(u, [[0, 0], [0.25, 1], [1, 0]]);
      p.rot.chest = [-0.35 * k, 0.15 * k, 0];
      p.rot.head = [-0.3 * k, 0, 0];
      p.rot.armL[2] += 0.4 * k;
      p.rot.armR[2] -= 0.4 * k;
      p.bodyZ = -0.12 * k;
    },
  };

  const die: Clip = {
    loop: false,
    duration: 0.9,
    fade: 0.05,
    sample(t, p) {
      base(p);
      const u = t / 0.9;
      const fall = keys(u, [[0, 0], [0.2, 0.15], [0.75, 1], [0.85, 0.95], [1, 1]], ease.inCubic);
      p.bodyRotX = -fall * (Math.PI / 2 - 0.12);
      p.bodyY = fall * 0.15;
      p.bodyZ = -fall * 0.25;
      p.rot.armL = [-2.2 * fall, 0, 0.8 * fall];
      p.rot.armR = [-2.0 * fall, 0, -0.9 * fall];
      p.rot.legL = [-0.3 * fall, 0, 0.1];
      p.rot.legR = [0.15 * fall, 0, -0.1];
      p.rot.shinL = [0.6 * fall, 0, 0];
      p.rot.head = [-0.4 * fall, 0.4 * fall, 0];
    },
  };

  const talk: Clip = {
    loop: true,
    duration: 1,
    fade: 0.3,
    sample(t, p) {
      idle.sample(t, p);
      p.rot.armL = [-0.6 + Math.sin(t * 3) * 0.2, 0, 0.3];
      p.rot.foreL = [-0.8, 0, 0];
      p.rot.head = [p.rot.head[0] + Math.sin(t * 5) * 0.04, 0, 0];
    },
  };

  // boss specific
  const slamDur = 1.4;
  const slam: Clip = {
    loop: false,
    duration: slamDur,
    strikeAt: 0.78,
    next: 'idle',
    fade: 0.1,
    sample(t, p) {
      base(p);
      const u = t / slamDur;
      const raise = keys(u, [[0, 0], [0.6, 1], [0.78, -0.2], [0.9, -0.2], [1, 0]]);
      p.rot.armL = [-0.3 - 2.6 * Math.max(0, raise) + Math.min(0, raise) * -0.5, 0, 0.2];
      p.rot.armR = [-0.3 - 2.6 * Math.max(0, raise) + Math.min(0, raise) * -0.5, 0, -0.2];
      p.rot.foreL = [-0.4, 0, 0];
      p.rot.foreR = [-0.4, 0, 0];
      const bend = keys(u, [[0, 0], [0.6, -0.25], [0.78, 0.55], [0.9, 0.55], [1, 0]]);
      p.rot.spine = [s.hunch + bend, 0, 0];
      p.bodyY = keys(u, [[0, 0], [0.6, 0.1], [0.78, -0.35], [0.9, -0.35], [1, 0]]);
      p.rot.legL = [-0.5 * Math.max(0, bend), 0, 0];
      p.rot.shinL = [0.8 * Math.max(0, bend), 0, 0];
      p.rot.legR = [0.3 * Math.max(0, bend), 0, 0];
    },
  };

  const sweepDur = 1.0;
  const sweep: Clip = {
    loop: false,
    duration: sweepDur,
    strikeAt: 0.72,
    next: 'idle',
    fade: 0.08,
    sample(t, p) {
      base(p);
      const u = t / sweepDur;
      const twist = keys(u, [[0, 0], [0.6, 1.1], [0.78, -1.0], [0.9, -1.0], [1, 0]]);
      p.rot.chest = [0.1, twist, 0];
      p.rot.armR = [-1.5, 0, -0.3 - Math.max(0, -twist) * 0.3];
      p.rot.armL = [-1.4, 0, 0.3];
      p.rot.foreR = [-0.2, 0, 0];
      p.rot.foreL = [-0.5, 0, 0];
      p.bodyY = -Math.abs(twist) * 0.1;
    },
  };

  const roar: Clip = {
    loop: false,
    duration: 1.6,
    strikeAt: 0.4,
    next: 'idle',
    fade: 0.15,
    sample(t, p) {
      base(p);
      const u = t / 1.6;
      const k = keys(u, [[0, 0], [0.3, 1], [0.85, 1], [1, 0]]);
      const shake = Math.sin(t * 40) * 0.04 * k;
      p.rot.spine = [s.hunch - 0.45 * k, 0, 0];
      p.rot.head = [-0.5 * k + shake, 0, 0];
      p.rot.armL = [-0.5 * k, 0, 1.1 * k];
      p.rot.armR = [-0.5 * k, 0, -1.1 * k];
      p.rot.foreL = [-1.2 * k, 0, 0];
      p.rot.foreR = [-1.2 * k, 0, 0];
    },
  };

  return { idle, walk, attack, cast, charge, shoot, hit, die, talk, slam, sweep, roar };
}

// ---------------------------------------------------------------- quadruped clips

export function houndClips(): ClipSet {
  const idle: Clip = {
    loop: true,
    duration: 1,
    fade: 0.2,
    sample(t, p) {
      const br = Math.sin(t * 6);
      p.rot.neck = [0.1 + br * 0.03, 0, 0];
      p.rot.jaw = [0.15 + Math.max(0, br) * 0.15, 0, 0];
      p.rot.tail = [-0.3, Math.sin(t * 2) * 0.3, 0];
      p.bodyY = br * 0.01;
    },
  };
  const walk: Clip = {
    loop: true,
    duration: 1,
    fade: 0.1,
    sample(t, p) {
      const ph = t * Math.PI * 2 * 2.4;
      const a = Math.sin(ph);
      const b = Math.sin(ph + Math.PI * 0.6);
      p.rot.fl = [-a * 0.8, 0, 0];
      p.rot.fr = [-b * 0.8, 0, 0];
      p.rot.bl = [b * 0.8, 0, 0];
      p.rot.br = [a * 0.8, 0, 0];
      p.rot.fl2 = [Math.max(0, a) * -0.8, 0, 0];
      p.rot.fr2 = [Math.max(0, b) * -0.8, 0, 0];
      p.rot.bl2 = [Math.max(0, -b) * 0.8, 0, 0];
      p.rot.br2 = [Math.max(0, -a) * 0.8, 0, 0];
      p.rot.spine = [Math.sin(ph * 2) * 0.06, 0, 0];
      p.rot.neck = [0.25 + Math.sin(ph * 2) * 0.08, 0, 0];
      p.rot.jaw = [0.35, 0, 0];
      p.rot.tail = [0.2, Math.sin(ph) * 0.4, 0];
      p.bodyY = Math.abs(Math.sin(ph)) * 0.08;
    },
  };
  const attack: Clip = {
    loop: false,
    duration: 0.45,
    strikeAt: 0.5,
    next: 'idle',
    fade: 0.04,
    sample(t, p) {
      const u = t / 0.45;
      const lunge = keys(u, [[0, 0], [0.35, -0.4], [0.55, 1], [1, 0]]);
      p.bodyZ = lunge * 0.5;
      p.bodyRotX = -Math.max(0, -lunge) * 0.2 + Math.max(0, lunge) * 0.1;
      p.rot.neck = [0.1 + lunge * 0.3, 0, 0];
      p.rot.jaw = [Math.max(0, keys(u, [[0, 0.1], [0.4, 0.9], [0.55, 0], [1, 0.2]])), 0, 0];
      p.rot.fl = [-lunge * 0.9, 0, 0];
      p.rot.fr = [-lunge * 0.9, 0, 0];
      p.rot.bl = [lunge * 0.6, 0, 0];
      p.rot.br = [lunge * 0.6, 0, 0];
    },
  };
  const hit: Clip = {
    loop: false,
    duration: 0.22,
    next: 'idle',
    fade: 0.03,
    sample(t, p) {
      const k = keys(t / 0.22, [[0, 0], [0.3, 1], [1, 0]]);
      p.bodyZ = -0.15 * k;
      p.bodyRotZ = 0.2 * k;
      p.rot.neck = [-0.3 * k, 0, 0];
    },
  };
  const die: Clip = {
    loop: false,
    duration: 0.7,
    fade: 0.04,
    sample(t, p) {
      const k = keys(t / 0.7, [[0, 0], [0.7, 1], [1, 1]], ease.inCubic);
      p.bodyRotZ = k * (Math.PI / 2);
      p.bodyY = -k * 0.15;
      p.rot.fl = [-0.5 * k, 0, 0];
      p.rot.fr = [-0.3 * k, 0, 0];
      p.rot.neck = [0.3 * k, 0, 0];
      p.rot.jaw = [0.6 * k, 0, 0];
    },
  };
  return { idle, walk, attack, hit, die };
}
