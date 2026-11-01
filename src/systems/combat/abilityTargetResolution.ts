/**
 * Selects legal area targets and executable spell control options without React.
 * The ability hook and its existing exports delegate here; prompts, costs and
 * random target allocation stay with their current owners. Visibility uses the
 * same resolver and long-range override as before, including legacy extra fields.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 21:53:10
 * Dependents: hooks/ability/useAbilityExecution.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CombatCharacter, Position, BattleMapData, CombatState, SelectedSpellTarget } from '../../types/combat';
import type { Spell, UtilityEffect } from '../../types/spells';
import { isExecutableControlOption } from '../../types/spells';
import { calculateAffectedTiles } from '../../utils/combat/aoeCalculations';
import { resolveAoEParams } from '../../utils/spatial/targetingUtils';
import { TargetResolver } from '../spells/targeting/TargetResolver';

export interface AreaTargetResolutionInput {
  spell: Spell;
  caster: CombatCharacter;
  targetPosition: Position;
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  selectedSpellTargets?: SelectedSpellTarget[];
}

export interface AreaTargetResolutionResult {
  targetCharacterIds: string[];
  selectedSpellTargets: SelectedSpellTarget[];
}

export const getSpellControlOptions = (spell: Spell): NonNullable<UtilityEffect['controlOptions']> => {
  return spell.effects.flatMap(effect => {
    if (effect.type !== 'UTILITY') {
      return [];
    }
    return ((effect as UtilityEffect).controlOptions ?? []).filter(isExecutableControlOption);
  });
};

const isCreatureSelectedSpellTarget = (
  selectedTarget: SelectedSpellTarget
): selectedTarget is Extract<SelectedSpellTarget, { kind: 'creature' }> => selectedTarget.kind === 'creature';

const buildVisibilityCheckState = (
  characters: CombatCharacter[],
  mapData: BattleMapData | null
): CombatState => ({
  isActive: true,
  characters,
  turnState: {
    currentTurn: 0,
    turnOrder: [],
    currentCharacterId: null,
    phase: 'planning',
    actionsThisTurn: []
  },
  selectedCharacterId: null,
  selectedAbilityId: null,
  actionMode: 'select',
  validTargets: [],
  validMoves: [],
  combatLog: [],
  reactiveTriggers: [],
  activeLightSources: [],
  mapData: mapData ?? undefined
});

const canSelectAreaCreature = (
  spell: Spell,
  caster: CombatCharacter,
  target: CombatCharacter,
  characters: CombatCharacter[],
  mapData: BattleMapData | null
): boolean => {
  const requiresVisibleSelection = spell.targeting.areaTargetSelection?.requiresLineOfSight ?? spell.targeting.lineOfSight;
  if (!requiresVisibleSelection) {
    return true;
  }

  const visibilityOverride = {
    ...spell.targeting,
    range: Math.max(('range' in spell.targeting ? spell.targeting.range : 0) ?? 0, 9999)
  };

  return TargetResolver.getTargetRejectionReason(
    visibilityOverride,
    caster,
    target,
    buildVisibilityCheckState(characters, mapData)
  ) === null;
};

/**
 * Resolves which creatures within an area of effect are legally targeted by an area spell.
 */
export const resolveAreaTargetSelection = ({
  spell,
  caster,
  targetPosition,
  characters,
  mapData,
  selectedSpellTargets
}: AreaTargetResolutionInput): AreaTargetResolutionResult => {
  const areaOfEffect = 'areaOfEffect' in spell.targeting ? spell.targeting.areaOfEffect : undefined;
  const params = areaOfEffect ? resolveAoEParams(areaOfEffect, targetPosition, caster, spell.name) : null;

  if (!params) {
    return {
      targetCharacterIds: [],
      selectedSpellTargets: []
    };
  }

  const affectedTiles = calculateAffectedTiles(params);
  const affectedCharacters = characters.filter(character =>
    affectedTiles.some(tile => tile.x === character.position.x && tile.y === character.position.y)
  );

  const explicitCreatureTargets = (selectedSpellTargets ?? []).filter(isCreatureSelectedSpellTarget);
  const explicitCreatureIds = new Set(explicitCreatureTargets.map(target => target.id));
  const hasExplicitCasterChoice = spell.targeting.areaTargetSelection?.mode === 'caster_choice' &&
    explicitCreatureTargets.some(target => target.id !== caster.id);

  const visibleCandidates = affectedCharacters.filter(character => {
    // Sword Burst is self-centered and should not hit the caster.
    if (
      spell.range.type === 'self' &&
      !spell.targeting.areaTargetSelection &&
      character.id === caster.id
    ) {
      return false;
    }

    return canSelectAreaCreature(spell, caster, character, characters, mapData);
  });

  const finalCharacters = hasExplicitCasterChoice
    ? visibleCandidates.filter(character => explicitCreatureIds.has(character.id))
    : visibleCandidates;

  const resolvedSelectedSpellTargets = hasExplicitCasterChoice
    ? explicitCreatureTargets.filter(target => finalCharacters.some(character => character.id === target.id))
    : finalCharacters.map(character => ({ kind: 'creature', id: character.id } as SelectedSpellTarget));

  return {
    targetCharacterIds: finalCharacters.map(character => character.id),
    selectedSpellTargets: resolvedSelectedSpellTargets
  };
};

