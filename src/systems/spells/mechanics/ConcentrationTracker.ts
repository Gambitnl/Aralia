// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 03:11:17
 * Dependents: systems/spells/mechanics/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Spell } from '@/types/spells'
import type { CombatCharacter, CombatState, ConcentrationState } from '@/types/combat'
import { rollSavingThrow } from '@/utils/character'

/**
 * Tracks concentration on spells
 *
 * D&D 5e concentration rules:
 * - Only one concentration spell active per character
 * - Broken by: taking damage, casting another concentration spell, being incapacitated, dying
 * - Concentration save DC = 10 or half damage taken (whichever is higher)
 */
export class ConcentrationTracker {
  /**
   * Check if character is concentrating on a spell
   *
   * @param character - Character to check
   * @param gameState - Current game state
   * @returns True if concentrating
   */
  static isConcentrating(
    character: CombatCharacter,
    // Game state is intentionally not required for this check; signature keeps callsites stable.
    _gameState: CombatState
  ): boolean {
    return !!character.concentratingOn
  }

  /**
   * Start concentrating on a spell (breaks existing concentration)
   *
   * @param character - Character concentrating
   * @param spell - Spell to concentrate on
   * @param gameState - Current game state
   * @returns New game state with concentration started
   */
  static startConcentration(
    character: CombatCharacter,
    spell: Spell,
    gameState: CombatState
  ): CombatState {
    // RALPH: Enforces the "One Concentration Spell" rule.
    // 1. Break existing concentration if any (clean up old effects).
    let currentState = gameState
    if (character.concentratingOn) {
      currentState = this.breakConcentration(character, gameState)
    }

    // 2. Create new concentration state
    // RALPH: Data object linking the caster to the spell ID.
    const concentrationState: ConcentrationState = {
      spellId: spell.id,
      spellName: spell.name,
      spellLevel: spell.level,
      startedTurn: currentState.turnState.currentTurn,
      effectIds: [], // Will be populated when effects are applied
      canDropAsFreeAction: true
    }

    // 3. Apply to character
    // RALPH: Immutable update pattern.
    // We map over the array to produce a NEW array with the modified character.
    const newCharacters = currentState.characters.map(c => {
      if (c.id === character.id) {
        return {
          ...c,
          concentratingOn: concentrationState
        }
      }
      return c
    })

    return {
      ...currentState,
      characters: newCharacters
    }
  }

  /**
   * Break concentration (e.g., took damage, failed save, chose to drop)
   *
   * @param character - Character whose concentration breaks
   * @param gameState - Current game state
   * @returns New game state with concentration broken
   */
  static breakConcentration(
    character: CombatCharacter,
    gameState: CombatState
  ): CombatState {
    if (!character.concentratingOn) {
      return gameState
    }

    const previousSpellId = character.concentratingOn.spellId;
    const previousSpellName = character.concentratingOn.spellName;
    const effectIdsToRemove = new Set(character.concentratingOn.effectIds);

    // 1. Update characters: remove linked status effects and clear concentratingOn
    const newCharacters = gameState.characters.map(c => {
      let newC = c;

      // Remove effects if any match
      if (c.statusEffects && c.statusEffects.length > 0) {
        const remainingEffects = c.statusEffects.filter(e => {
          const ownedSource = e.sourceCasterId === character.id && (
            e.sourceSpellId === previousSpellId ||
            e.source === previousSpellId ||
            e.source === previousSpellName
          );
          return !effectIdsToRemove.has(e.id) && !ownedSource;
        });
        if (remainingEffects.length !== c.statusEffects.length) {
          newC = {
            ...newC,
            statusEffects: remainingEffects
          };
        }
      }

      // Remove conditions if any match source
      if (c.conditions && c.conditions.length > 0) {
        const remainingConditions = c.conditions.filter(cond => {
          const sourceMatches = cond.source === previousSpellId || cond.source === previousSpellName;
          return !(sourceMatches && cond.sourceCasterId === character.id);
        });
        if (remainingConditions.length !== c.conditions.length) {
          newC = {
            ...newC,
            conditions: remainingConditions
          };
        }
      }

      // Remove concentration if it's the caster
      if (c.id === character.id) {
        newC = {
          ...newC,
          concentratingOn: undefined
        };
      }

      return newC;
    });

    let nextState: CombatState = {
      ...gameState,
      characters: newCharacters
    };

    // 2. Remove active spell zones (e.g. Flaming Sphere, Moonbeam, Darkness)
    if (nextState.spellZones) {
      nextState = {
        ...nextState,
        spellZones: nextState.spellZones.filter(
          zone => (zone.spellId !== previousSpellId || zone.casterId !== character.id) && !effectIdsToRemove.has(zone.id)
        )
      };
    }

    // 3. Remove active light sources
    if (nextState.activeLightSources) {
      nextState = {
        ...nextState,
        activeLightSources: nextState.activeLightSources.filter(
          ls => (ls.sourceSpellId !== previousSpellId || ls.casterId !== character.id) && !effectIdsToRemove.has(ls.id)
        )
      };
    }

    // 4. Remove active fire effects
    if (nextState.activeFireEffects) {
      nextState = {
        ...nextState,
        activeFireEffects: nextState.activeFireEffects.filter(
          fire => (fire.spellId !== previousSpellId || fire.casterId !== character.id) && !effectIdsToRemove.has(fire.id)
        )
      };
    }

    // 5. Remove active spell forces and guardians
    if (nextState.activeSpellForces) {
      nextState = {
        ...nextState,
        activeSpellForces: nextState.activeSpellForces.filter(
          force => (force.spellId !== previousSpellId || force.casterId !== character.id) && !effectIdsToRemove.has(force.id)
        )
      };
    }

    if (nextState.activeSpellGuardians) {
      nextState = {
        ...nextState,
        activeSpellGuardians: nextState.activeSpellGuardians.filter(
          guardian => (guardian.spellId !== previousSpellId || guardian.casterId !== character.id) && !effectIdsToRemove.has(guardian.id)
        )
      };
    }

    // 6. Remove active emanations and environmental controls
    if (nextState.activeSpellEmanations) {
      nextState = {
        ...nextState,
        activeSpellEmanations: nextState.activeSpellEmanations.filter(
          emanation => (emanation.spellId !== previousSpellId || emanation.casterId !== character.id) && !effectIdsToRemove.has(emanation.id)
        )
      };
    }

    if (nextState.activeEnvironmentalControls) {
      nextState = {
        ...nextState,
        activeEnvironmentalControls: nextState.activeEnvironmentalControls.filter(
          control => (control.spellId !== previousSpellId || control.casterId !== character.id) && !effectIdsToRemove.has(control.id)
        )
      };
    }

    return nextState;
  }

  /**
   * Roll concentration save after taking damage
   *
   * DC = 10 or half damage taken (whichever is higher)
   *
   * @param character - Character making the save
   * @param damage - Damage taken
   * @returns Save result
   */
  static rollConcentrationSave(
    character: CombatCharacter,
    damage: number
  ): { success: boolean; dc: number; roll: number } {
    const dc = Math.max(10, Math.floor(damage / 2))

    // Delegate to centralized saving throw utility to ensure proficiency and bonuses are applied correctly
    const result = rollSavingThrow(character, 'Constitution', dc)

    return {
      success: result.success,
      dc,
      roll: result.total
    }
  }
}
