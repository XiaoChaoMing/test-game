# Ashfall Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable web demo of the isometric dark-fantasy ARPG "Ashfall": title, intro cinematic, tutorial map (Emberfall), crypt map with boss, and an end screen.

**Architecture:** Game rules live in `src/logic/` as plain TypeScript with no `three` import, so they can be unit-tested. `src/render/` builds every mesh, rig, light and VFX procedurally. `src/game/` connects the two: it owns the actors, runs controllers, and keeps the views in sync. `src/ui/` is an HTML/CSS overlay. All content (stats, skills, enemies, maps, Vietnamese text) lives in `src/data/`.

**Tech Stack:** TypeScript 5, three (r17x, official addons only), Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-ashfall-demo-design.md`

## Global Constraints

- Runtime deps: only `three`. Dev deps: `vite`, `typescript`, `vitest`, `@types/three`.
- No external 3D models or textures. Everything is procedural. Fonts from Google Fonts are allowed: Cormorant Garamond for titles and narration, Noto Serif for body text. Both must render Vietnamese diacritics.
- All player-facing text is Vietnamese and lives in `src/data/strings.ts`.
- Camera: `OrthographicCamera`, yaw 45°, pitch ≈35°, smoothed follow, wheel zoom clamped to 0.75×–1.4×.
- Quality presets:
  - **High** (default): pixelRatio ≤2, bloom on, shadow map 2048, max 6 active PointLights, full particles.
  - **Low**: pixelRatio 1, no bloom, shadow map 1024, max 3 lights, half particles.
- Target ~60fps on an Apple Silicon MacBook at the High preset.
- Skills:
  - Cleave: 20 Fury.
  - Charge: 15 Fury, 6s cooldown.
  - Ember Nova: 40 Fury, 12s cooldown, unlocked on map 2.
  - Potion: heals 40% max HP.
- Max level 5. Boss enrages below 50% HP.
- Intro lasts 60–90s and can be skipped with Space or Esc. Esc also opens the pause menu (quality setting, tutorial toggle).
- Logic modules must not import `three`.

## Review Focus

1. **Click on a wall, prop or outside the map** → the player walks to the nearest walkable cell, never freezes or walks through. *(test in Task 2)*
2. **Tab hidden, then resumed (huge dt)** → dt is clamped to 0.1s and nothing teleports or takes burst damage. *(test in Task 1)*
3. **Skill pressed with too little Fury or still on cooldown** → nothing fires and the skill slot flashes red. **Charge aimed into a wall** → stops at the last walkable point. *(tests in Tasks 3 and 2)*
4. **Player dies mid-tutorial or mid-boss fight** → respawns at the checkpoint; tutorial progress is kept; the boss resets to full HP and its adds despawn. *(tests in Tasks 5 and 4)*
5. **Window resize or Retina DPI** → the camera frustum and mouse picking stay correct. *(test in Task 1)*

---

### Task 1: Scaffold, game loop, renderer and isometric camera

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/style.css`
- Create: `src/core/loop.ts`, `src/core/events.ts`, `src/core/rng.ts`
- Create: `src/render/renderer.ts`, `src/render/camera.ts`, `src/render/palette.ts`
- Test: `tests/core/loop.test.ts`, `tests/render/camera-math.test.ts`

**Interfaces:**
- Produces:
  - `createLoop(update: (dt: number) => void, render: (alpha: number) => void): { start(): void; stop(): void }`. Uses requestAnimationFrame; dt is in seconds, clamped to `MAX_DT = 0.1`; also exports `clampDt(raw: number): number`.
  - `class EventBus<E extends Record<string, unknown>>` with `on<K>(k, fn): () => void`, `emit<K>(k, payload)`.
  - `mulberry32(seed: number): () => number`.
  - `type Quality = 'high' | 'low'`.
  - `createRenderer(canvas: HTMLCanvasElement, quality: Quality): GameRenderer`, where `GameRenderer = { renderer: THREE.WebGLRenderer; scene: THREE.Scene; composer: EffectComposer; setQuality(q: Quality): void; resize(w: number, h: number): void; render(camera: THREE.Camera): void }`.
  - `class IsoCamera` with `camera: THREE.OrthographicCamera`, `follow(target: THREE.Vector3, dt: number)`, `zoomBy(delta: number)`, `shake(strength: number, duration: number)`, `resize(aspect: number)`, `screenToGround(ndcX: number, ndcY: number): {x: number; z: number} | null`.
  - Pure helper: `isoOffset(distance: number, yawDeg = 45, pitchDeg = 35): {x: number; y: number; z: number}`.
  - `PALETTE` color constants: ash, soil, ember, bone, crypt-blue, blood.

