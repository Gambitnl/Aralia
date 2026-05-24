import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAbilitySystem } from '../useAbilitySystem';
import { createPlayerCombatCharacter } from '../../utils/combatUtils';
import { createMockCombatCharacter } from '../../utils/core/factories';
import type { BattleMapData, BattleMapTile, CombatAction, CombatCharacter } from '../../types/combat';
import type { SpellSlots } from '../../types/character';
import type { PlayerCharacter } from '../../types';
import maelisQuill from '../../../public/premade-characters/maelis_quill.json';
import fireBolt from '../../../public/data/spells/level-0/fire-bolt.json';
import mageHand from '../../../public/data/spells/level-0/mage-hand.json';
import minorIllusion from '../../../public/data/spells/level-0/minor-illusion.json';
import detectMagic from '../../../public/data/spells/level-1/detect-magic.json';
import findFamiliar from '../../../public/data/spells/level-1/find-familiar.json';
import mageArmor from '../../../public/data/spells/level-1/mage-armor.json';
import magicMissile from '../../../public/data/spells/level-1/magic-missile.json';
import healingWord from '../../../public/data/spells/level-1/healing-word.json';
import shield from '../../../public/data/spells/level-1/shield.json';
import sleep from '../../../public/data/spells/level-1/sleep.json';
import scorchingRay from '../../../public/data/spells/level-2/scorching-ray.json';
import fireball from '../../../public/data/spells/level-3/fireball.json';
import viciousMockery from '../../../public/data/spells/level-0/vicious-mockery.json';
import faerieFire from '../../../public/data/spells/level-1/faerie-fire.json';
import charmPerson from '../../../public/data/spells/level-1/charm-person.json';
import dissonantWhispers from '../../../public/data/spells/level-1/dissonant-whispers.json';
import lyrisSongweaver from '../../../public/premade-characters/lyris_songweaver.json';

vi.mock('../combat/useTargeting', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    useTargeting: () => {
      const [selectedAbility, setSelectedAbility] = React.useState<unknown | null>(null);
      const [targetingMode, setTargetingMode] = React.useState(false);

      return {
        startTargeting: React.useCallback((ability: unknown) => {
          setSelectedAbility(ability);
          setTargetingMode(true);
        }, []),
        cancelTargeting: React.useCallback(() => {
          setSelectedAbility(null);
          setTargetingMode(false);
        }, []),
        selectedAbility,
        targetingMode,
        aoePreview: null,
        params: null,
        previewAoE: vi.fn()
      };
    }
  };
});

vi.mock('../../commands', () => ({
  SpellCommandFactory: { createCommands: vi.fn().mockResolvedValue([]) },
  AbilityCommandFactory: { createCommands: vi.fn().mockReturnValue([]) },
  CommandExecutor: { execute: vi.fn().mockReturnValue({ success: true, finalState: { characters: [], combatLog: [] } }) }
}));

vi.mock('../../utils/combatUtils', async () => {
  const actual = await vi.importActual<typeof import('../../utils/combatUtils')>('../../utils/combatUtils');

  // Keep the real player-to-combat bridge available so the test exercises the
  // actual premade wizard spellbook, but make geometry and dice deterministic.
  return {
    ...actual,
    getDistance: () => 1,
    getCharacterDistance: () => 1,
    getOccupiedTiles: (character: CombatCharacter) => [character.position],
    generateId: () => 'test-id',
    rollDamage: () => 5,
    rollDice: () => 15
  };
});

const allSpellData = {
  'fire-bolt': fireBolt,
  'mage-hand': mageHand,
  'minor-illusion': minorIllusion,
  'detect-magic': detectMagic,
  'find-familiar': findFamiliar,
  'mage-armor': mageArmor,
  'magic-missile': magicMissile,
  'healing-word': healingWord,
  'scorching-ray': scorchingRay,
  'fireball': fireball,
  shield,
  sleep,
  'vicious-mockery': viciousMockery,
  'faerie-fire': faerieFire,
  'charm-person': charmPerson,
  'dissonant-whispers': dissonantWhispers
};

// The premade JSON is runtime-correct but imported as a loose object, so we
// narrow it once here and keep the regression typed without weakening the
// production spell model.
const maelisQuillCharacter = maelisQuill as unknown as PlayerCharacter;
const maelisQuillSpellSlots = maelisQuillCharacter.spellSlots as SpellSlots;

const buildLevelFiveWizard = (): CombatCharacter => {
  const highLevelWizard: PlayerCharacter = {
    ...maelisQuillCharacter,
    level: 5,
    classLevels: { wizard: 5 },
    spellSlots: {
      ...maelisQuillSpellSlots,
      level_1: { current: 4, max: 4 },
      level_2: { current: 3, max: 3 },
      level_3: { current: 2, max: 2 }
    },
    spellbook: {
      cantrips: ['fire-bolt', 'mage-hand', 'minor-illusion'],
      knownSpells: [
        'detect-magic',
        'find-familiar',
        'mage-armor',
        'magic-missile',
        'scorching-ray',
        'fireball',
        'shield',
        'sleep'
      ],
      preparedSpells: [
        'detect-magic',
        'find-familiar',
        'mage-armor',
        'magic-missile',
        'scorching-ray',
        'fireball',
        'shield',
        'sleep'
      ]
    }
  };

  return createPlayerCombatCharacter(highLevelWizard, allSpellData as never);
};

