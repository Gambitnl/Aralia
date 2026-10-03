import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ability, BattleMapData, BattleMapTile, CombatAction, CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import {
  clearFightInPlaceHandoff,
  setFightInPlaceHandoff,
} from '../../../systems/combat/fightInPlace/fightInPlaceHandoff';
import { GROUND_METERS_PER_CELL_FIP } from '../../../systems/combat/fightInPlace/inSceneMovement';

// -----------------------------------------------------------------------------
// agora-1224 — full in-scene 3D targeting for abilities and attacks.
//
// Targeting used to be deferred to the 2D-board toggle. These tests prove the
// in-scene surface now arms an ability, aims it with the SAME ground-pick plane
// that moves, rules the click with the shared target referee, and commits the
// action the 2D board would have committed — and that an out-of-range click
// commits nothing and explains itself instead.
//
// World3DScene and the R3F combat layer are mocked: a ground click cannot be
// pixel-simulated in jsdom, so the test drives the layer's own `onGroundPick`
// prop, which is exactly the callback a real raycast hit invokes.
// -----------------------------------------------------------------------------

let lastLayerProps: {
  onGroundPick?: (worldXM: number, worldZM: number) => void;
  reachable?: { centerXM: number; centerZM: number; movementFeet: number } | null;
} = {};

vi.mock('../../World3D/World3DScene', () => ({
  default: ({ combatLayer }: { combatLayer?: React.ReactNode }) => (
    <div data-testid="mock-world3d-scene">{combatLayer}</div>
  ),
}));

vi.mock('../../World3D/combat/InPlaceCombatLayer', () => ({
  default: (props: Record<string, unknown>) => {
    lastLayerProps = props as typeof lastLayerProps;
    return <div data-testid="mock-in-place-layer" />;
  },
}));

// Imported after the mocks so the component under test binds to them.
import InPlaceCombatScene, {
  getArmedAbilityRangeFeet,
  listInSceneAimableAbilities,
  resolveInSceneTargetPick,
} from '../InPlaceCombatScene';

const ANCHOR = { playerXM: 100, playerZM: 250 };
const PATCH_WIDTH = 21;
const PATCH_HEIGHT = 21;
const CENTER = { x: 10, y: 10 };

function makePatch(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < PATCH_HEIGHT; y += 1) {
    for (let x = 0; x < PATCH_WIDTH; x += 1) {
      const id = `${x}-${y}`;
      tiles.set(id, {
        id,
        coordinates: { x, y },
        terrain: 'grass',
        elevation: 0,
        movementCost: 5,
        blocksLoS: false,
        blocksMovement: false,
        decoration: null,
        effects: [],
      });
    }
  }
  return { dimensions: { width: PATCH_WIDTH, height: PATCH_HEIGHT }, tiles, theme: 'forest', seed: 7 };
}

/** The world meters at the center of a patch tile, mirroring the extraction math. */
function worldMetersOfTile(x: number, y: number): { xM: number; zM: number } {
  return {
    xM: ANCHOR.playerXM + (x - CENTER.x) * GROUND_METERS_PER_CELL_FIP,
    zM: ANCHOR.playerZM + (y - CENTER.y) * GROUND_METERS_PER_CELL_FIP,
  };
}

/** A plain one-target weapon swing: range 1 tile (5 ft), costs the Action. */
function makeSwordAbility(overrides: Partial<Ability> = {}): Ability {
  return {
    id: 'longsword',
    name: 'Longsword',
    description: 'A melee weapon attack.',
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    range: 1,
    effects: [],
    attackType: 'weapon',
    ...overrides,
  } as Ability;
}

function makeHero(abilities: Ability[]): CombatCharacter {
  return createMockCombatCharacter({
    id: 'hero',
    name: 'Hero',
    team: 'player',
    position: { x: CENTER.x, y: CENTER.y },
    abilities,
  });
}

function makeGoblin(position: { x: number; y: number }): CombatCharacter {
  return createMockCombatCharacter({
    id: 'goblin',
    name: 'Goblin',
    team: 'enemy',
    position,
  });
}

function renderScene(characters: CombatCharacter[]) {
  const committed: CombatAction[] = [];
  const notices: string[] = [];
  render(
    <InPlaceCombatScene
      characters={characters}
      mapData={makePatch()}
      currentCharacterId="hero"
      onCommitMove={(action) => committed.push(action)}
      onNotify={(message) => notices.push(message)}
    />,
  );
  return { committed, notices };
}

/** Drive the layer's own ground-pick callback — the callback a real raycast hit invokes. */
function groundPick(xM: number, zM: number) {
  act(() => { lastLayerProps.onGroundPick!(xM, zM); });
}

