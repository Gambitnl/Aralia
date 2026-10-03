/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 00:45:15
 * Dependents: components/CharacterSheet/Overview/index.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from 'react';
import { PlayerCharacter } from '../../../types';
/**
 * This file displays the core statistics and capabilities of a character.
 *
 * It renders a column in the character sheet overview showing:
 * - Vitals: hit points, speed, armor class, darkvision, proficiency bonus.
 * - Ability Scores: Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma, and their modifiers.
 * - Saving Throws: showing proficiency and calculated bonuses.
 * - Spell Slots: total and remaining pools per level.
 * - Spellcasting Stats: spellcasting ability, save DC, and attack bonus.
 * - Weapon Masteries: weapon mastery features.
 * - Senses, defenses, modifiers, traits, and general proficiencies in collapsible sections.
 *
 * Called by: CharacterSheetModal.tsx (Overview tab, column 1)
 * Depends on: utility functions for stats and proficiencies, feats data, and UI tooltips.
 */
interface CharacterOverviewProps {
    character: PlayerCharacter;
}
declare const CharacterOverview: React.FC<CharacterOverviewProps>;
export default CharacterOverview;
