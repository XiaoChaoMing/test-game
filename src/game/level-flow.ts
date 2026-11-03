import { t } from '../data/strings';
import { dist } from '../logic/vec';
import type { LevelScene } from '../scenes/level';
import type { Actor } from './actor';

/** Map-specific scripting: triggers, tutorial hooks, gates, checkpoints, boss start, exits. */
export class LevelFlow {
  private inside = new Set<string>();
  private talkedOnce = false;
  private novaUnlocked = false;
  private gateToastCd = 0;
  private exiting = false;
  private bossIntroDone = false;
  private activeCheckpoint: string;

  constructor(private readonly lvl: LevelScene) {
    const w = lvl.world;
    this.activeCheckpoint = lvl.def.checkpoints[0]?.id ?? '';
    this.novaUnlocked = lvl.ps.mapIndex >= 2;
    lvl.disposersPush(w.bus.on('killed', ({ actor }) => this.onKilled(actor)));
    lvl.disposersPush(w.bus.on('talk', ({ npc }) => void this.onTalk(npc)));
    lvl.disposersPush(w.bus.on('bossDefeated', () => lvl.timers.after(4.1, () => lvl.hooks.onFinish())));
    // gates already open from an earlier visit? (graveyard cleared is a tutorial fact)
    if (lvl.def.id === 'emberfall' && this.groupAlive('graveyard') === 0) this.openCryptGate(false);
  }

  private groupAlive(group: string): number {
    return this.lvl.world.actors.filter((a) => a.kind === 'enemy' && a.group === group && a.alive).length;
  }

  private onKilled(actor: Actor): void {
    if (actor.kind !== 'enemy' || !actor.group) return;
    const g = actor.group;
    if (g === 'adds' || g === 'boss') return;
    if (this.groupAlive(g) === 0) {
      this.lvl.tutorial.handle({ type: 'groupCleared', group: g });
      if (g === 'graveyard') this.openCryptGate(true);
    }
  }

  private openCryptGate(announce: boolean): void {
    const lvl = this.lvl;
    lvl.map.setGateOpen('crypt', true);
    if (!announce) return;
    lvl.hud.toast(t('hud.gate.open'), 3);
    lvl.fx.pillar(35.5, 3.5, 0x7fd4ff, 8, 2, 1.4);
    lvl.world.particles.emit('soul', { x: 35.5, y: 1.5, z: 3.6 }, 50);
    lvl.world.camera.shake(0.3, 0.6);
  }

  private async onTalk(npc: Actor): Promise<void> {
    if (npc.def !== 'elder') return;
    const lvl = this.lvl;
    const elder = t('npc.elder');
    npc.view.play('talk');
    if (!this.talkedOnce) {
      await lvl.dialogue.show([
        { speaker: elder, text: t('dlg.elder.1') },
        { speaker: elder, text: t('dlg.elder.2') },
        { speaker: elder, text: t('dlg.elder.3') },
        { speaker: elder, text: t('dlg.elder.4') },
        { speaker: t('player.name'), text: t('dlg.player.1') },
        { speaker: elder, text: t('dlg.elder.5') },
      ]);
      this.talkedOnce = true;
      lvl.tutorial.handle({ type: 'talkedElder' });
    } else {
      await lvl.dialogue.show([{ speaker: elder, text: t(this.lvl.map.isGateOpen('crypt') ? 'dlg.elder.5' : 'dlg.elder.4') }]);
    }
    npc.view.play('idle');
  }

  private onTrigger(id: string): void {
    const lvl = this.lvl;
    switch (id) {
      case 'elder':
        lvl.tutorial.handle({ type: 'reachedElder' });
        break;
      case 'gate-approach':
        if (!lvl.map.isGateOpen('crypt') && this.gateToastCd <= 0) {
          lvl.hud.toast(t('hud.gate.locked'), 2.5);
          this.gateToastCd = 5;
        }
        break;
      case 'exit':
        if (lvl.map.isGateOpen('crypt') && !this.exiting) {
          this.exiting = true;
          lvl.playerCtl.enabled = false;
          lvl.hooks.onExit('crypt');
        }
        break;
      case 'altar':
        if (!this.novaUnlocked) void this.unlockNova();
        break;
      case 'boss-room':
        void this.startBoss();
        break;
    }
  }

  private async unlockNova(): Promise<void> {
    const lvl = this.lvl;
    this.novaUnlocked = true;
    const p = lvl.world.player;
    lvl.fx.pillar(p.pos.x, p.pos.z, 0xff8a3a, 8, 2.2, 1.0);
    lvl.world.particles.emit('ember', { x: 51.5, y: 1.4, z: 25 }, 60);
    lvl.playerCtl.cancel();
    await lvl.dialogue.show([{ speaker: t('player.name'), text: t('dlg.altar.1') }]);
    lvl.ps.mapIndex = 2;
    lvl.ps.fury.gain(40);
    lvl.hud.toast(t('hud.nova.unlock'), 3.5);
  }

  private async startBoss(): Promise<void> {
    const lvl = this.lvl;
    const boss = lvl.boss;
    if (!boss || boss.active || boss.defeated) return;
    lvl.map.setGateOpen('boss-door', false);
    lvl.playerCtl.cancel();
    if (!this.bossIntroDone) {
      this.bossIntroDone = true;
      const name = t('enemy.warden');
      boss.start();
      await lvl.dialogue.show([
        { speaker: name, text: t('dlg.boss.1') },
        { speaker: name, text: t('dlg.boss.2') },
      ]);
    } else {
      boss.start();
    }
  }

  onRespawn(): void {
    this.inside.clear();
    if (this.lvl.def.id === 'crypt') this.lvl.map.setGateOpen('boss-door', true);
  }

  update(dt: number): void {
    const lvl = this.lvl;
    const p = lvl.world.player;
    this.gateToastCd = Math.max(0, this.gateToastCd - dt);
    if (!p.alive) return;
    for (const tr of lvl.def.triggers) {
      const inside = dist(p.pos, tr) <= tr.radius;
      if (inside && !this.inside.has(tr.id)) {
        this.inside.add(tr.id);
        lvl.world.bus.emit('trigger', { id: tr.id });
        this.onTrigger(tr.id);
      } else if (!inside) this.inside.delete(tr.id);
    }
    for (const cp of lvl.def.checkpoints) {
      if (cp.id === this.activeCheckpoint) continue;
      if (dist(p.pos, cp) < 2.5) {
        const idx = lvl.def.checkpoints.findIndex((c) => c.id === cp.id);
        const cur = lvl.def.checkpoints.findIndex((c) => c.id === this.activeCheckpoint);
        if (idx > cur) {
          this.activeCheckpoint = cp.id;
          lvl.checkpoint = { x: cp.x, z: cp.z };
          lvl.hud.toast(t('hud.checkpoint'), 1.8);
          lvl.world.particles.emit('ember', { x: cp.x, y: 0.4, z: cp.z }, 20);
        }
      }
    }
  }
}