describe('InPlaceCombatScene in-scene targeting', () => {
  beforeEach(() => {
    lastLayerProps = {};
    setFightInPlaceHandoff({
      ground: {},
      loader: {},
      sceneOrigin: { x: 0, z: 0 },
      anchor: ANCHOR,
      surfaceY: 0,
      worldSeed: 1,
    });
  });

  afterEach(() => {
    clearFightInPlaceHandoff();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Pure referee helpers
  // ==========================================================================

  it('offers only aimable, affordable abilities', () => {
    const spent = createMockCombatCharacter({
      abilities: [makeSwordAbility()],
      actionEconomy: { action: { used: true, remaining: 0 } } as CombatCharacter['actionEconomy'],
    });
    expect(listInSceneAimableAbilities(spent)).toHaveLength(0);

    const ready = makeHero([
      makeSwordAbility(),
      // A whole-battlefield ability cannot be expressed by one ground click.
      makeSwordAbility({ id: 'shout', name: 'Shout', targeting: 'all_enemies' }),
    ]);
    expect(listInSceneAimableAbilities(ready).map(ability => ability.id)).toEqual(['longsword']);
  });

  it('resolves a world click to the tile and the creature standing on it', () => {
    const patch = makePatch();
    const goblin = makeGoblin({ x: CENTER.x + 1, y: CENTER.y });
    const world = worldMetersOfTile(CENTER.x + 1, CENTER.y);

    const pick = resolveInSceneTargetPick(patch, ANCHOR, [goblin], world.xM, world.zM);
    expect(pick?.tile).toEqual({ x: CENTER.x + 1, y: CENTER.y });
    expect(pick?.target?.id).toBe('goblin');

    const bare = worldMetersOfTile(CENTER.x + 3, CENTER.y);
    expect(resolveInSceneTargetPick(patch, ANCHOR, [goblin], bare.xM, bare.zM)?.target).toBeNull();

    // Far outside the extracted patch.
    expect(resolveInSceneTargetPick(patch, ANCHOR, [goblin], 9999, 9999)).toBeNull();
  });

  it('reports an ability reach in feet, the units the referee measures in', () => {
    expect(getArmedAbilityRangeFeet(makeSwordAbility({ range: 12 }))).toBe(60);
  });

  // ==========================================================================
  // The wired surface
  // ==========================================================================

  it('arms an ability from the in-scene bar and shows its reach instead of the move disc', () => {
    const hero = makeHero([makeSwordAbility()]);
    renderScene([hero, makeGoblin({ x: CENTER.x + 1, y: CENTER.y })]);

    // Nothing armed: the disc is the movement still left this turn.
    expect(lastLayerProps.reachable?.movementFeet).toBe(30);

    fireEvent.click(screen.getByTestId('fip-ability-longsword'));

    expect(screen.getByTestId('fip-ability-longsword')).toHaveAttribute('aria-pressed', 'true');
    // Armed: the disc is the ability's 5-ft reach.
    expect(lastLayerProps.reachable?.movementFeet).toBe(5);
  });

  it('commits the ability action the 2D board would commit when a legal target is clicked', () => {
    const hero = makeHero([makeSwordAbility()]);
    const goblin = makeGoblin({ x: CENTER.x + 1, y: CENTER.y });
    const { committed, notices } = renderScene([hero, goblin]);

    fireEvent.click(screen.getByTestId('fip-ability-longsword'));
    const world = worldMetersOfTile(goblin.position.x, goblin.position.y);
    groundPick(world.xM, world.zM);

    expect(notices).toEqual([]);
    expect(committed).toHaveLength(1);
    expect(committed[0]).toMatchObject({
      type: 'ability',
      abilityId: 'longsword',
      characterId: 'hero',
      targetPosition: { x: goblin.position.x, y: goblin.position.y },
      targetCharacterIds: ['goblin'],
      cost: { type: 'action' },
    });
    // The click is spent: the surface disarms rather than arming a second swing.
    expect(screen.getByTestId('fip-ability-longsword')).toHaveAttribute('aria-pressed', 'false');
  });

  it('rejects an out-of-reach target with the shared referee reason and commits nothing', () => {
    const hero = makeHero([makeSwordAbility()]);
    const goblin = makeGoblin({ x: CENTER.x + 6, y: CENTER.y });
    const { committed, notices } = renderScene([hero, goblin]);

    fireEvent.click(screen.getByTestId('fip-ability-longsword'));
    const world = worldMetersOfTile(goblin.position.x, goblin.position.y);
    groundPick(world.xM, world.zM);

    expect(committed).toEqual([]);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain('too far away');
  });

  it('rejects an ally clicked with an enemy-only ability', () => {
    const hero = makeHero([makeSwordAbility()]);
    const friend = createMockCombatCharacter({
      id: 'friend',
      name: 'Friend',
      team: 'player',
      position: { x: CENTER.x + 1, y: CENTER.y },
    });
    const { committed, notices } = renderScene([hero, friend]);

    fireEvent.click(screen.getByTestId('fip-ability-longsword'));
    const world = worldMetersOfTile(friend.position.x, friend.position.y);
    groundPick(world.xM, world.zM);

    expect(committed).toEqual([]);
    expect(notices[0]).toContain('can only target enemies');
  });

  it('keeps click-to-move alive while nothing is armed, and cancelling restores it', () => {
    const hero = makeHero([makeSwordAbility()]);
    const { committed } = renderScene([hero, makeGoblin({ x: CENTER.x + 1, y: CENTER.y })]);

    const destination = worldMetersOfTile(CENTER.x + 2, CENTER.y + 1);
    groundPick(destination.xM, destination.zM);
    expect(committed).toHaveLength(1);
    expect(committed[0]).toMatchObject({ type: 'move', targetPosition: { x: CENTER.x + 2, y: CENTER.y + 1 } });

    fireEvent.click(screen.getByTestId('fip-ability-longsword'));
    fireEvent.click(screen.getByTestId('fip-ability-cancel'));
    groundPick(destination.xM, destination.zM);

    expect(committed).toHaveLength(2);
    expect(committed[1].type).toBe('move');
  });
});