- [ ] **Step 1: Scaffold the project.** Run `npm create`-equivalent by hand: package scripts `dev`, `build`, `preview`, `test` (`vitest run`). Run `npm i three` and `npm i -D vite typescript vitest @types/three`. Set tsconfig to strict, with `moduleResolution: bundler`.
- [ ] **Step 2: Write failing tests.**
  - `clampDt(5) === 0.1`; `clampDt(0.016) === 0.016`; `clampDt(-1) === 0`.
  - `isoOffset(10)`: `y ≈ 10*sin(35°)`, `x ≈ z`, and the vector length is ≈10.
- [ ] **Step 3: Run `npx vitest run`.** Expected: FAIL (module not found).
- [ ] **Step 4: Implement the loop, events, rng, camera math, renderer and IsoCamera.** Renderer setup:
  - ACESFilmic tone mapping, SRGB output, PCFSoft shadows.
  - Composer chain: RenderPass → UnrealBloomPass (strength 0.6, threshold 0.85) → vignette ShaderPass → OutputPass.
  - `scene.fog = new THREE.Fog(…)`.
- [ ] **Step 5: Wire up `main.ts`.** Render a 40×40 ground plane with a test cube; the camera follows the cube. Resizing the window calls `resize`.
- [ ] **Step 6: Verify.**
  - `npx vitest run` → PASS.
  - `npm run dev` → screenshot shows a lit cube on the ground at the iso angle.
  - Resize the window → no stretching.

### Task 2: Navigation grid, A* pathfinding and collision

**Files:**
- Create: `src/logic/vec.ts`, `src/logic/grid.ts`, `src/logic/pathfinding.ts`, `src/logic/collision.ts`
- Test: `tests/logic/pathfinding.test.ts`, `tests/logic/collision.test.ts`

**Interfaces:**
- Produces:
  - `type Vec2 = { x: number; z: number }`, plus helpers `dist`, `sub`, `add`, `scale`, `norm`, `len`, `angleOf(v): number` (radians; `atan2(x, z)`).
  - `class NavGrid(width: number, height: number, cellSize: number, origin: Vec2)` with:
    - `setBlocked(cx, cz, b)`, `isWalkable(cx, cz)` (false when out of bounds)
    - `worldToCell(p: Vec2): {cx; cz}`, `cellToWorld(cx, cz): Vec2` (cell center)
    - `isWalkableWorld(p: Vec2)`, `nearestWalkable(cx, cz, maxRadius = 8): {cx; cz} | null`
  - `findPath(grid: NavGrid, from: Vec2, to: Vec2): Vec2[]` — world waypoints, excluding the start. If `to` is blocked, it targets `nearestWalkable` instead. Returns `[]` when unreachable.
  - `hasLineOfSight(grid, a: Vec2, b: Vec2): boolean`.
  - `moveWithCollision(grid, pos: Vec2, delta: Vec2, radius: number): Vec2` — slides along blocked cells.
  - `separate(a: Vec2, ra: number, b: Vec2, rb: number): Vec2` — push vector for `a`.
  - `castToWalkable(grid, from: Vec2, to: Vec2, radius: number): Vec2` — last free point along the segment (used by Charge).

