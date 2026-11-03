import * as THREE from 'three';
import type { GameContext, Scene } from './scene';
import type { MapDef } from '../data/maps/types';
import { PLAYER_BASE } from '../data/player';
import { SKILLS, type SkillId } from '../data/skills';
import { t } from '../data/strings';
import { canUseSkill } from '../logic/combat';
import { xpToNext } from '../logic/progression';
import { EnemyBrain } from '../logic/ai';
import { dist, type Vec2 } from '../logic/vec';
import type { Tutorial } from '../logic/tutorial';
import { QUALITY_PRESETS } from '../render/renderer';
import { GameTimers } from '../core/timers';
import { disposeObject } from '../render/dispose';
import { LightPool, MoonLight } from '../render/lighting';
import { Particles } from '../render/vfx/particles';
import { Fx } from '../render/vfx/fx';
import { buildCharacter } from '../render/characters/builders';
import { loadMap, type LoadedMap } from '../game/map-loader';
import { World } from '../game/world';
import { Actor } from '../game/actor';
import { CombatSystem } from '../game/combat-system';
import { Projectiles } from '../game/projectiles';
import { SkillsSystem } from '../game/skills-system';
import { EnemyController, spawnEnemy } from '../game/enemy-controller';
import { BossController } from '../game/boss-controller';
import { Pickups } from '../game/pickups';
import { PlayerController } from '../game/player-controller';
import type { PlayerState } from '../game/player-state';
import { LevelFlow } from '../game/level-flow';
import { Hud } from '../ui/hud';
import { FloatingText } from '../ui/floating-text';
import { Dialogue } from '../ui/dialogue';
import { TutorialPanel } from '../ui/tutorial-panel';

const VIEW_HEIGHT = 17;
const RESPAWN_DELAY = 3.2;

export type LevelHooks = {
  onExit(next: 'crypt'): void;
  onFinish(): void;
};

export class LevelScene implements Scene {
  root = new THREE.Group();
  readonly timers = new GameTimers();
  world!: World;
  map!: LoadedMap;
  combat!: CombatSystem;
  skills!: SkillsSystem;
  projectiles!: Projectiles;
  enemyCtl!: EnemyController;
  boss: BossController | null = null;
  pickups!: Pickups;
  playerCtl!: PlayerController;
  flow!: LevelFlow;
  hud!: Hud;
  floaters!: FloatingText;
  dialogue!: Dialogue;
  tutPanel!: TutorialPanel;
  particles!: Particles;
  fx!: Fx;
  lights!: LightPool;
  moon!: MoonLight;
  private hemi!: THREE.HemisphereLight;
  private playerLight!: THREE.PointLight;
  private elderNameplate: HTMLElement | null = null;
  private disposers: (() => void)[] = [];
  /** used by LevelFlow to register bus subscriptions for cleanup */
  disposersPush(d: () => void): void {
    this.disposers.push(d);
  }
  private deathTimer = -1;
  checkpoint: Vec2;
  private focus = new THREE.Vector3();
  private lastHovered: Actor | null = null;
  private time = 0;

  constructor(
    private readonly ctx: GameContext,
    readonly def: MapDef,
    readonly ps: PlayerState,
    readonly tutorial: Tutorial,
    readonly hooks: LevelHooks,
  ) {
    this.checkpoint = { ...def.playerStart };
  }

