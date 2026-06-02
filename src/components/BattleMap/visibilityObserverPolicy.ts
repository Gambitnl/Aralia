// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 18:40:55
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CombatCharacter } from '../../types/combat';

/**
 * This file names the current tactical-visibility viewpoint rule for the combat map.
 *
 * Light, darkness, and hidden-tile presentation needs to be identical in the 2D
 * and 3D maps. This helper keeps the current fallback order in one place so
 * future player-view, party-view, and developer/spectator decisions can change
 * the policy without letting the two renderers drift apart.
 *
 * Called by: BattleMap.tsx and BattleMap3D.tsx.
 * Depends on: combat characters, the selected map character, and the current turn.
 */

// ============================================================================
// Observer Selection Inputs
// ============================================================================
// This section describes the small amount of combat state needed to choose
// whose eyes the tactical visibility system should currently use.
// ============================================================================

export interface VisibilityObserverPolicyInput {
  selectedCharacterId?: string | null;
  currentCharacterId?: string | null;
  characters: CombatCharacter[];
}

export interface SharedSensesObserverState {
  controllerId: string;
  controllerName: string;
  observerId: string;
  observerName: string;
  sourceName: string;
}

export interface VisibilityObserverSelection {
  observerId: string | null;
  sharedSenses: SharedSensesObserverState | null;
}

// ============================================================================
// Current Visibility Viewpoint Policy
// ============================================================================
// This section preserves the map behavior that existed before the policy was
// named: prefer a selected creature, then the active turn creature, then the
// first player character, then any creature if the encounter has no player.
// ============================================================================

export function selectVisibilityObserver({
  selectedCharacterId,
  currentCharacterId,
  characters
}: VisibilityObserverPolicyInput): VisibilityObserverSelection {
  // Preserve the existing selected-character override. This may point at a
  // stale id if selection cleanup failed elsewhere. If the selected character
  // is actively using familiar senses, the tactical observer becomes that
  // familiar while the label still records who is controlling the view.
  if (selectedCharacterId) {
    return resolveObserverCandidate(selectedCharacterId, characters);
  }

  // Preserve the active-turn fallback so enemy turns and player turns continue
  // to use the same viewpoint behavior they had before this helper existed,
  // with shared-senses delegation layered on top instead of replacing the
  // broader fallback policy.
  if (currentCharacterId) {
    return resolveObserverCandidate(currentCharacterId, characters);
  }

  // Prefer a player character when no active creature has been selected. This
  // keeps generated previews and idle maps from defaulting to an enemy viewpoint
  // when a player-controlled creature exists.
  const firstPlayer = characters.find(character => character.team === 'player');
  if (firstPlayer) {
    return resolveObserverCandidate(firstPlayer.id, characters);
  }

  // If the encounter has no player-side creature, use the first available
  // creature so visibility still has a viewpoint in monster-only/dev scenarios.
  return characters[0]
    ? resolveObserverCandidate(characters[0].id, characters)
    : { observerId: null, sharedSenses: null };
}

export function selectVisibilityObserverId(input: VisibilityObserverPolicyInput): string | null {
  return selectVisibilityObserver(input).observerId;
}

function resolveObserverCandidate(candidateId: string, characters: CombatCharacter[]): VisibilityObserverSelection {
  const candidate = characters.find(character => character.id === candidateId);
  if (!candidate) {
    return { observerId: candidateId, sharedSenses: null };
  }

  const sharedSenses = getSharedSensesObserver(candidate, characters);
  if (sharedSenses) {
    return {
      observerId: sharedSenses.observerId,
      sharedSenses
    };
  }

  return {
    observerId: candidate.id,
    sharedSenses: null
  };
}

function getSharedSensesObserver(
  controller: CombatCharacter,
  characters: CombatCharacter[]
): SharedSensesObserverState | null {
  const sharedSensesEffect = controller.activeEffects?.find(effect =>
    effect.mechanics?.familiarSharedSenses &&
    typeof effect.mechanics.observerCharacterId === 'string'
  );

  const observerId = sharedSensesEffect?.mechanics?.observerCharacterId;
  const observer = observerId
    ? characters.find(character => character.id === observerId)
    : undefined;

  if (!sharedSensesEffect || !observerId || !observer) {
    return null;
  }

  return {
    controllerId: controller.id,
    controllerName: controller.name,
    observerId,
    observerName: observer.name,
    sourceName: sharedSensesEffect.sourceName
  };
}
