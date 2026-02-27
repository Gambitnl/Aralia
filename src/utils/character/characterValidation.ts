// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:30:42
 * Dependents: character/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/characterValidation.ts
 * Utilities for validating character data and detecting missing choices
 * that may result from AI generation or legacy saves.
 */
import { PlayerCharacter, MissingChoice } from '../../types';
import { RACE_DATA_BUNDLE } from '../../data/races/index';
import { RELEVANT_SPELLCASTING_ABILITIES } from '../../data/dndData';

export const validateCharacterChoices = (character: PlayerCharacter): MissingChoice[] => {
  const missingChoices: MissingChoice[] = [];
  const { race, class: charClass, racialSelections, level = 1, spellbook } = character;

  // --- RACE VALIDATION ---
  
  // Dragonborn: Ancestry
  if (race.id === 'dragonborn' && !racialSelections?.dragonborn?.choiceId) {
    missingChoices.push({
      id: 'dragonborn_ancestry',
      label: 'Draconic Ancestry',
      description: 'You must choose a Draconic Ancestry, which determines your damage resistance and breath weapon type.',
      type: 'race',
      options: Object.values(RACE_DATA_BUNDLE.dragonbornAncestries).map(a => ({
        id: a.type,
        label: `${a.type} Dragon`,
        description: `Damage: ${a.damageType}`
      }))
    });
  }

  // Elf: Lineage
  if (race.id === 'elf' && !racialSelections?.elf?.choiceId && race.elvenLineages) {
     missingChoices.push({
        id: 'elf_lineage',
        label: 'Elven Lineage',
        description: 'You must choose a lineage (Drow, High Elf, or Wood Elf).',
        type: 'race',
        options: race.elvenLineages.map(l => ({
            id: l.id,
            label: l.name,
            description: l.description
        }))
     });
  }

  // Gnome: Subrace
  if (race.id === 'gnome' && !racialSelections?.gnome?.choiceId && race.gnomeSubraces) {
      missingChoices.push({
          id: 'gnome_subrace',
          label: 'Gnome Subrace',
          description: 'You must choose a subrace.',
          type: 'race',
          options: race.gnomeSubraces.map(s => ({
              id: s.id,
              label: s.name,
              description: s.description
          }))
      });
  }

  // Goliath: Giant Ancestry
  if (race.id === 'goliath' && !racialSelections?.goliath?.choiceId && race.giantAncestryChoices) {
       missingChoices.push({
          id: 'goliath_ancestry',
          label: 'Giant Ancestry',
          description: 'You must choose a supernatural boon from your ancestry.',
          type: 'race',
          options: race.giantAncestryChoices.map(a => ({
              id: a.id,
              label: a.name,
              description: a.description
          }))
      });
  }

  // Tiefling: Fiendish Legacy
  if (race.id === 'tiefling' && !racialSelections?.tiefling?.choiceId && race.fiendishLegacies) {
       missingChoices.push({
          id: 'tiefling_legacy',
          label: 'Fiendish Legacy',
          description: 'You must choose a legacy (Abyssal, Chthonic, or Infernal).',
          type: 'race',
          options: race.fiendishLegacies.map(l => ({
              id: l.id,
              label: l.name,
              description: l.description
          }))
      });
  }

  // Racial Spellcasting Ability Checks (Generic)
  // Check if race has a racialSpellChoice definition but no selection in state
  if (race.racialSpellChoice && !racialSelections?.[race.id]?.spellAbility) {
      missingChoices.push({
          id: 'racial_spell_ability',
          label: `${race.racialSpellChoice.traitName} Ability`,
          description: race.racialSpellChoice.traitDescription,
          type: 'race',
          options: RELEVANT_SPELLCASTING_ABILITIES.map(ability => ({
              id: ability,
              label: ability,
              description: 'Use this ability score for your racial spells.'
          }))
      });
  }
  
  // Specific checks for Elf/Gnome/Tiefling spell abilities if they made the main choice but missed the stat
  if (race.id === 'elf' && racialSelections?.elf?.choiceId && !racialSelections?.elf?.spellAbility) {
      missingChoices.push({
          id: 'racial_spell_ability',
          label: 'Lineage Spellcasting Ability',
          description: 'Choose the ability score for your Elven Lineage spells.',
          type: 'race',
          options: RELEVANT_SPELLCASTING_ABILITIES.map(ability => ({ id: ability, label: ability }))
      });
  }


  // --- SPELL VALIDATION ---
  
  // Check for missing racial spells based on level
  const knownCantrips = new Set(spellbook?.cantrips || []);
  const knownSpells = new Set([...(spellbook?.knownSpells || []), ...(spellbook?.preparedSpells || [])]);

  // Helper to check and add missing spell option
  const checkMissingSpell = (spellId: string, levelReq: number, sourceName: string, isCantrip: boolean) => {
      if (level >= levelReq) {
          const hasSpell = isCantrip ? knownCantrips.has(spellId) : knownSpells.has(spellId);
          if (!hasSpell) {
               missingChoices.push({
                  id: 'missing_racial_spell',
                  label: `Missing Spell: ${sourceName}`,
                  description: `Your ${sourceName} trait grants you the ${spellId.replace(/_/g, ' ')} spell, but it is missing from your spellbook.`,
                  type: 'race',
                  options: [{
                      id: spellId,
                      label: `Learn ${spellId.replace(/_/g, ' ')}`,
                      description: 'Add this spell to your known spells.',
                      isCantrip: isCantrip
                  }]
              });
          }
      }
  };

  // Dynamic check based on race data
  if (race.knownSpells) {
      race.knownSpells.forEach(s => {
         // We determine if it's a cantrip loosely based on level or if we had spell data. 
         // For validation, we assume level 1 spells might be cantrips or 1st level.
         // In the absence of full spell data, we check both lists or check based on known ID conventions.
         // A robust solution would pass spell data to this function, but for now we'll rely on the fact 
         // that checkMissingSpell checks the appropriate list based on the boolean flag.
         // We will guess isCantrip based on level 1 for now or specific IDs if known.
         // Or we can just check both lists inside checkMissingSpell if we merge the flag logic.
         
         // Simplification: Assume all racial spells < level 3 in this list are cantrips unless specified.
         // Actually, we can be explicit in data or just check hardcoded IDs for common cantrips.
         const isCantrip = ['druidcraft', 'produce-flame', 'acid-splash', 'shocking-grasp', 'light', 'mage-hand', 'blade-ward'].includes(s.spellId);
         checkMissingSpell(s.spellId, s.minLevel, race.name + ' Magic', isCantrip);
      });
  }
  
  // Tiefling (Based on Legacy)
  if (race.id === 'tiefling' && racialSelections?.tiefling?.choiceId) {
      const legacyId = racialSelections.tiefling.choiceId;
      const legacy = RACE_DATA_BUNDLE.tieflingLegacies.find(l => l.id === legacyId);
      if (legacy) {
          checkMissingSpell('thaumaturgy', 1, 'Otherworldly Presence', true);
          checkMissingSpell(legacy.level1Benefit.cantripId, 1, 'Fiendish Legacy', true);
          checkMissingSpell(legacy.level3SpellId, 3, 'Fiendish Legacy', false);
          checkMissingSpell(legacy.level5SpellId, 5, 'Fiendish Legacy', false);
      }
  }
  
  // Drow Elf
  if (race.id === 'elf' && racialSelections?.elf?.choiceId === 'drow') {
      checkMissingSpell('dancing_lights', 1, 'Drow Magic', true);
      checkMissingSpell('faerie_fire', 3, 'Drow Magic', false);
      checkMissingSpell('darkness', 5, 'Drow Magic', false);
  }
  
  // High Elf
  if (race.id === 'elf' && racialSelections?.elf?.choiceId === 'high_elf') {
      checkMissingSpell('prestidigitation', 1, 'Cantrip', true); // High Elf gets prestidigitation + 1 choice (choice hard to validate here)
      checkMissingSpell('detect_magic', 3, 'High Elf Magic', false);
      checkMissingSpell('misty_step', 5, 'High Elf Magic', false);
  }
  
   // Wood Elf
  if (race.id === 'elf' && racialSelections?.elf?.choiceId === 'wood_elf') {
      checkMissingSpell('druidcraft', 1, 'Wood Elf Magic', true);
      checkMissingSpell('longstrider', 3, 'Wood Elf Magic', false);
      checkMissingSpell('pass_without_trace', 5, 'Wood Elf Magic', false);
  }


  // --- CLASS VALIDATION ---

  // Fighter: Fighting Style
  if (charClass.id === 'fighter' && !character.selectedFightingStyle && charClass.fightingStyles) {
      missingChoices.push({
          id: 'fighting_style',
          label: 'Fighting Style',
          description: 'You must adopt a particular style of fighting.',
          type: 'class',
          options: charClass.fightingStyles.map(s => ({
              id: s.id,
              label: s.name,
              description: s.description
          }))
      });
  }

  // Cleric: Divine Order
  if (charClass.id === 'cleric' && !character.selectedDivineOrder && charClass.divineOrders) {
       missingChoices.push({
          id: 'divine_order',
          label: 'Divine Order',
          description: 'You must dedicate yourself to a sacred role.',
          type: 'class',
          options: charClass.divineOrders.map(o => ({
              id: o.id,
              label: o.name,
              description: o.description
          }))
      });
  }
  
  // Druid: Primal Order
  if (charClass.id === 'druid' && !character.selectedDruidOrder && charClass.primalOrders) {
       missingChoices.push({
          id: 'primal_order',
          label: 'Primal Order',
          description: 'You must dedicate yourself to a sacred role.',
          type: 'class',
          options: charClass.primalOrders.map(o => ({
              id: o.id,
              label: o.name,
              description: o.description
          }))
      });
  }

  return missingChoices;
};