- [ ] **Step 1: Write failing tests.**
  - `findPath` on an open 10×10 grid from (0.5,0.5) to (8.5,8.5) returns waypoints ending at (8.5,8.5). Smoothing gives ≤2 points.
  - With a wall at column x=5 for z=0..8, the path goes around it, and no waypoint segment crosses a blocked cell (check with `hasLineOfSight`).
  - Target inside a wall → the path ends at the nearest walkable cell center *(Review Focus 1)*.
  - Target outside the grid → nearest walkable cell inside the grid.
  - Fully enclosed target → `[]`.
  - Diagonal moves never cut a blocked corner.
  - `moveWithCollision` into a wall keeps the circle out of the blocked cell but keeps the tangential motion.
  - `castToWalkable` toward a wall stops before it *(Review Focus 3)*.
- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement.** A* on 8 directions with an octile heuristic and a binary-heap open list. Corner cutting is disallowed. Smoothing uses string-pulling with `hasLineOfSight` (Bresenham supercover over the cells). Collision tests the circle against the nearest cell AABBs and resolves along x and z separately.
- [ ] **Step 4: Run tests.** Expected: PASS.

### Task 3: Combat math, Fury, cooldowns and leveling

**Files:**
- Create: `src/logic/combat.ts`, `src/logic/progression.ts`, `src/data/player.ts`, `src/data/skills.ts`
- Test: `tests/logic/combat.test.ts`, `tests/logic/progression.test.ts`

**Interfaces:**
- Produces:
  - `type SkillId = 'basic' | 'cleave' | 'charge' | 'nova'`
  - `SKILLS: Record<SkillId, SkillDef>`, where `SkillDef = { id; nameKey: string; fury: number; cooldown: number; damageMult: number; range: number; arcDeg?: number; radius?: number; unlockMap: 1 | 2; slot: 0 | 1 | 2 | 3 }`. Values:
    - basic: fury 0, cooldown 0, ×1.0, range 1.6, generates +8 Fury on hit
    - cleave: 20, 0, ×1.4, range 2.4, arc 140°
    - charge: 15, 6, ×1.2, range 8
    - nova: 40, 12, ×2.0, radius 4.5, plus a burn of 25% weapon damage per second for 3s
  - `PLAYER_BASE = { maxHp: 120, damage: 14, armor: 2, attackInterval: 0.55, moveSpeed: 5.2, radius: 0.45, maxFury: 100, potions: 3, maxPotions: 5 }`
  - `computeDamage(base: number, mult: number, armor: number, rng: () => number): { amount: number; crit: boolean }` — ±10% variance, 8% crit chance ×1.6, minus armor, minimum 1, rounded.
  - `class FuryPool(max)` with `value`, `gain(n)`, `trySpend(n): boolean`, `tick(dt, inCombat: boolean)` (decays 6/s when out of combat for more than 3s).
  - `class Cooldowns` with `start(id, s)`, `ready(id): boolean`, `remaining(id): number`, `tick(dt)`.
  - `canUseSkill(def: SkillDef, fury: number, cds: Cooldowns, mapIndex: 1 | 2): 'ok' | 'fury' | 'cooldown' | 'locked'`.
  - `progression.ts`:
    - `MAX_LEVEL = 5`; `xpToNext(level) = 40 * level * level` (≥ MAX_LEVEL → Infinity)
    - `addXp(state: {level; xp}, gained): {level; xp; levelsGained}`
    - `statsForLevel(level): { maxHp; damage }` — each level adds +15% HP and +10% damage over level 1.

- [ ] **Step 1: Write failing tests.**
  - With a fixed rng, `computeDamage` is deterministic, never below 1, and crits when the rng returns < 0.08.
  - `trySpend(20)` with only 10 Fury → false and the value is unchanged.
  - Calling `canUseSkill` with insufficient Fury → `'fury'`; during cooldown → `'cooldown'`; nova on map 1 → `'locked'` *(Review Focus 3)*.
  - `addXp` that crosses two thresholds gives `levelsGained = 2`; it stops at level 5 and the XP stops growing.
- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement** to the signatures above.
- [ ] **Step 4: Run tests.** Expected: PASS.

