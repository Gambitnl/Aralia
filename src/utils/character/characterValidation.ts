// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:30:42
 * Dependents: character/index.ts
 * Imports: 4 files
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
import { getRacialSpellCastingAbilityChoicesForRace, getRacialChoiceRequirementsForRace } from '../../data/races';
import { RELEVANT_SPELLCASTING_ABILITIES } from '../../data/dndData';
import { SKILLS_DATA } from '../../data/skills';
import { FEATS_DATA } from '../../data/feats/featsData';
import { getRacialSpellGrantsForCharacter } from './characterUtils';

export const validateCharacterChoices = (character: PlayerCharacter): MissingChoice[] => {
  const missingChoices: MissingChoice[] = [];
  const { race, class: charClass, racialSelections, level = 1, spellbook } = character;

  // --- RACE VALIDATION ---
  
  // Generic Racial Choice Detector
  // This uses the expanded parser in racialTraits.ts to find all choice requirements
  const racialChoiceRequirements = getRacialChoiceRequirementsForRace(race.id);
  racialChoiceRequirements.forEach(req => {
    if (req.type === 'skillChoice') {
      const selections = racialSelections?.[race.id];
      const selectedSkillIds = selections?.skillIds || [];
      if (selectedSkillIds.length < (req.skillCount || 1)) {
        // Populate all skills as options for the resolution modal
        const skillOptions = Object.entries(SKILLS_DATA).map(([id, skill]) => ({
          id,
          label: skill.name,
          description: '' // Skill type has no description field yet (see src/data/skills/index.ts TODO)
        }));

        missingChoices.push({
          id: req.id,
          label: req.sourceTraitName,
          description: req.sourceTraitDescription,
          type: 'race',
          options: skillOptions
        });
      }
    } else if (req.type === 'featChoice') {
      const selections = racialSelections?.[race.id];
      // Check if a feat choice exists in selections or if character has any feat at level 1
      if (!selections?.choiceId && (!character.feats || character.feats.length === 0)) {
        // Origin feats (2024 rules)
        const originFeatIds = ['alert', 'crafter', 'healer', 'lucky', 'magic_initiate', 'musician', 'savage_attacker', 'skilled', 'tough'];
        const featOptions = originFeatIds.map(id => {
          const feat = FEATS_DATA.find(f => f.id === id);
          return {
            id,
            label: feat?.name || id,
            description: feat?.description
          };
        });

        missingChoices.push({
          id: req.id,
          label: req.sourceTraitName,
          description: req.sourceTraitDescription,
          type: 'race',
          options: featOptions
        });
      }
    }
  });

  // Dragonborn: Ancestry (Legacy/Specific check)
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

  // Elf: Lineage (Legacy/Specific check)
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
  const raceSpellAbilityChoices = getRacialSpellCastingAbilityChoicesForRace(race.id);
  if (raceSpellAbilityChoices.length > 0 && !racialSelections?.[race.id]?.spellAbility) {
      const sourceChoice = raceSpellAbilityChoices[0];
      missingChoices.push({
          id: 'racial_spell_ability',
          label: `${sourceChoice.sourceTraitName} Ability`,
          description: sourceChoice.sourceTraitDescription,
          type: 'race',
          options: RELEVANT_SPELLCASTING_ABILITIES.map(ability => ({
              id: ability,
              label: ability,
              description: 'Use this ability score for your racial spells.'
          }))
      });
  }

  // --- SPELL VALIDATION ---
  
  // Check for missing racial spells based on level
  const knownCantrips = new Set(spellbook?.cantrips || []);
  const knownSpells = new Set([...(spellbook?.knownSpells || []), ...(spellbook?.preparedSpells || [])]);

  // Helper to check and add missing spell option
  const checkMissingSpell = (spellId: string, levelReq: number, sourceName: string, isCantrip: boolean) => {
      if (!spellId) return;
      if (level >= levelReq) {
          const spellIdUnderscore = spellId.replace(/-/g, '_');
          const spellIdHyphen = spellId.replace(/_/g, '-');
          
          const hasSpell = isCantrip 
              ? (knownCantrips.has(spellIdUnderscore) || knownCantrips.has(spellIdHyphen))
              : (knownSpells.has(spellIdUnderscore) || knownSpells.has(spellIdHyphen));

          if (!hasSpell) {
               missingChoices.push({
                  id: 'missing_racial_spell',
                  label: `Missing Spell: ${sourceName}`,
                  description: `Your ${sourceName} trait grants you the ${spellId.replace(/[-_]/g, ' ')} spell, but it is missing from your spellbook.`,
                  type: 'race',
                  options: [{
                      id: spellId,
                      label: `Learn ${spellId.replace(/[-_]/g, ' ')}`,
                      description: 'Add this spell to your known spells.',
                      isCantrip
                  }]
              });
          }
      }
  };

  const likelyCantripIds = new Set([
    'acidsplash',
    'acid-splash',
    'blade-ward',
    'dancing_lights',
    'dancing-lights',
    'druidcraft',
    'faerie_fire',
    'light',
    'mage-hand',
    'misty_step',
    'pass_without_trace',
    'prestidigitation',
    'produce-flame',
    'shocking-grasp',
    'thaumaturgy',
    'thunderclap',
  ]);

  const isLikelyCantrip = (spellId: string): boolean => {
    return likelyCantripIds.has(spellId);
  };

  const racialSpellGrants = getRacialSpellGrantsForCharacter(character, level);
  racialSpellGrants.forEach((grant) => {
    const spellId = grant.spellId;
    if (!spellId) return;
    const isCantrip = isLikelyCantrip(spellId) || knownCantrips.has(spellId);
    const hasCantrip = knownCantrips.has(spellId);
    const hasPreparedOrKnown = knownSpells.has(spellId);

    if (!hasCantrip && !hasPreparedOrKnown) {
      let sourceName = `${grant.sourceRaceName || race.name} racial spells`;
      if (grant.traitName) {
        sourceName = grant.traitName;
      }
      if (spellId === 'prestidigitation') {
        sourceName = 'Cantrip';
      }
      checkMissingSpell(spellId, grant.minLevel, sourceName, isCantrip);
    }
  });

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
