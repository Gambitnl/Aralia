// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 17:53:16
 * Dependents: components/DesignPreview/steps/scenarioControls/spellTargetRestrictionsScenarioControls.ts, hooks/useAbilitySystem.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {
  BattleMapData,
  CombatCharacter,
  CombatState,
  SelectedSpellTarget,
  TargetableMapObject,
} from '../../../types/combat';
import type { Spell } from '../../../types/spells';
import {
  isScalableNumberObject,
  resolveScalableNumber,
} from '../../../types/spells';
import { TargetResolver } from './TargetResolver';

/**
 * This file validates a complete spell-target selection before combat pays for it.
 *
 * A map click historically validated one creature, but direct callers could pass
 * duplicates, too many targets, or an invalid object straight to ability execution.
 * This gate checks the whole selected envelope with TargetResolver and returns one
 * stable player-facing reason before the Action, slot, event claim, commands, or dice.
 *
 * Called by: useAbilitySystem and focused Tactical Sandbox proof.
 * Depends on: canonical spell metadata, TargetResolver, and live combat/map records.
 */

// ============================================================================
// Public Selection Contract
// ============================================================================
// The result stays intentionally small so UI, AI, and direct runtime callers can
// share the same rejection without learning how each target kind is validated.
// ============================================================================

export interface SpellTargetSelectionRejection {
  code: string;
  message: string;
}

export interface ValidateSpellTargetSelectionInput {
  spell: Spell;
  caster: CombatCharacter;
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  selectedTargets: SelectedSpellTarget[];
  castLevel?: number;
}

// ============================================================================
// Canonical Target Count
// ============================================================================
// Fixed caps are read directly. Scaled caps use slot level when the metadata says
// slot level, and character level otherwise, so an upcast never borrows caster level.
// ============================================================================

function getMaximumTargets(
  spell: Spell,
  caster: CombatCharacter,
  castLevel: number | undefined,
): number {
  if (spell.targeting.type !== 'multi') return 1;

  const count = spell.targeting.maxTargets;
  const level = isScalableNumberObject(count) && count.scaling.type === 'slot_level'
    ? castLevel ?? spell.level
    : caster.level;
  return Math.max(1, resolveScalableNumber(count, level));
}

function getSelectionKey(target: SelectedSpellTarget): string {
  // Creature and object identity must be unique. Point selections use coordinates
  // because they do not have a registry id.
  if (target.kind === 'point') {
    return `point:${target.position.x}:${target.position.y}:${target.purpose ?? ''}`;
  }
  return `${target.kind}:${target.id}`;
}

// ============================================================================
// Complete Pre-Payment Validation
// ============================================================================
// Every concrete creature or object delegates its range, sight, cover, relation,
// willingness, taxonomy, and object eligibility to TargetResolver. This function
// owns only whole-selection facts: presence, uniqueness, and the authored cap.
// ============================================================================

export function validateSpellTargetSelection({
  spell,
  caster,
  characters,
  mapData,
  selectedTargets,
  castLevel,
}: ValidateSpellTargetSelectionInput): SpellTargetSelectionRejection | null {
  const targeting = spell.targeting;

  // Area and point spells use their dedicated geometry/placement paths. This gate
  // deliberately covers explicit self, single, and multi entity selections only.
  if (targeting.type !== 'self' && targeting.type !== 'single' && targeting.type !== 'multi') {
    return null;
  }

  if (selectedTargets.length === 0) {
    return { code: 'target_required', message: `${spell.name} requires a target.` };
  }

  const selectionKeys = selectedTargets.map(getSelectionKey);
  if (new Set(selectionKeys).size !== selectionKeys.length) {
    return {
      code: 'duplicate_target',
      message: `${spell.name} cannot select the same target more than once.`,
    };
  }

  const maximumTargets = getMaximumTargets(spell, caster, castLevel);
  if (selectedTargets.length > maximumTargets) {
    return {
      code: 'too_many_targets',
      message: `${spell.name} allows at most ${maximumTargets} target${maximumTargets === 1 ? '' : 's'} for this cast.`,
    };
  }

  const gameState: CombatState = {
    isActive: true,
    characters,
    turnState: {
      currentTurn: 0,
      turnOrder: characters.map(character => character.id),
      currentCharacterId: caster.id,
      phase: 'planning',
      actionsThisTurn: [],
    },
    selectedCharacterId: caster.id,
    selectedAbilityId: null,
    actionMode: 'select',
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers: [],
    activeLightSources: [],
    mapData: mapData ?? undefined,
  };

  for (const selectedTarget of selectedTargets) {
    if (selectedTarget.kind === 'point') {
      return {
        code: 'entity_target_required',
        message: `${spell.name} requires a creature or object target, not an empty point.`,
      };
    }

    if (selectedTarget.kind === 'creature') {
      const target = characters.find(character => character.id === selectedTarget.id);
      if (!target) {
        return {
          code: 'missing_target',
          message: `${spell.name} cannot find creature target ${selectedTarget.id}.`,
        };
      }

      const rejection = TargetResolver.getTargetRejectionReason(
        targeting,
        caster,
        target,
        gameState,
      );
      if (rejection) return rejection;
      continue;
    }

    const mapObject = (mapData?.targetableObjects ?? []).find(
      targetObject => targetObject.id === selectedTarget.id,
    );
    const selectedObject = selectedTarget.object
      ? {
          ...selectedTarget.object,
          id: selectedTarget.id,
          name: selectedTarget.name ?? selectedTarget.id,
          position: selectedTarget.position,
        }
      : mapObject;

    if (!selectedObject) {
      return {
        code: 'missing_object',
        message: `${spell.name} cannot find object target ${selectedTarget.id}.`,
      };
    }

    const rejection = TargetResolver.getObjectTargetRejectionReason(
      targeting,
      caster,
      selectedObject as TargetableMapObject,
      gameState,
    );
    if (rejection) return rejection;
  }

  return null;
}