### Task 4: Enemy AI and boss brain

**Files:**
- Create: `src/logic/ai.ts`, `src/logic/boss-ai.ts`, `src/data/enemies.ts`
- Test: `tests/logic/ai.test.ts`, `tests/logic/boss-ai.test.ts`

**Interfaces:**
- Consumes: `Vec2` (Task 2)
- Produces:
  - `type EnemyId = 'husk' | 'hound' | 'archer' | 'warden'`
  - `ENEMIES: Record<EnemyId, EnemyDef>`, where `EnemyDef = { id; nameKey; maxHp; damage; armor; moveSpeed; radius; aggroRange; attackRange; windup; recover; xp; potionDropChance; ranged?: { projectileSpeed: number; preferredRange: number } }`. Starting values (tune freely):
    - husk: hp 40, dmg 8, speed 2.2, attack range 1.4, windup 0.5, xp 10, drop 0.12
    - hound: hp 28, dmg 6, speed 5.5, windup 0.3, xp 12; retreats 1.2s after a bite
    - archer: hp 30, dmg 9, speed 2.6, attack range 9, preferred range 7, windup 0.8, xp 15
    - warden: hp 900, dmg 22, speed 2.4, radius 1.3, xp 200
  - `type AiState = 'idle' | 'chase' | 'windup' | 'recover' | 'retreat' | 'dead'`
  - `type AiInput = { dt: number; self: Vec2; target: Vec2; targetAlive: boolean; hasLos: boolean }`
  - `type AiCommand = { move?: Vec2; face?: Vec2; startWindup?: boolean; strike?: boolean }` — `strike` fires once, when the windup completes.
  - `class EnemyBrain(def: EnemyDef)` with `state`, `update(i: AiInput): AiCommand`, `onHit()` (wakes an idle enemy), `kill()`.
  - `type BossAttack = 'slam' | 'sweep' | 'summon'`
  - `class WardenBrain(def)` with `update(i: AiInput & { hpRatio: number; addsAlive: number }): AiCommand & { attack?: BossAttack; telegraph?: { kind: BossAttack; at: Vec2; radius: number; duration: number } }`, `reset()`, `enraged: boolean`. Rules:
    - slam: 1.1s red circle telegraph, radius 3.5
    - sweep: 0.7s, 180° arc in front, range 3.2
    - summon: every 18s if `addsAlive < 4`, spawns 2 husks
    - below 50% HP: `enraged`, windups ×0.7, recovery ×0.7

- [ ] **Step 1: Write failing tests.**
  - An idle husk stays idle when the target is beyond aggro range.
  - Inside aggro range → `chase` with `move` set.
  - Inside attack range → `windup`; `strike` becomes true exactly once after `windup` seconds; then `recover`.
  - An archer closer than preferredRange−2 moves away; it doesn't attack without line of sight.
  - Target dead → idle.
  - Warden at 40% HP → `enraged === true` and its windups are shorter.
  - `reset()` clears enrage and timers *(Review Focus 4)*.
  - Summon is not chosen when `addsAlive >= 4`.
- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement** the timer-driven state machines. The brains return intents only: no movement integration and no damage.
- [ ] **Step 4: Run tests.** Expected: PASS.

### Task 5: Tutorial step machine and Vietnamese strings

**Files:**
- Create: `src/logic/tutorial.ts`, `src/data/strings.ts`
- Test: `tests/logic/tutorial.test.ts`

