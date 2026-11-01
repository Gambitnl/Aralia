// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 24/10/2026, 22:14:42
 * Dependents: components/Combat/InPlaceCombatScene.tsx, hooks/ability/execution/spellExecutionFlow.ts, hooks/ability/targetSelection.ts, hooks/ability/useAbilityExecution.ts, hooks/ability/useActionEconomy.ts, hooks/combat/actionExecutor/opportunityAttackFlow.ts, systems/combat/riderExtraStrikes.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Ability, CombatCharacter, Position, CombatAction, SelectedSpellTarget } from '../types/combat';
import { resolveScalableNumber } from '../types/spells';
import { generateId, getDistance } from '../utils/combat';

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

export { getZoneAreaFromAoEParams } from '../utils/spatial/targetingUtils';

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

// C11 (agora-9ed9.11): moved to systems/combat so riderExtraStrikes no longer
// imports hooks; re-exported here for the existing hook callers.
export { buildCommandGameState } from '../systems/combat/commandGameState';

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
    .filter(character => {
      // Automatic ray/missile expansion follows the relation chosen by the
      // player's first click. An enemy click fills remaining instances with
      // enemies; an ally click fills with allies. This prevents a legal-but-
      // unintended caster tile from consuming an attack before nearby targets.
      const matchesClickedRelation = character.team === clickedTarget.team
      const occupiesValidTarget = validTargetKeys.has(`${character.position.x}-${character.position.y}`)
      return matchesClickedRelation && occupiesValidTarget
    })
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