  enter(): void {
    const { gr, camera } = this.ctx;
    const amb = this.def.ambience;
    const scene = gr.scene;
    scene.background = new THREE.Color(amb.background);
    scene.fog = new THREE.Fog(amb.fog, amb.fogNear, amb.fogFar);
    scene.add(this.root);
    this.hemi = new THREE.HemisphereLight(amb.hemiSky, amb.hemiGround, amb.hemiIntensity);
    this.root.add(this.hemi);
    const preset = QUALITY_PRESETS[gr.quality];
    this.moon = new MoonLight(this.root, amb.moon, amb.moonIntensity, preset.shadowMap);
    this.lights = new LightPool(this.root, preset.maxLights);
    this.particles = new Particles(this.root, 4000);
    this.particles.scale = preset.particleScale;
    this.fx = new Fx(this.root);
    if (amb.ash) this.particles.setAmbient('ash', 70, 22, 14);
    if (amb.dust) this.particles.setAmbient('mote', 25, 18, 4);

    this.map = loadMap(this.def, this.root, this.lights, this.particles);
    this.world = new World(this.root, this.map.grid, camera, this.particles, this.lights);
    if (this.def.id === 'crypt') this.map.setGateOpen('boss-door', true);

    // player
    const pview = buildCharacter('wanderer');
    const stats = this.ps.stats;
    const player = new Actor('player', 'wanderer', pview, this.def.playerStart, { radius: PLAYER_BASE.radius, maxHp: stats.maxHp, name: t('player.name') });
    player.damage = stats.damage;
    player.armor = PLAYER_BASE.armor;
    player.moveSpeed = PLAYER_BASE.moveSpeed;
    pview.setFacing(this.def.playerFacing, true);
    this.world.player = player;
    this.world.add(player);
    this.playerLight = new THREE.PointLight(0xff9a50, 6, 7, 1.6);
    this.root.add(this.playerLight);

    // npcs
    for (const n of this.def.npcs) {
      const v = buildCharacter('elder');
      const a = new Actor('npc', n.id, v, { x: n.x, z: n.z }, { radius: 0.5, maxHp: 1, name: t('npc.elder') });
      v.setFacing(n.facing, true);
      this.world.add(a);
      this.world.grid.setBlocked(Math.floor(n.x), Math.floor(n.z), true);
      this.lights.register({ x: n.x, y: 1.8, z: n.z, color: 0xffa050, intensity: 6, distance: 5, flicker: true });
      this.elderNameplate = document.createElement('div');
      this.elderNameplate.className = 'nameplate';
      this.elderNameplate.textContent = t('npc.elder');
    }

    // systems
    this.combat = new CombatSystem(this.world, this.ps);
    this.projectiles = new Projectiles(this.world, this.combat);
    this.skills = new SkillsSystem(this.world, this.combat, this.ps, this.fx);
    this.enemyCtl = new EnemyController(this.world, this.combat, this.projectiles, this.fx);
    this.pickups = new Pickups(this.world, this.ps);
    this.playerCtl = new PlayerController(this.world, this.ctx.input, this.combat, this.skills, this.fx);
    for (const s of this.def.spawns) {
      const e = spawnEnemy(this.world, s.enemy, { x: s.x, z: s.z }, { group: s.group, aggro: s.aggro, facing: s.facing });
      if (s.enemy === 'warden') this.boss = new BossController(this.world, this.combat, this.fx, e);
    }

    // ui
    this.hud = new Hud(this.ctx.ui);
    this.floaters = new FloatingText(this.hud.floaters, camera.camera);
    this.dialogue = new Dialogue(this.ctx.ui);
    this.tutPanel = new TutorialPanel(this.ctx.ui);
    if (this.elderNameplate) this.hud.floaters.appendChild(this.elderNameplate);
    this.flow = new LevelFlow(this);
    this.wireEvents();

    camera.snapTo(new THREE.Vector3(player.pos.x, 0, player.pos.z));
    camera.setZoom(1.15, true);
    this.hud.showMapTitle(t(this.def.nameKey));
    this.applyQuality();
    this.disposers.push(this.ctx.gr.onQualityChange(() => this.applyQuality()));
  }

  private applyQuality(): void {
    const p = QUALITY_PRESETS[this.ctx.gr.quality];
    this.lights.setMax(p.maxLights);
    this.moon.setShadowSize(p.shadowMap);
    this.particles.scale = p.particleScale;
  }

  private wireEvents(): void {
    const bus = this.world.bus;
    const on = <K extends Parameters<typeof bus.on>[0]>(k: K, fn: Parameters<typeof bus.on<K>>[1]) => this.disposers.push(bus.on(k, fn));
    on('damaged', ({ actor, amount, crit }) => {
      const pos = new THREE.Vector3(actor.pos.x, actor.height + 0.2, actor.pos.z);
      this.floaters.spawn(String(amount), pos, actor.kind === 'player' ? 'player' : crit ? 'crit' : '', crit ? 1.1 : 0.85);
    });
    on('killed', ({ actor }) => {
      if (actor.kind === 'enemy' && actor.enemyDef && !actor.summoned && Math.random() < actor.enemyDef.potionDropChance) this.pickups.dropPotion(actor.pos);
    });
    on('xp', ({ amount }) => this.floaters.spawn(`+${amount} XP`, this.world.headPosition(this.world.player, 0.6), 'xp', 1.2));
    on('levelUp', ({ level }) => {
      this.hud.toast(t('hud.levelup', { n: level }));
      this.fx.pillar(this.world.player.pos.x, this.world.player.pos.z, 0xffd080, 7, 1.4, 0.9);
    });
    on('skillDenied', ({ id, reason }) => {
      const key = reason === 'empty' ? 'hud.potion.empty' : reason === 'full' ? 'hud.potion.full' : `hud.denied.${reason}`;
      this.hud.flashDenied(id, t(key));
    });
    on('skillUsed', ({ id }) => {
      this.hud.flashUsed(id);
      this.tutorial.handle({ type: 'skillUsed', skill: id });
    });
    on('potionUsed', () => {
      this.hud.flashUsed('potion');
      this.tutorial.handle({ type: 'potionUsed' });
      this.floaters.spawn(`+${Math.round(this.world.player.maxHp * PLAYER_BASE.potionHealRatio)}`, this.world.headPosition(this.world.player), 'heal');
    });
    on('pickup', () => this.floaters.spawn(t('hud.potion.pickup'), this.world.headPosition(this.world.player, 0.5), 'heal', 1.2));
    on('hpChanged', ({ ratio }) => this.tutorial.handle({ type: 'hpChanged', ratio }));
    on('playerDied', () => {
      this.ps.deaths++;
      this.deathTimer = 0;
      this.playerCtl.reset();
      this.skills.reset();
    });
  }