**Interfaces:**
- Produces:
  - `type TutorialStep = 'move' | 'talk' | 'attack' | 'cleave' | 'charge' | 'potion' | 'clear' | 'done'`
  - `type TutorialEvent = { type: 'reachedElder' } | { type: 'talkedElder' } | { type: 'enemyKilled'; group: string } | { type: 'skillUsed'; skill: SkillId } | { type: 'potionUsed' } | { type: 'groupCleared'; group: string } | { type: 'hpChanged'; ratio: number }`
  - `class Tutorial(enabled = true)` with `step`, `enabled`, `handle(e): boolean` (true when the step changed), `setEnabled(b)`, `hint(): string | null` (a string key, or null when disabled or done).
  - Advancing rules:
    - move → talk on `reachedElder`
    - talk → attack on `talkedElder`
    - attack → cleave on `groupCleared 'lone'`
    - cleave → charge on `skillUsed cleave` **and** `groupCleared 'pack'`
    - charge → potion on `skillUsed charge` and `groupCleared 'hound'`; if `hpRatio === 1` at that moment, skip straight to clear
    - potion → clear on `potionUsed`
    - clear → done on `groupCleared 'graveyard'`
  - When disabled, steps still advance in the background (the gate logic depends on them), but `hint()` returns null.
  - `STRINGS: Record<string, string>` and `t(key: string, vars?: Record<string, string | number>): string`. This file holds all Vietnamese text: the intro lines (4 scenes, 2–3 lines each), elder dialogue, tutorial hints, skill/enemy names, HUD labels, pause menu, death and respawn text, and the demo-end text and stats.

- [ ] **Step 1: Write failing tests.**
  - The full happy path reaches `done`.
  - Potion is skipped when HP is full.
  - Events that arrive out of order don't skip steps.
  - Disabled → `hint() === null` but steps still advance.
  - Re-sending an old event after a respawn doesn't regress the step *(Review Focus 4)*.
  - `t('hud.level', {n: 3})` interpolates.
- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement** the step machine and write all strings.
- [ ] **Step 4: Run tests.** Expected: PASS.

### Task 6: Procedural character rigs and the animator; player movement

**Files:**
- Create: `src/render/characters/rig.ts`, `src/render/characters/animator.ts`, `src/render/characters/builders.ts` (wanderer, husk, hound, archer, warden, elder)
- Create: `src/core/input.ts`, `src/game/actor.ts`, `src/game/player-controller.ts`, `src/game/world.ts`

**Interfaces:**
- Consumes: Tasks 1–3
- Produces:
  - `type AnimName = 'idle' | 'walk' | 'attack' | 'cast' | 'hit' | 'die' | 'charge'`
  - `interface CharacterView { root: THREE.Group; play(a: AnimName, speed?: number): void; update(dt: number): void; flash(color?: number): void; setFacing(rad: number): void; height: number }`
  - `buildCharacter(kind: 'wanderer' | EnemyId | 'elder'): CharacterView`. Each rig is a hierarchy (hips → spine → chest → head and arms, hips → legs) built from low-poly primitives plus a weapon. The animator blends between poses using per-joint target rotations, sine cycles and easing. The attack keys a strike moment at 45% of the clip, signalled with an `onStrike` callback.
  - `class Input(canvas)` exposing:
    - `mouseNdc`, `leftDown`, `leftPressed` (edge)
    - `keyPressed(code): boolean` (edge, cleared every frame by `endFrame()`)
    - `wheel`
  - `type Actor = { id: number; kind: 'player' | 'enemy' | 'npc'; def: string; pos: Vec2; facing: number; radius: number; hp: number; maxHp: number; alive: boolean; view: CharacterView; group?: string }`
  - `class World` with `actors`, `grid: NavGrid`, `player: Actor`, `add(a)`, `remove(a)`, `enemiesNear(p: Vec2, r: number): Actor[]`, `pick(ndc): { actor?: Actor; ground?: Vec2 }`. Picking raycasts actor hitboxes first, then the ground plane.
  - `class PlayerController(world, input, camera)`:
    - Click on the ground → `findPath`, then follow it.
    - Holding the mouse re-paths at most every 0.15s.
    - Click on an enemy → approach to range, then attack.
    - Click on an NPC → approach, then emit `talk`.

- [ ] **Step 1: Verify the rig visually.** Add a debug route `?rigs` that lines up all 6 rigs cycling their animations. Expected (screenshot): every rig is readable at iso zoom, the walk cycle alternates legs, and the attack swing is clear.
- [ ] **Step 2: Verify movement.** Use a test map with a few blocked cells. Expected: click-to-move walks around obstacles, holding the mouse follows the cursor, and clicking a wall walks to the nearest point.

