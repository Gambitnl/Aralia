// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 01:40:41
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Scenario category groupings for the Tactical Sandbox preview sidebar.
 *
 * PreviewCombatScenarios.tsx renders these sections to group scenario cards under
 * labelled headings (Core Rules, Targeting & Space, States & Objects). The ids
 * reference entries in PreviewCombatScenarioCatalog; keeping the grouping here
 * keeps the preview component thin.
 */

import type { PreviewCombatScenarioId } from './PreviewCombatScenarioCatalog';

export const SCENARIO_CATEGORY_SECTIONS: Array<{
  label: string;
  description: string;
  scenarioIds: PreviewCombatScenarioId[];
}> = [
  {
    label: 'Core Rules',
    description: 'Foundational combat mechanics that other scenario lanes build on.',
    scenarioIds: ['cover', 'darkvision', 'terrain', 'concentration', 'reaction', 'resistance', 'critical_hits', 'healing_temp_hp', 'saving_throws_half_damage', 'multiattack_riders', 'spell_slots_upcasting', 'counterspell_nested_reactions', 'dispel_magic_cleanup', 'repeat_saves_condition_expiry', 'sustain_actions_ongoing_control']
  },
  {
    label: 'Targeting & Space',
    description: 'Position, range, sight, templates, and forced movement checks.',
    scenarioIds: ['line_of_sight', 'area_effect', 'forced_movement', 'shove_prone', 'reach_creature_size', 'elevation_range', 'spell_target_restrictions', 'teleportation_occupied_spaces']
  },
  {
    label: 'States & Objects',
    description: 'Creature states, map objects, hazards, summons, and turn resources.',
    scenarioIds: ['conditions', 'stealth_hidden', 'hazards_zones', 'summons_controlled', 'object_interaction', 'death_saves', 'action_economy', 'grapple_escape']
  }
];
