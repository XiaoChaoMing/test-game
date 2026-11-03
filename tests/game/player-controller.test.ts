import { describe, expect, it } from 'vitest';
import { PlayerController } from '../../src/game/player-controller';
import { NavGrid } from '../../src/logic/grid';
import { Actor } from '../../src/game/actor';

/** Minimal fakes: a view whose animator never fires onStrike unless told to. */
function fakeView() {
  const anim = { busy: false, current: 'idle', onStrike: null as null | (() => void), strikeTime: () => 0.3 };
  return {
    anim,
    root: { position: { x: 0, y: 0, z: 0 } },
    rig: { setTint() {}, dispose() {} },
    height: 1.8,
    facing: 0,
    play(a: string) {
      anim.current = a;
    },
    setFacing() {},
    update() {},
    flash() {},
  };
}

function setup() {
  const grid = new NavGrid(20, 20, 1, { x: 0, z: 0 });
  const player = new Actor('player', 'wanderer', fakeView() as never, { x: 5, z: 5 }, { radius: 0.45, maxHp: 100, name: 'p' });
  player.damage = 10;
  const enemy = new Actor('enemy', 'husk', fakeView() as never, { x: 6, z: 5 }, { radius: 0.45, maxHp: 1000, name: 'e' });
  const hits: number[] = [];
  const world = {
    grid,
    player,
    actors: [player, enemy],
    pick: () => ({ actor: enemy, ground: { x: 6, z: 5 } }),
    bus: { emit() {} },
  };
  const input = { mouseNdc: { x: 0, y: 0 }, leftPressed: false, leftDown: false, keyPressed: () => false };
  const combat = { dealDamage: () => hits.push(1), basicFury: () => 8 };
  const skills = { busy: false, tryUse: () => 'ok', usePotion: () => false };
  const fx = { slash() {}, shockwave() {} };
  const pc = new PlayerController(world as never, input as never, combat as never, skills as never, fx as never);
  return { pc, player, enemy, input, hits };
}

describe('PlayerController', () => {
  it('can attack again after dying mid-swing and respawning (reset clears the swing lock)', () => {
    const { pc, player, input, hits } = setup();
    input.leftPressed = true;
    input.leftDown = true;
    pc.update(0.016); // starts a swing; onStrike never fires because the player dies
    input.leftPressed = false;
    expect(player.view.anim.current).toBe('attack');
    player.alive = false;
    player.view.play('die');
    pc.reset();
    player.alive = true;
    player.view.play('idle');
    input.leftPressed = true;
    pc.update(0.016);
    input.leftPressed = false;
    for (let i = 0; i < 120; i++) {
      pc.update(1 / 60);
      player.view.anim.onStrike?.();
    }
    expect(hits.length).toBeGreaterThan(0);
  });
});