### Task 7: Map format, loader and Map 1 Emberfall environment

**Files:**
- Create: `src/data/maps/types.ts`, `src/data/maps/emberfall.ts`, `src/game/map-loader.ts`
- Create: `src/render/terrain.ts`, `src/render/props.ts`, `src/render/lighting.ts`, `src/render/vfx/particles.ts`

**Interfaces:**
- Produces:
  - `type MapDef = { id: 'emberfall' | 'crypt'; index: 1 | 2; size: { w: number; h: number }; cellSize: number; tiles: string[]; legend: Record<string, TileKind>; props: PropPlacement[]; spawns: SpawnDef[]; lights: LightDef[]; triggers: TriggerDef[]; playerStart: Vec2; checkpoints: Vec2[]; ambience: { fog: number; fogNear: number; fogFar: number; moon: number; moonIntensity: number; ash: boolean } }`
  - `TileKind = 'ground' | 'path' | 'wall' | 'water' | 'void' | 'floor' | 'gate'`
  - `PropPlacement = { kind: PropKind; x; z; rot?; scale?; blocks?: boolean }`
  - `SpawnDef = { enemy: EnemyId; x; z; group: string }`
  - `TriggerDef = { id: string; x; z; radius: number }`
  - `loadMap(def, world, scene, quality): LoadedMap`, where `LoadedMap = { dispose(): void; setGateOpen(id: string, open: boolean): void }`. It builds the NavGrid from tiles plus blocking props, merges static geometry, and uses InstancedMesh for repeated props.
  - `PropKind`: house-ruin, fence, dead-tree, gravestone, torch, campfire, rock, cart, well, crypt-gate, pillar, coffin, bones, candles, brazier, cobweb, wall-segment.
  - `class LightPool(scene, max)`: `register(light: THREE.PointLight, flicker = true)`; `update(cameraTarget: Vec2, t)` enables the nearest `max` lights and flickers them.
  - `class Particles(scene, budget)`: `emit(preset: 'ash' | 'spark' | 'blood' | 'dust' | 'ember' | 'soul', pos: THREE.Vector3, count?: number, dir?: THREE.Vector3)`, `update(dt)`. Uses pooled `THREE.Points` with a custom shader for size and alpha over life.
  - Emberfall layout, about 48×48 cells:
    - southwest: player start
    - center: campfire and the Elder
    - along the path east: lone husk at 'lone', 3-husk 'pack', hound at 'hound'
    - northeast: graveyard 'graveyard' (8–10 mixed)
    - beyond it, the crypt gate (blocked until the graveyard is cleared)

- [ ] **Step 1: Build the map with the loader and verify it visually.** Expected (screenshot, *visual checkpoint 1, part A*): moonlit ruined village, flickering torches, falling ash, fog at the edges, and readable silhouettes.
- [ ] **Step 2: Measure performance.** Use `?stats` to show an FPS/draw-call overlay. Expected: ≥55fps on High on the M4 Mac.

### Task 8: Combat runtime and hit feedback

**Files:**
- Create: `src/game/combat-system.ts`, `src/game/enemy-controller.ts`, `src/game/pickups.ts`
- Create: `src/render/vfx/feedback.ts` (hit flash, hit-stop, floating numbers bridge, slash trail)
- Create: `src/ui/floating-text.ts`

**Interfaces:**
- Consumes: Tasks 3, 4, 6, 7
- Produces:
  - `class CombatSystem(world, bus, rng)`: `dealDamage(src: Actor, dst: Actor, mult: number, opts?: { knockback?: number; dir?: Vec2 }): number`. It emits `bus` events:
    - `'damaged' {actor, amount, crit}`
    - `'killed' {actor, by}`
    - `'playerDamaged'`
  - `EnemyController` ties `EnemyBrain` and `WardenBrain` to actors: movement with `moveWithCollision` and `separate`, and strikes go through `CombatSystem`.
  - `hitStop(seconds)` is applied in the world update: it scales dt to 0.05 for 60ms on player hits and for 120ms on crits.
  - Feedback per hit: white flash on the victim, blood/dust particles, a floating number (yellow when crit), and a camera shake of 0.15 (0.35 on crit).
  - Death: the `die` animation, the body sinks after 2s, a potion drop rolls, and XP goes to the player.