  /** respawn at the active checkpoint; enemies still alive reset, the boss resets */
  respawn(): void {
    const w = this.world;
    const p = w.player;
    p.pos = { ...this.checkpoint };
    p.hp = p.maxHp;
    p.alive = true;
    p.knock = { x: 0, z: 0 };
    p.burn = null;
    p.view.root.position.y = 0;
    p.view.play('idle', 1, true);
    this.playerCtl.reset();
    this.skills.reset();
    this.ps.fury.value = 0;
    this.ps.cooldowns.reset();
    this.ps.inCombatTimer = 0;
    for (const e of [...w.actors]) {
      if (e.kind !== 'enemy' || !e.alive) continue;
      if (e.summoned) {
        w.remove(e);
        continue;
      }
      if (e.def === 'warden') continue;
      e.pos = { ...e.spawn };
      e.hp = e.maxHp;
      e.path = [];
      e.burn = null;
      e.brain = new EnemyBrain(e.enemyDef!);
      e.view.play('idle', 1, true);
    }
    this.boss?.reset();
    this.flow.onRespawn();
    this.projectiles.clear();
    this.hud.showDeath(false);
    this.ctx.camera.snapTo(new THREE.Vector3(p.pos.x, 0, p.pos.z));
    w.particles.emit('ember', { x: p.pos.x, y: 0.5, z: p.pos.z }, 30);
    this.fx.pillar(p.pos.x, p.pos.z, 0xff9a50, 5, 1.2, 0.7);
    w.bus.emit('hpChanged', { ratio: 1 });
  }

  update(dt: number): void {
    const { input, camera } = this.ctx;
    this.time += dt;
    const w = this.world;
    this.hud.update(dt);
    this.dialogue.update(dt);

    if (this.dialogue.open) {
      if (input.keyPressed('Space') || input.keyPressed('Enter') || input.keyPressed('Escape') || input.leftPressed) this.dialogue.advance();
      input.consumeClick();
      this.animateOnly(dt);
      return;
    }
    if (w.paused) {
      this.animateOnly(0);
      return;
    }

    const sdt = dt * w.timeScale(dt);
    w.time += sdt;
    this.timers.update(dt);
    this.ps.playTime += dt;
    this.ps.inCombatTimer = Math.max(0, this.ps.inCombatTimer - sdt);
    this.ps.fury.tick(sdt, this.ps.inCombat);
    this.ps.cooldowns.tick(sdt);

    if (input.wheel) camera.zoomBy(input.wheel);

    this.playerCtl.update(sdt);
    this.skills.update(sdt);
    this.enemyCtl.update(sdt);
    this.boss?.update(sdt);
    this.boss?.animateAdds(sdt);
    this.combat.update(sdt);
    this.projectiles.update(sdt);
    this.pickups.update(sdt);
    this.flow.update(sdt);

    if (this.deathTimer >= 0) {
      this.deathTimer += dt;
      if (this.deathTimer > 1.0) this.hud.showDeath(true);
      if (this.deathTimer > RESPAWN_DELAY) {
        this.deathTimer = -1;
        this.respawn();
      }
    }
    this.animateOnly(sdt);
    this.updateHud();
  }

