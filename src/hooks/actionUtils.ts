// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/06/2026, 11:58:02
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Ability, CombatCharacter, Position, CombatAction, BattleMapData } from '../types/combat';
import { resolveScalableNumber } from '../types/spells';
import { AoEParams } from '../utils/combat/aoeCalculations';
import { GameState } from '../types';
import { Plane } from '../types/planes';
import { generateId, getDistance } from '../utils/combatUtils';

export const buildAbilityCombatAction = (
  ability: Ability,
  caster: CombatCharacter,
  targetPosition: Position,
  targetCharacterIds: string[]
): CombatAction => ({
  id: generateId(),
  characterId: caster.id,
  type: 'ability',
  abilityId: ability.id,
  targetPosition,
  targetCharacterIds,
  cost: ability.cost,
  timestamp: Date.now()
});

export const getZoneAreaFromAoEParams = (
  areaOfEffect: { shape: string },
  aoeParams: AoEParams
): { shape: string; size: number } => ({
  shape: areaOfEffect.shape,
  size: aoeParams.size
});

export const applyResourceSnapshotToCaster = (
  finalCaster: CombatCharacter,
  resourceSnapshot: CombatCharacter
): CombatCharacter => ({
  ...finalCaster,
  actionEconomy: resourceSnapshot.actionEconomy,
  spellSlots: resourceSnapshot.spellSlots
});

export const replaceCasterForCommandState = (
  characters: CombatCharacter[],
  casterWithPaidCost: CombatCharacter
): CombatCharacter[] => {
  return characters.map(character => character.id === casterWithPaidCost.id ? casterWithPaidCost : character);
};

export const buildCommandGameState = (
  characters: CombatCharacter[],
  mapData: BattleMapData | null,
  currentPlane?: Plane
): GameState => ({
  characters,
  mapData: mapData ?? undefined,
  currentPlane
} as unknown as GameState);

export const resolveMultiTargetIds = (
  ability: Ability,
  caster: CombatCharacter,
  clickedTarget: CombatCharacter,
  characters: CombatCharacter[],
  getValidTargets: (ability: Ability, caster: CombatCharacter) => Position[]
): string[] => {
  const spellTargeting = ability.spell?.targeting;

  if (spellTargeting?.type !== 'multi') {
    return [clickedTarget.id];
  }

  const maxTargets = Math.max(1, resolveScalableNumber(spellTargeting.maxTargets, caster.level));
  const validTargetKeys = new Set(
    getValidTargets(ability, caster).map(position => `${position.x}-${position.y}`)
  );

  const orderedTargets = characters
    .filter(character => validTargetKeys.has(`${character.position.x}-${character.position.y}`))
    .sort((left, right) => {
      const leftDistance = getDistance(caster.position, left.position);
      const rightDistance = getDistance(caster.position, right.position);
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }
      return left.id.localeCompare(right.id);
    });

  const clickedFirst = [
    clickedTarget,
    ...orderedTargets.filter(character => character.id !== clickedTarget.id)
  ];

  return clickedFirst.slice(0, maxTargets).map(character => character.id);
};