- [ ] **Step 1: Verify combat.** Spawn husks and a hound in Emberfall. Expected: basic attack on hold, Fury rises on hit, enemies chase and hit back, the HP number goes down, deaths animate, and potions drop and get picked up by walking over them.

### Task 9: Skills and telegraphs

**Files:**
- Create: `src/game/skills-system.ts`, `src/render/vfx/skill-fx.ts`, `src/render/vfx/telegraph.ts`

**Interfaces:**
- Consumes: Tasks 2, 3, 8
- Produces:
  - `class SkillsSystem(world, combat, fury, cooldowns, bus)`: `tryUse(id: SkillId, aim: Vec2): 'ok' | 'fury' | 'cooldown' | 'locked'`. Emits `'skillUsed' {id}` and `'skillDenied' {id, reason}`.
    - cleave: hits every enemy within range and arc around the facing toward `aim`.
    - charge: dashes at 22 u/s to `castToWalkable(aim)`, damaging and knocking back enemies along the path.
    - nova: expanding fire ring with burn ticks.
  - `skill-fx`: cleave arc mesh (additive, fading), charge afterimage trail, nova ring plus ember burst.
  - `Telegraph.show(kind: 'circle' | 'arc', at: Vec2, radius: number, duration: number, arcDeg?: number, facing?: number)`: a red ground decal that fills up over `duration`.
  - Archer arrows: `Projectiles` (in `skills-system.ts` or `projectiles.ts`), with a straight line, collision against the grid, and hits on the player.

- [ ] **Step 1: Verify skills.** Expected:
  - Keys 1/2/3 behave as specified.
  - Using a skill without enough Fury fires nothing and emits `skillDenied`.
  - Charge into a wall stops at the wall *(Review Focus 3)*.

### Task 10: HUD, dialogue and the Emberfall tutorial flow

**Files:**
- Create: `src/ui/hud.ts`, `src/ui/hud.css`, `src/ui/dialogue.ts`, `src/ui/tutorial-panel.ts`
- Create: `src/game/level-flow.ts`

**Interfaces:**
- Consumes: Tasks 5, 8, 9
- Produces:
  - `class Hud(root: HTMLElement)` with:
    - `setHp(r)`, `setFury(r)`, `setXp(r, level)`, `setPotions(n)`
    - `setSkill(slot, {cdRatio, usable, locked})`, `flashDenied(slot)`
    - `setTarget(name | null, hpRatio)`, `setBoss(name | null, hpRatio)`
    - `toast(text)`, `levelUp(level)`
  - The orbs are CSS radial gradients with an animated fill.
  - `class Dialogue(root)`: `show(lines: {speaker: string; text: string}[]): Promise<void>`. Advance with click or Space; the game pauses while it is open.
  - `TutorialPanel` renders `tutorial.hint()`.
  - `LevelFlow(world, mapDef, tutorial, bus)` drives the triggers:
    - `reachedElder`, plus group-clear detection from `'killed'`
    - opens the crypt gate when the graveyard is cleared, then shows a toast
    - entering the gate trigger → map transition
    - checkpoint respawn on player death: full HP, potions kept, tutorial state kept

- [ ] **Step 1: Play map 1 end to end.** Expected:
  - All 7 tutorial steps appear in order.
  - Dying respawns at the checkpoint without losing tutorial progress *(Review Focus 4)*.
  - The gate opens after the graveyard is cleared.
- [ ] **Step 2: Visual checkpoint 1.** Screenshots of the village, a fight, and the HUD are delivered to the project owner for art-direction feedback.

