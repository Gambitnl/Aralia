/**
 * @file src/components/CharacterCreator/hooks/useCharacterAssembly.ts
 * Custom hook for character assembly logic during creation.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 12:34:50
 * Dependents: components/CharacterCreator/CharacterCreator.tsx, components/CharacterCreator/NameAndReview.tsx, systems/party/authoredCompanionCapabilities.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback } from 'react';
import type { PlayerCharacter, Item } from '../../../types';
import { buildStartingLoadout } from '../../../systems/character/buildStartingLoadout';
import { assemblePlayerCharacter } from '../../../systems/character/characterAssembly';
import { CharacterCreationState } from '../state/characterCreatorState';

// The pure assembly functions and types moved to systems/character/characterAssembly.ts
// on 2026-11-02 (GG-587, lint rule C11). Only the React hook stays here; the re-export
// keeps every existing caller working.
export * from '../../../systems/character/characterAssembly';

// --- Hook ---
interface UseCharacterAssemblyProps {
  onCharacterCreate: (character: PlayerCharacter, startingInventory: Item[]) => void;
}

export function useCharacterAssembly({ onCharacterCreate }: UseCharacterAssemblyProps) {
  const generatePreviewCharacter = useCallback((currentState: CharacterCreationState, currentName: string): PlayerCharacter | null => {
    return assemblePlayerCharacter(currentState, currentName);
  }, []);

  // Returns true when the character was successfully assembled and submitted,
  // false when assembly failed. Callers must check this before doing anything
  // destructive (e.g. clearing the saved draft) — a failed submit must not
  // silently discard the player's in-progress work.
  const assembleAndSubmitCharacter = useCallback((currentState: CharacterCreationState, name: string): boolean => {
    const character = generatePreviewCharacter(currentState, name);
    if (character) {
      // The assembled character already carries its equipped gear + starting gold
      // (set in assemblePlayerCharacter); build the matching inventory (backup
      // weapons, packs, ammunition, provisions, background keepsakes) to hand over.
      const { inventory: startingInventory } = buildStartingLoadout({
        classId: character.class.id,
        background: currentState.selectedBackground,
        weaponMasteryIds: currentState.selectedWeaponMasteries || [],
      });

      onCharacterCreate(character, startingInventory);
      return true;
    }
    console.error("Character assembly failed in useCharacterAssembly. Cannot submit.");
    return false;
  }, [onCharacterCreate, generatePreviewCharacter]);

  return { assembleAndSubmitCharacter, generatePreviewCharacter };
}
