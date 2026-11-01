/**
 * agora-f821.54 acceptance coverage: give Frozen and Chilled real sources.
 *
 * Remy ruled (2026-09-23, q5 of the conditions artifact) that ALL THREE
 * source kinds must exist: a cold spell, a cold map hazard, and a monster
 * ability. Each test below drives one ruled source through the production
 * path named in the task body (StatusConditionCommand for spells and mapped
 * abilities; resolveTileEffects for the hazard) and asserts the target ends
 * the turn carrying the condition, with a duration the lifecycle helpers
 * accept.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusConditionCommand } from '../StatusConditionCommand';
import { AbilityEffectMapper } from '../../factory/AbilityEffectMapper';
import { StatusConditionEffect, SpellEffect } from '@/types/spells';
import { CombatState, BattleMapTile } from '@/types/combat';
import { createMockCombatCharacter, createMockCombatState } from '@/utils/core';
import { CommandContext } from '../../base/SpellCommand';
import * as savingThrowUtils from '@/utils/character';
import { advanceRuntimeStatusConditionsAtTurnEnd } from '@/utils/combat/statusConditionUtils';
import { resolveTileEffects } from '@/systems/combat/engine/tileEffects';
import { BattleMapGenerator } from '@/services/battleMapGenerator';
import { MONSTERS_DATA } from '@/data/monsters';
import frostbiteData from '@/data/spells/level-0/frostbite.json';
import coneOfColdData from '@/data/spells/level-5/cone-of-cold.json';

// Saving throws are mocked so the tests never fight RNG: the condition rows
// under test all hang off failed saves.
vi.mock('@/utils/character/savingThrowUtils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils/character/savingThrowUtils')>();
  return {
    ...actual,
    calculateSpellDC: vi.fn(() => 13),
    rollSavingThrow: vi.fn()
  };
});

vi.mock('@/utils/combat', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/combat')>();
  return {
    ...actual,
    generateId: vi.fn(() => 'test-id')
  };
});

const findStatusRow = (spell: { effects: unknown[] }, name: string): StatusConditionEffect => {
  const row = (spell.effects as Array<Record<string, any>>).find(
    effect => effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === name
  );
  if (!row) throw new Error(`No STATUS_CONDITION row for ${name} on ${spell}`);
  return row as unknown as StatusConditionEffect;
};

describe('agora-f821.54 cold condition sources', () => {
  let state: CombatState;
  let context: CommandContext;

  beforeEach(() => {
    vi.clearAllMocks();

    const caster = createMockCombatCharacter({ id: 'caster', name: 'Caster' });
    const target = createMockCombatCharacter({
      id: 'target',
      name: 'Target',
      conditions: [],
      statusEffects: []
    });

    state = createMockCombatState({
      characters: [caster, target],
      turnState: { currentTurn: 1, currentCharacterId: 'caster', turnOrder: ['caster', 'target'], phase: 'planning', actionsThisTurn: [] }
    });

    context = {
      caster,
      castAtLevel: 5,
      targets: [target],
      spellId: 'test-spell',
      spellName: 'Test Spell',
      gameState: createMockCombatState()
    } as any;
  });

  const failSave = () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 2,
      success: false,
      modifiersApplied: []
    } as any);
  };

  describe('source 1: cold spells', () => {
    it('Frostbite applies Chilled through StatusConditionCommand and the target still carries it at turn end', async () => {
      failSave();
      const effect = findStatusRow(frostbiteData, 'Chilled');

      const command = new StatusConditionCommand(effect, context);
      const afterCast = await command.execute(state);

      const carried = afterCast.characters.find(c => c.id === 'target')!;
      expect(carried.conditions?.map(c => c.name)).toContain('Chilled');
      expect(carried.statusEffects.map(s => s.name)).toContain('Chilled');

      // The turn-boundary helper accepts the authored turn_end duration and
      // leaves the creature carrying the chill (two turn ends were authored).
      const afterTurnEnd = advanceRuntimeStatusConditionsAtTurnEnd(carried).character;
      expect(afterTurnEnd.conditions?.map(c => c.name)).toContain('Chilled');
      expect(afterTurnEnd.conditions?.find(c => c.name === 'Chilled')?.turnEndEventsRemaining).toBe(1);
    });

    it('Cone of Cold applies Frozen with its shatter break trigger', async () => {
      failSave();
      const effect = findStatusRow(coneOfColdData, 'Frozen');

      const command = new StatusConditionCommand(effect, context);
      const afterCast = await command.execute(state);

      const carried = afterCast.characters.find(c => c.id === 'target')!;
      expect(carried.conditions?.map(c => c.name)).toContain('Frozen');
      const frozen = carried.conditions?.find(c => c.name === 'Frozen');
      expect(frozen?.breakTriggers).toContain('target_takes_damage');
      // The legacy mirror preserves the same metadata, per the paired-write
      // policy other conditions rely on.
      expect(carried.statusEffects.find(s => s.name === 'Frozen')?.breakTriggers).toContain('target_takes_damage');

      const afterTurnEnd = advanceRuntimeStatusConditionsAtTurnEnd(carried).character;
      expect(afterTurnEnd.conditions?.map(c => c.name)).toContain('Frozen');
    });
  });

  describe('source 2: cold map hazard', () => {
    it('the snow biome generates walkable black-ice tiles carrying a Chilled ice effect', () => {
      // Deterministic seed sweep: the first seed that grows black ice owns
      // the assertion, so the proof does not hinge on one magic number.
      let mapData: ReturnType<BattleMapGenerator['generate']> | null = null;
      let iceTiles: BattleMapTile[] = [];
      for (let seed = 1; seed <= 30 && iceTiles.length === 0; seed++) {
        const candidate = new BattleMapGenerator(24, 24).generate('snow', seed);
        iceTiles = [...candidate.tiles.values()].filter(tile => tile.environmentalEffect?.type === 'ice');
        if (iceTiles.length > 0) mapData = candidate;
      }

      expect(iceTiles.length).toBeGreaterThan(0);
      const ice = iceTiles[0];
      // A hazard that blocks movement would never touch a creature; black
      // ice must stay walkable.
      expect(ice.blocksMovement).toBe(false);
      expect(ice.environmentalEffect?.effect.name).toBe('Chilled');
      expect(ice.environmentalEffect?.effect.effect?.type).toBe('condition');
      // The canonical array is kept in step with the legacy single field.
      expect(ice.environmentalEffects?.[0]?.id).toBe(ice.environmentalEffect?.id);
      expect(mapData).not.toBeNull();

      // Drive the production seam: standing on the tile Chills the creature.
      const character = createMockCombatCharacter({ id: 'walker', name: 'Walker', conditions: [], statusEffects: [] });
      const handleDamage = vi.fn(() => character);
      const onLogEntry = vi.fn();

      const chilled = resolveTileEffects(
        { mapData: mapData!, handleDamage, onLogEntry } as any,
        character,
        ice.coordinates
      );

      expect(chilled.conditions?.map(c => c.name)).toContain('Chilled');
      expect(chilled.statusEffects.map(s => s.name)).toContain('Chilled');
      // The seam authors a rounds-duration record; the turn-end lifecycle
      // helper accepts it and the walker still carries the chill.
      const afterTurnEnd = advanceRuntimeStatusConditionsAtTurnEnd(chilled).character;
      expect(afterTurnEnd.conditions?.map(c => c.name)).toContain('Chilled');
    });
  });

  describe('source 3: monster ability', () => {
    it('the authored Hoarfrost Wraith exists in the monster registry', () => {
      const wraith = MONSTERS_DATA['hoarfrost_wraith'];
      expect(wraith).toBeDefined();
      expect(wraith!.abilities.map(a => a.id)).toContain('frost_talon');
      expect(wraith!.abilities.map(a => a.id)).toContain('grip_of_the_frozen_dark');
    });

    it('Frost Talon maps through AbilityEffectMapper to a Chilled condition command', async () => {
      const wraith = MONSTERS_DATA['hoarfrost_wraith'];
      const talon = wraith!.abilities.find(a => a.id === 'frost_talon')!;
      const statusPayload = talon.effects.find(effect => effect.type === 'status')!;

      const mapped = AbilityEffectMapper.mapToSpellEffect(statusPayload);
      expect(mapped?.type).toBe('STATUS_CONDITION');

      const command = new StatusConditionCommand(mapped as unknown as StatusConditionEffect, context);
      const afterUse = await command.execute(state);
      const carried = afterUse.characters.find(c => c.id === 'target')!;
      expect(carried.conditions?.map(c => c.name)).toContain('Chilled');

      const afterTurnEnd = advanceRuntimeStatusConditionsAtTurnEnd(carried).character;
      expect(afterTurnEnd.conditions?.map(c => c.name)).toContain('Chilled');
    });

    it('Grip of the Frozen Dark maps to a Frozen condition that survives the turn end', async () => {
      const wraith = MONSTERS_DATA['hoarfrost_wraith'];
      const grip = wraith!.abilities.find(a => a.id === 'grip_of_the_frozen_dark')!;
      const statusPayload = grip.effects.find(effect => effect.type === 'status')!;

      const mapped = AbilityEffectMapper.mapToSpellEffect(statusPayload) as SpellEffect;
      const command = new StatusConditionCommand(mapped as unknown as StatusConditionEffect, context);
      const afterUse = await command.execute(state);
      const carried = afterUse.characters.find(c => c.id === 'target')!;
      expect(carried.conditions?.map(c => c.name)).toContain('Frozen');
      expect(carried.statusEffects.map(s => s.name)).toContain('Frozen');

      const afterTurnEnd = advanceRuntimeStatusConditionsAtTurnEnd(carried).character;
      expect(afterTurnEnd.conditions?.map(c => c.name)).toContain('Frozen');
    });
  });
});