const openFloorMap = (width = 8, height = 8): BattleMapData => {
  const tiles = new Map<string, BattleMapTile>();

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      tiles.set(`${x}-${y}`, {
        id: `${x}-${y}`,
        coordinates: { x, y },
        terrain: 'floor',
        elevation: 0,
        movementCost: 1,
        blocksMovement: false,
        blocksLoS: false,
        decoration: null,
        effects: []
      });
    }
  }

  return {
    dimensions: { width, height },
    tiles,
    theme: 'dungeon',
    seed: 42
  };
};

describe('useAbilitySystem - Package 4 multi-target spells', () => {
  // The hook expects the full CombatAction contract, so the mock uses that
  // signature instead of the default zero-arg tuple that Vitest infers.
  const onExecuteAction = vi.fn<(action: CombatAction) => boolean>(() => true);
  const onCharacterUpdate = vi.fn();
  const onLogEntry = vi.fn();
  const onAbilityEffect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes a real cantrip through the simulator without a spell slot cost', async () => {
    const caster = createPlayerCombatCharacter(maelisQuillCharacter as never, allSpellData as never);
    const ability = caster.abilities.find(a => a.id === 'fire-bolt');

    expect(ability).toBeDefined();
    if (!ability) {
      throw new Error('Expected Fire Bolt to be present on the real premade caster');
    }

    const target = createMockCombatCharacter({
      id: 'cantrip-target',
      name: 'Cantrip Target',
      team: 'enemy',
      position: { x: 1, y: 0 },
      currentHP: 7,
      maxHP: 7
    });

    const { result } = renderHook(() => useAbilitySystem({
      characters: [caster, target],
      mapData: openFloorMap(),
      onExecuteAction,
      onCharacterUpdate,
      onLogEntry,
      onAbilityEffect
    }));

    act(() => {
      result.current.startTargeting(ability, caster);
    });

    let didSelect = false;
    act(() => {
      didSelect = result.current.selectTarget(target.position, caster);
    });

    expect(didSelect).toBe(true);
    expect(onExecuteAction).toHaveBeenCalledTimes(1);

    const action = onExecuteAction.mock.calls[0][0];
    expect(action.abilityId).toBe('fire-bolt');
    expect(action.targetCharacterIds).toEqual(['cantrip-target']);
    expect(action.cost.type).toBe('action');
    expect(action.cost.spellSlotLevel).toBe(0);
  });

  it('routes a real healing spell through the simulator to a legal ally target', async () => {
    const caster = createPlayerCombatCharacter(lyrisSongweaver as never, allSpellData as never);
    const ability = caster.abilities.find(a => a.id === 'healing-word');

    expect(ability).toBeDefined();
    if (!ability) {
      throw new Error('Expected Healing Word to be present on the real premade caster');
    }

    const ally = createMockCombatCharacter({
      id: 'ally-target',
      name: 'Ally Target',
      team: 'player',
      position: { x: 1, y: 0 },
      currentHP: 4,
      maxHP: 10
    });

    const { result } = renderHook(() => useAbilitySystem({
      characters: [caster, ally],
      mapData: openFloorMap(),
      onExecuteAction,
      onCharacterUpdate,
      onLogEntry,
      onAbilityEffect
    }));

    act(() => {
      result.current.startTargeting(ability, caster);
    });

    let didSelect = false;
    act(() => {
      didSelect = result.current.selectTarget(ally.position, caster);
    });

    expect(didSelect).toBe(true);
    expect(onExecuteAction).toHaveBeenCalledTimes(1);

    const action = onExecuteAction.mock.calls[0][0];
    expect(action.abilityId).toBe('healing-word');
    expect(action.targetCharacterIds).toEqual(['ally-target']);
    expect(action.cost.type).toBe('bonus');
    expect(action.cost.spellSlotLevel).toBe(1);
  });

  it('routes a real multi-target spell through all legal targets instead of collapsing to one', async () => {
    const caster = createPlayerCombatCharacter(maelisQuillCharacter as never, allSpellData as never);
    const ability = caster.abilities.find(a => a.id === 'magic-missile');

    expect(ability).toBeDefined();
    if (!ability) {
      throw new Error('Expected Magic Missile to be present on the real premade caster');
    }

    const targets = [
      createMockCombatCharacter({ id: 'target-1', name: 'Target One', team: 'enemy', position: { x: 1, y: 0 }, currentHP: 7, maxHP: 7 }),
      createMockCombatCharacter({ id: 'target-2', name: 'Target Two', team: 'enemy', position: { x: 1, y: 1 }, currentHP: 7, maxHP: 7 }),
      createMockCombatCharacter({ id: 'target-3', name: 'Target Three', team: 'enemy', position: { x: 2, y: 0 }, currentHP: 7, maxHP: 7 })
    ];

    const { result } = renderHook(() => useAbilitySystem({
      characters: [caster, ...targets],
      mapData: openFloorMap(),
      onExecuteAction,
      onCharacterUpdate,
      onLogEntry,
      onAbilityEffect
    }));

    act(() => {
      result.current.startTargeting(ability, caster);
    });

    expect(result.current.selectedAbility?.id).toBe('magic-missile');
    expect(result.current.targetingMode).toBe(true);

    let didSelect = false;
    act(() => {
      didSelect = result.current.selectTarget(targets[0].position, caster);
    });

    expect(didSelect).toBe(true);
    expect(onExecuteAction).toHaveBeenCalledTimes(1);

    const action = onExecuteAction.mock.calls[0][0];
    expect(action.targetCharacterIds).toHaveLength(3);
    expect(action.targetCharacterIds).toEqual(expect.arrayContaining(['target-1', 'target-2', 'target-3']));
  });

  it('routes a level 2 multi-target spell through all legal targets for a higher-level wizard', async () => {
    const caster = buildLevelFiveWizard();
    const ability = caster.abilities.find(a => a.id === 'scorching-ray');

    expect(ability).toBeDefined();
    if (!ability) {
      throw new Error('Expected Scorching Ray to be present on the level 5 wizard fixture');
    }

    const targets = [
      createMockCombatCharacter({ id: 'ray-target-1', name: 'Ray Target One', team: 'enemy', position: { x: 1, y: 0 }, currentHP: 7, maxHP: 7 }),
      createMockCombatCharacter({ id: 'ray-target-2', name: 'Ray Target Two', team: 'enemy', position: { x: 1, y: 1 }, currentHP: 7, maxHP: 7 }),
      createMockCombatCharacter({ id: 'ray-target-3', name: 'Ray Target Three', team: 'enemy', position: { x: 2, y: 0 }, currentHP: 7, maxHP: 7 })
    ];

    const { result } = renderHook(() => useAbilitySystem({
      characters: [caster, ...targets],
      mapData: openFloorMap(),
      onExecuteAction,
      onCharacterUpdate,
      onLogEntry,
      onAbilityEffect
    }));

    act(() => {
      result.current.startTargeting(ability, caster);
    });

    let didSelect = false;
    act(() => {
      didSelect = result.current.selectTarget(targets[0].position, caster);
    });

    expect(didSelect).toBe(true);
    expect(onExecuteAction).toHaveBeenCalledTimes(1);

    const action = onExecuteAction.mock.calls[0][0];
    expect(action.targetCharacterIds).toHaveLength(3);
    expect(action.targetCharacterIds).toEqual(expect.arrayContaining(['ray-target-1', 'ray-target-2', 'ray-target-3']));
  });

  it('routes a level 3 area spell through every affected target in the simulator', async () => {
    const caster = buildLevelFiveWizard();
    const ability = caster.abilities.find(a => a.id === 'fireball');

    expect(ability).toBeDefined();
    if (!ability) {
      throw new Error('Expected Fireball to be present on the level 5 wizard fixture');
    }

    const targets = [
      createMockCombatCharacter({ id: 'fireball-target-1', name: 'Fireball Target One', team: 'enemy', position: { x: 6, y: 6 }, currentHP: 12, maxHP: 12 }),
      createMockCombatCharacter({ id: 'fireball-target-2', name: 'Fireball Target Two', team: 'enemy', position: { x: 7, y: 6 }, currentHP: 12, maxHP: 12 }),
      createMockCombatCharacter({ id: 'fireball-target-3', name: 'Fireball Target Three', team: 'enemy', position: { x: 6, y: 7 }, currentHP: 12, maxHP: 12 })
    ];

    const { result } = renderHook(() => useAbilitySystem({
      characters: [caster, ...targets],
      mapData: openFloorMap(),
      onExecuteAction,
      onCharacterUpdate,
      onLogEntry,
      onAbilityEffect
    }));

    act(() => {
      result.current.startTargeting(ability, caster);
    });

    let didSelect = false;
    act(() => {
      didSelect = result.current.selectTarget({ x: 6, y: 6 }, caster);
    });

    expect(didSelect).toBe(true);
    expect(onExecuteAction).toHaveBeenCalledTimes(1);

    const action = onExecuteAction.mock.calls[0][0];
    expect(action.targetCharacterIds).toHaveLength(3);
    expect(action.targetCharacterIds).toEqual(expect.arrayContaining(['fireball-target-1', 'fireball-target-2', 'fireball-target-3']));
  });
});
