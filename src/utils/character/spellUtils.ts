// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:07
 * Dependents: character/index.ts, spellUtils.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/spellUtils.ts
 * This file contains utility functions related to player character spellcasting.
 */
import { PlayerCharacter, Spell } from '../../types';
import { getRacialSpellGrantsForCharacter } from './characterUtils';

interface CharacterSpells {
  cantrips: Spell[];
  spells: Spell[];
}

/**
 * Gets a character's complete list of known cantrips and spells from all sources.
 * This is the new single source of truth for spell aggregation.
 * @param {PlayerCharacter} character - The character object.
 * @param {Record<string, Spell>} allSpellsData - A map of all spells in the game.
 * @returns {CharacterSpells} An object containing arrays of final cantrips and spells.
 */
export function getCharacterSpells(character: PlayerCharacter, allSpellsData: Record<string, Spell>): CharacterSpells {
  const cantripSet = new Set<Spell>();
  const spellSet = new Set<Spell>();

  // 1. Get spells from class spellbook
  if (character.spellbook) {
    character.spellbook.cantrips.forEach(id => {
      const spell = allSpellsData[id];
      if (spell) cantripSet.add(spell);
    });
    
    const allClassSpellIds = [
      ...(character.spellbook.knownSpells || []),
      ...(character.spellbook.preparedSpells || []),
    ];
    
    [...new Set(allClassSpellIds)].forEach(id => {
      const spell = allSpellsData[id];
      if (spell) {
        if (spell.level === 0) {
            // Check if character is a prepared caster class (simplified check)
            const isPreparedClass = ['cleric', 'druid', 'paladin', 'artificer'].includes(character.class.id);
            if (!isPreparedClass) {
                cantripSet.add(spell);
            }
        }
        else {
            spellSet.add(spell);
        }
      }
    });
  }

  // 2. Get spells from racial traits (Dynamic)
  const racialGrants = getRacialSpellGrantsForCharacter(character, character.level || 1);
  racialGrants.forEach((grant) => {
    const spell = allSpellsData[grant.spellId];
    if (!spell) return;
    if (spell.level === 0) {
      cantripSet.add(spell);
    } else {
      spellSet.add(spell);
    }
  });
  
  const finalCantrips = Array.from(cantripSet).sort((a, b) => a.name.localeCompare(b.name));
  const finalSpells = Array.from(spellSet).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  return { cantrips: finalCantrips, spells: finalSpells };
}
