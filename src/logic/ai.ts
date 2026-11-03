import type { EnemyDef } from '../data/enemies';
import { dist, norm, sub, type Vec2 } from './vec';

export type AiState = 'idle' | 'chase' | 'windup' | 'recover' | 'retreat' | 'return' | 'dead';

export type AiInput = { dt: number; self: Vec2; target: Vec2; targetAlive: boolean; hasLos: boolean; home?: Vec2 };

export type AiCommand = { move?: Vec2; face?: Vec2; startWindup?: boolean; strike?: boolean };

const ALERT_TIME = 6;
const KITE_LIMIT = 1.2;
const EPS = 1e-6;

export class EnemyBrain {
  state: AiState = 'idle';
  private timer = 0;
  private alert = 0;
  private kite = 0;

  constructor(readonly def: EnemyDef) {}

  onHit(): void {
    this.alert = ALERT_TIME;
  }

  kill(): void {
    this.state = 'dead';
  }

  update(i: AiInput): AiCommand {
    if (this.state === 'dead') return {};
    this.alert = Math.max(0, this.alert - i.dt);
    if (!i.targetAlive) {
      this.state = 'idle';
      return {};
    }
    const d = dist(i.self, i.target);
    const leash = Math.max(this.def.aggroRange * 2.5, 20);

    switch (this.state) {
      case 'idle':
        if (d <= this.def.aggroRange || this.alert > 0) {
          this.state = 'chase';
          return this.chase(i, d);
        }
        return {};
      case 'chase':
        if (d > leash && this.alert <= 0) {
          if (!i.home) {
            this.state = 'idle';
            return {};
          }
          this.state = 'return';
          return { move: i.home };
        }
        return this.chase(i, d);
      case 'return':
        if (!i.home || dist(i.self, i.home) < 0.6) {
          this.state = 'idle';
          return {};
        }
        if (this.alert > 0) {
          this.state = 'chase';
          return this.chase(i, d);
        }
        return { move: i.home };
      case 'windup':
        this.timer += i.dt;
        if (this.timer >= this.def.windup - EPS) {
          this.state = 'recover';
          this.timer = 0;
          return { strike: true, face: i.target };
        }
        return { face: this.def.ranged ? i.target : undefined };
      case 'recover':
        this.timer += i.dt;
        if (this.timer >= this.def.recover - EPS) {
          this.timer = 0;
          this.state = this.def.retreatAfterAttack ? 'retreat' : 'chase';
        }
        return {};
      case 'retreat': {
        this.timer += i.dt;
        if (this.timer >= (this.def.retreatAfterAttack ?? 0) - EPS) {
          this.timer = 0;
          this.state = 'chase';
          return {};
        }
        return { move: this.awayFrom(i.self, i.target, 4) };
      }
      default:
        return {};
    }
  }

  private chase(i: AiInput, d: number): AiCommand {
    const ranged = this.def.ranged;
    if (ranged) {
      if (d < ranged.preferredRange - 2 && this.kite < KITE_LIMIT) {
        this.kite += i.dt;
        return { move: this.awayFrom(i.self, i.target, 3), face: i.target };
      }
      if (d <= this.def.attackRange && i.hasLos) return this.beginWindup(i);
      return { move: i.target };
    }
    if (d <= this.def.attackRange) return this.beginWindup(i);
    return { move: i.target };
  }

  private beginWindup(i: AiInput): AiCommand {
    this.state = 'windup';
    this.timer = 0;
    this.kite = 0;
    return { startWindup: true, face: i.target };
  }

  private awayFrom(self: Vec2, target: Vec2, distance: number): Vec2 {
    const dir = norm(sub(self, target));
    const d = dir.x === 0 && dir.z === 0 ? { x: 1, z: 0 } : dir;
    return { x: self.x + d.x * distance, z: self.z + d.z * distance };
  }
}
