/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/arcaneGlyphSystem.ts
 * Implements mechanics for magical traps (Glyphs), using Arcana for detection and disarming.
 */

import { PlayerCharacter } from '../../types/character';
import { rollDice } from '../../utils/combatUtils';
import { getAbilityModifierValue } from '../../utils/statUtils';
import { Trap, TrapDetectionResult, TrapDisarmResult } from './types';

const getLegacyStats = (character: PlayerCharacter) => ({
  strength: character.stats?.strength ?? character.finalAbilityScores?.Strength ?? character.abilityScores.Strength,
  dexterity: character.stats?.dexterity ?? character.finalAbilityScores?.Dexterity ?? character.abilityScores.Dexterity,
  constitution: character.stats?.constitution ?? character.finalAbilityScores?.Constitution ?? character.abilityScores.Constitution,
  intelligence: character.stats?.intelligence ?? character.finalAbilityScores?.Intelligence ?? character.abilityScores.Intelligence,
  wisdom: character.stats?.wisdom ?? character.finalAbilityScores?.Wisdom ?? character.abilityScores.Wisdom,
  charisma: character.stats?.charisma ?? character.finalAbilityScores?.Charisma ?? character.abilityScores.Charisma,
});

const getClasses = (character: PlayerCharacter) => character.classes ?? (character.class ? [character.class] : []);

/**
 * Checks if a character has proficiency with Arcana.
 * @param character The character to check.
 */
function hasArcanaProficiency(character: PlayerCharacter): boolean {
  // Logic simplified for MVP: Classes with access to magical knowledge.
  return getClasses(character).some(c =>
    ['Wizard', 'Sorcerer', 'Warlock', 'Bard', 'Druid', 'Cleric'].includes(c.name)
  );
}

/**
 * Attempts to detect a magical glyph or ward.
 * Uses Intelligence (Arcana) or Intelligence (Investigation) if specifically looking for faint runes.
 * Magical traps are often invisible until detected.
 */
export function detectGlyph(
  character: PlayerCharacter,
  glyph: Trap
): TrapDetectionResult {
  if (glyph.isDisarmed || glyph.isTriggered) {
    return { success: true, margin: 0, trapDetected: true };
  }

  // Only allow detection if it's actually a magical trap
  if (glyph.type !== 'magical') {
     // If passed a mechanical trap, fallback to standard logic (simulated fail here or logic separation)
     // Ideally, the calling code routes to detectTrap for mechanical and detectGlyph for magical.
     return { success: false, margin: 0, trapDetected: false };
  }

  const stats = getLegacyStats(character);
  const intMod = getAbilityModifierValue(stats.intelligence); // Arcana is Int-based
  const wisMod = getAbilityModifierValue(stats.wisdom); // Perception to notice shimmering air

  // Arcana is usually the primary skill for magical detection via "Detect Magic" or studying runes.
  // Perception can spot the visual distortion.

  const isProficient = hasArcanaProficiency(character);
  const profBonus = isProficient ? (character.proficiencyBonus ?? 0) : 0;

  // We use the better of Arcana (Int) or Perception (Wis) to NOTICE it.
  // But identifying it as a glyph usually requires Arcana.
  const checkMod = Math.max(intMod, wisMod);

  const d20 = rollDice('1d20');
  const total = d20 + checkMod + profBonus;

  const success = total >= glyph.detectionDC;

  return {
    success,
    margin: total - glyph.detectionDC,
    trapDetected: success
  };
}

/**
 * Attempts to disarm (abjure/suppress) a magical glyph.
 * Requires Intelligence (Arcana). Thieves' Tools are useless here.
 */
export function disarmGlyph(
  character: PlayerCharacter,
  glyph: Trap
): TrapDisarmResult {
   if (glyph.isDisarmed) {
     return { success: true, margin: 0, triggeredTrap: false };
   }

   if (glyph.type !== 'magical') {
       return { success: false, margin: -10, triggeredTrap: false };
   }

   // Thieves tools don't help. This is pure magical theory.
   const stats = getLegacyStats(character);
   const intMod = getAbilityModifierValue(stats.intelligence);
   const isProficient = hasArcanaProficiency(character);
   const profBonus = isProficient ? (character.proficiencyBonus ?? 0) : 0;

   // Non-proficient characters might have Disadvantage or be unable to attempt?
   // For MVP, we allow attempt but they lack the bonus.

   const d20 = rollDice('1d20');
   const total = d20 + intMod + profBonus;

   const success = total >= glyph.disarmDC;
   const margin = total - glyph.disarmDC;

   // Fail by more than 5 triggers the glyph immediately
   const triggeredTrap = !success && margin < -5;

   return {
     success,
     margin,
     triggeredTrap,
     trapEffect: triggeredTrap ? glyph.effect : undefined
   };
}

/**
 * Attempts to identify the nature of the glyph without triggering it.
 * Returns a hint about the effect (e.g., "It radiates evocation magic" -> Fire/Explosion).
 */
export function identifyGlyphSchool(
    character: PlayerCharacter,
    glyph: Trap
): string | null {
    if (!glyph.effect) return null;

    const stats = getLegacyStats(character);
    const intMod = getAbilityModifierValue(stats.intelligence);
    const isProficient = hasArcanaProficiency(character);
    const profBonus = isProficient ? (character.proficiencyBonus ?? 0) : 0;

    // DC is usually lower than Disarm but higher than Detect?
    // Let's assume DC = detectionDC + 2
    const identifyDC = glyph.detectionDC + 2;

    const total = rollDice('1d20') + intMod + profBonus;

    if (total >= identifyDC) {
        // Map effect types to Schools of Magic flavor text
        if (glyph.effect.damageType === 'fire' || glyph.effect.damageType === 'lightning' || glyph.effect.damageType === 'cold') {
            return 'Evocation (Elemental Energy)';
        }
        if (glyph.effect.type === 'teleport') {
            return 'Conjuration (Teleportation)';
        }
        if (glyph.effect.type === 'restrain') {
            return 'Transmutation (Binding)';
        }
        if (glyph.effect.type === 'condition' && (glyph.effect.condition?.name === 'Fear' || glyph.effect.condition?.name === 'Charmed')) {
            return 'Enchantment (Mind Affecting)';
        }
        if (glyph.effect.type === 'condition' && glyph.effect.condition?.name === 'Invisible') { // Unlikely for a trap, but possible
             return 'Illusion';
        }
        if (glyph.effect.damageType === 'necrotic') {
            return 'Necromancy';
        }
        return 'Abjuration (Warding)';
    }

    return null;
}

// TODO(Lockpick): Integrate Arcane Glyphs with the Spell System to allow 'Dispel Magic' to automatically trigger disarmGlyph.