### Task 11: Map 2 Hầm Mộ Cổ and the archers

**Files:**
- Create: `src/data/maps/crypt.ts`
- Modify: `src/render/props.ts` (crypt props), `src/game/level-flow.ts` (nova unlock moment, boss door checkpoint)

- [ ] **Step 1: Build the crypt.** Layout, about 56×40:
  - entrance hall → 2–3 chambers joined by corridors (husks, hounds, archers)
  - an altar room where the Ember Nova unlocks: dialogue line, toast, and an ember burst
  - checkpoint at the boss door → circular boss chamber with braziers
  - Ambience: darker, cold blue fill light, candles, no ash, dust motes instead.

  Expected (screenshot): moody crypt, readable paths. Archers show their aim line before shooting.

### Task 12: The Barrow Warden boss fight

**Files:**
- Create: `src/game/boss-controller.ts`
- Modify: `src/game/enemy-controller.ts`

- [ ] **Step 1: Implement the boss.** The fight starts on the boss room trigger: the door closes, the boss bar appears, and a short roar plays (camera shake and dust).
  - slam / sweep → telegraph, then damage on completion if the player is inside
  - summon → husks rise from the ground with soul particles
  - enrage → red tint and faster animations
  - On player death: the boss resets (full HP, adds despawn, `WardenBrain.reset()`) and the player respawns at the door *(Review Focus 4)*.
  - On boss death: a slow-mo kill, the Eternal Flame motif (a large ember burst plus light), then `'bossDefeated'`.
- [ ] **Step 2: Visual checkpoint 2.** Expected: the fight is beatable at level 4–5 with potions, and the telegraphs are dodgeable.

### Task 13: Scenes: title, intro cinematic, pause, and demo end

**Files:**
- Create: `src/scenes/scene.ts`, `src/scenes/title.ts`, `src/scenes/intro.ts`, `src/scenes/level.ts`, `src/scenes/ending.ts`, `src/ui/menus.ts`, `src/ui/menus.css`
- Modify: `src/main.ts`

**Interfaces:**
- Produces:
  - `interface Scene { enter(): Promise<void> | void; update(dt: number): void; render(): void; exit(): void }`
  - `class SceneManager` with `go(s: Scene)`, which crossfades through a black overlay.
  - **Title:** a slowly orbiting view of a dead campfire with embers, the "ASHFALL" title, and "Nhấn để bắt đầu".
  - **Intro:** 4 shots. Each one builds a small vignette scene from the props and characters, has a scripted camera path of 15–20s, and narration lines from `STRINGS` fading in letterboxed. Total ≈75s. Space or Esc skips. Shots:
    - Sanctum tower with the dead flame
    - ash fields
    - the dead rising in a graveyard
    - the Wanderer at the Emberfall gate
  - **Level:** hosts a `World` and a map, and swaps maps on transition.
  - **Pause (Esc):** resume, quality High/Low, tutorial on/off, restart map.
  - **Ending:** "Hết bản demo" with play time, enemies killed, level reached, and deaths.

- [ ] **Step 1: Play the whole flow.** Expected: title → intro (skippable) → map 1 → map 2 → boss → ending, with no console errors. Switching to Low in the pause menu takes effect immediately.

### Task 14: Performance pass, polish and README

**Files:**
- Create: `README.md`
- Modify: whatever profiling points to.

- [ ] **Step 1: Profile on High.** Check draw calls (merge static geometry, instance props), active light count, and the particle budget. Expected: ≥55fps in the busiest fight on the M4. On Low, comfortably 60.
- [ ] **Step 2: Polish pass.** Tune balance numbers, camera feel, hit-stop and the animation easing.
- [ ] **Step 3: Write the README in Vietnamese.** Cover:
  - how to run, controls, and the code architecture map
  - what was built, what was hard, known weaknesses (procedural animation)
  - recommendations for a full game
- [ ] **Step 4: Final verification.** `npx vitest run` → all pass. `npm run build` → success. A full playthrough with screenshots.
