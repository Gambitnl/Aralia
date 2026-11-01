/** Explicit adventuring choices for authored people, separate from biography.
 * Elara's public cleric vocation and existing dev spell intent inform this
 * support build. No secret goal, family connection or new equipment is added. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 12:34:50
 * Dependents: systems/party/authoredCompanionCapabilities.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export const ELARA_CLERIC_BUILD = {
  id: 'elara_cleric_v1',
  companionId: 'elara_vance',
  rulesEdition: '2024' as const,
  classSkillIds: ['medicine', 'persuasion'],
  humanSkillId: 'history',
  divineOrder: 'Protector' as const,
  // Acolyte supplies Insight and Religion through the ordinary creator owner.
  // Human's additional skill and feat are distinct, rather than duplicate picks.
  humanFeatId: 'healer',
  cantripIds: ['sacred-flame', 'light', 'guidance'],
  preparedSpellIds: ['cure-wounds', 'bless', 'detect-magic', 'shield-of-faith'],
  magicInitiate: {
    selectedAbilityScore: 'Wisdom' as const,
    selectedSpellSource: 'cleric',
    selectedCantrips: ['resistance', 'thaumaturgy'],
    selectedLeveledSpells: ['healing-word'],
  },
};
