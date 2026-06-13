// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 21:39:59
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Ability, CombatCharacter, Position, CombatAction, BattleMapData, SelectedSpellTarget } from '../types/combat';
import { resolveScalableNumber } from '../types/spells';
import { AoEParams } from '../utils/combat/aoeCalculations';
import { GameState } from '../types';
import { Plane } from '../types/planes';
import { generateId, getDistance } from '../utils/combatUtils';

export const buildAbilityCombatAction = (
  ability: Ability,
  caster: CombatCharacter,
  targetPosition: Position,
  targetCharacterIds: string[],
  selectedSpellTargets?: SelectedSpellTarget[]
): CombatAction => ({
  // Legacy action identity stays unchanged so turn management, logs, and action
  // economy keep recognizing this as the same ability execution event.
  id: generateId(),
  characterId: caster.id,
  type: 'ability',
  abilityId: ability.id,
  // The clicked position remains the old map-coordinate handoff. Point spells
  // and teleport destinations still rely on it until command creation consumes
  // the richer selectedSpellTargets envelope directly.
  targetPosition,
  targetCharacterIds,
  // Creature-only spells get a compatible envelope automatically. Object and
  // ground-target callers can pass explicit refs without fabricating creature IDs.
  selectedSpellTargets: selectedSpellTargets ?? targetCharacterIds.map(id => ({ kind: 'creature', id })),
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
