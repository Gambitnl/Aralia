/**
 * Edge-of-map escape for combat encounters (MOD-3.10 split out of useTurnManager,
 * where it was already delimited by its own comment banner).
 *
 * The escape RULE lives in the pure `battlefieldEscape` referee; this hook owns
 * only the consequences inside a live encounter — charge the movement, log the
 * flight, and reuse the caller's existing removal path.
 *
 * useTurnManager calls this at the EXACT position canEscapeFromCombat and
 * escapeFromCombat used to occupy in its body, so React's hook-call order is
 * unchanged by the split.
 *
 * Called by: hooks/combat/useTurnManager.ts (its only intended caller).
 *
 * @file hooks/combat/turnManager/useCombatEscape.ts
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:54:08
 * Dependents: hooks/combat/useTurnManager.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback } from 'react';
import { CombatCharacter, CombatLogEntry, BattleMapData } from '../../../types/combat';
import { generateId } from '../../../utils/combat';
import {
  applyEscapeMovementCost,
  evaluateEscape,
  type EscapeVerdict,
} from '../../../systems/combat/fightInPlace/battlefieldEscape';

export interface UseCombatEscapeProps {
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  /** useTurnManager's concentration/grapple-aware character publish path. */
  handleCharacterUpdateWrapped: (character: CombatCharacter) => void;
  onLogEntry: (entry: CombatLogEntry) => void;
  /** The EXISTING mid-turn departure path, so escape advances the group identically. */
  removeCharacterFromCombat: (characterId: string) => void;
}

export const useCombatEscape = ({
  characters,
  mapData,
  handleCharacterUpdateWrapped,
  onLogEntry,
  removeCharacterFromCombat
}: UseCombatEscapeProps) => {
  // ==========================================================================
  // Edge-of-map escape (9B)
  // ==========================================================================
  // Fleeing is the third exit from a fight, beside victory and defeat. The rule
  // itself (at the rim, full movement action unspent) lives in the pure
  // `battlefieldEscape` referee so the 3D scene, the 2D board, and this hook
  // cannot disagree; the turn manager owns only the consequences — charge the
  // movement, log the departure, and reuse the EXISTING removal path so the
  // active group advances exactly as it does for any other mid-turn departure.
  // ==========================================================================

  /** Rule whether one combatant may flee right now. Pure read; no state change. */
  const canEscapeFromCombat = useCallback((characterId: string): EscapeVerdict => {
    const character = characters.find(candidate => candidate.id === characterId);
    if (!character) {
      return {
        available: false,
        code: 'no-map',
        reason: 'That combatant is not in this encounter.',
        tilesFromEdge: null,
        movementCostFeet: 0,
        contested: false,
      };
    }
    return evaluateEscape({ mapData, character });
  }, [characters, mapData]);

  /**
   * Resolve an escape: spend the whole movement action, log the flight, and
   * remove the combatant. Returns the verdict so a caller can surface a refusal
   * instead of silently doing nothing.
   */
  const escapeFromCombat = useCallback((characterId: string): EscapeVerdict => {
    const character = characters.find(candidate => candidate.id === characterId);
    const verdict = canEscapeFromCombat(characterId);
    if (!verdict.available || !character) return verdict;

    // Charge the cost BEFORE removal so the spent economy is visible in any
    // receipt or replay that snapshots the character on its way out.
    handleCharacterUpdateWrapped(applyEscapeMovementCost(character));

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'status',
      message: `${character.name} flees the battlefield, spending ${verdict.movementCostFeet} ft of movement to escape.`,
      characterId,
      data: { escape: 'edge-of-map', movementCostFeet: verdict.movementCostFeet },
    });

    removeCharacterFromCombat(characterId);
    return verdict;
  }, [canEscapeFromCombat, characters, handleCharacterUpdateWrapped, onLogEntry, removeCharacterFromCombat]);

  return {
    canEscapeFromCombat,
    escapeFromCombat
  };
};