  /** visual-only updates (also while paused/dialogue so the world keeps breathing) */
  private animateOnly(dt: number): void {
    const w = this.world;
    const { camera, gr } = this.ctx;
    for (const a of w.actors) {
      a.syncView();
      a.view.update(dt);
    }
    const p = w.player;
    this.focus.set(p.pos.x, 0, p.pos.z);
    camera.follow(this.focus, Math.max(dt, 1 / 120));
    this.playerLight.position.set(p.pos.x, 2.4, p.pos.z);
    this.lights.update(camera.focus, this.time);
    this.moon.update(camera.focus);
    const pxPerUnit = gr.renderer.domElement.height / (VIEW_HEIGHT / camera.camera.zoom);
    this.particles.setPixelScale(pxPerUnit);
    this.particles.update(dt, camera.focus);
    this.fx.update(dt);
    this.map.update(dt, this.time);
    const cw = this.ctx.canvas.clientWidth;
    const ch = this.ctx.canvas.clientHeight;
    this.floaters.update(dt, cw, ch);
    if (this.elderNameplate) {
      const npc = w.actors.find((a) => a.kind === 'npc');
      if (npc) {
        const v = new THREE.Vector3(npc.pos.x, npc.height + 0.5, npc.pos.z).project(camera.camera);
        const near = dist(npc.pos, p.pos) < 12;
        this.elderNameplate.style.display = near ? 'block' : 'none';
        this.elderNameplate.style.left = `${(v.x * 0.5 + 0.5) * cw}px`;
        this.elderNameplate.style.top = `${(-v.y * 0.5 + 0.5) * ch}px`;
      }
    }
  }

  private updateHud(): void {
    const p = this.world.player;
    const ps = this.ps;
    this.hud.setHp(p.hp, p.maxHp);
    this.hud.setFury(ps.fury.value, ps.fury.max);
    this.hud.setXp(ps.level >= 5 ? 1 : ps.xp / xpToNext(ps.level), ps.level);
    this.hud.setPotions(ps.potions);
    for (const id of ['cleave', 'charge', 'nova'] as SkillId[]) {
      const def = SKILLS[id];
      const check = canUseSkill(def, ps.fury.value, ps.cooldowns, ps.mapIndex);
      this.hud.setSkill(id, { cdRatio: ps.cooldowns.ratio(id), cdLeft: ps.cooldowns.remaining(id), usable: check === 'ok', locked: check === 'locked' });
    }
    this.hud.setSkill('potion', { cdRatio: 0, cdLeft: 0, usable: ps.potions > 0, locked: false });
    this.hud.setSkill('basic', { cdRatio: 0, cdLeft: 0, usable: true, locked: false });
    // hover target
    const h = this.playerCtl.hovered;
    if (h !== this.lastHovered) {
      if (this.lastHovered && !this.lastHovered.removed && this.lastHovered.def !== 'warden') this.lastHovered.view.rig.setTint(0, 0);
      if (h && h.kind === 'enemy' && h.def !== 'warden') h.view.rig.setTint(0xff5030, 0.25);
      this.lastHovered = h;
      this.ctx.canvas.style.cursor = h?.kind === 'enemy' ? 'crosshair' : h?.kind === 'npc' ? 'help' : 'default';
    }
    const target = h && h.kind === 'enemy' && h.alive ? h : this.playerCtl.intent.kind === 'attack' && this.playerCtl.intent.target.alive ? this.playerCtl.intent.target : null;
    if (target && target.def !== 'warden') this.hud.setTarget(target.name, target.hpRatio);
    else this.hud.setTarget(null);
    if (this.boss && (this.boss.active || (this.boss.boss.alive === false && !this.boss.defeated))) {
      const b = this.boss.boss;
      this.hud.setBoss(b.name, b.hpRatio, (b.brain as { enraged?: boolean }).enraged ?? false);
    } else this.hud.setBoss(null);
    this.tutPanel.set(this.def.index === 1 ? this.tutorial.hint() : null);
  }

  render(): void {
    this.ctx.gr.render(this.ctx.camera.camera);
  }

  exit(): void {
    this.timers.clear();
    for (const d of this.disposers) d();
    this.world.bus.clear();
    this.map.dispose();
    this.lights.dispose();
    this.particles.dispose();
    this.fx.clear();
    this.projectiles.clear();
    this.pickups.clear();
    for (const a of [...this.world.actors]) this.world.remove(a);
    this.moon.dispose();
    disposeObject(this.root);
    this.ctx.gr.scene.remove(this.root);
    this.hud.dispose();
    this.floaters.clear();
    this.dialogue.dispose();
    this.tutPanel.dispose();
    this.elderNameplate?.remove();
    this.ctx.canvas.style.cursor = 'default';
  }
}
