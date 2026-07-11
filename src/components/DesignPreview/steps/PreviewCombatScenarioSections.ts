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
    scenarioIds: ['cover', 'darkvision', 'terrain', 'concentration', 'reaction', 'resistance']
  },
  {
    label: 'Targeting & Space',
    description: 'Position, range, sight, templates, and forced movement checks.',
    scenarioIds: ['line_of_sight', 'area_effect', 'forced_movement', 'elevation_range', 'spell_target_restrictions']
  },
  {
    label: 'States & Objects',
    description: 'Creature states, map objects, hazards, summons, and turn resources.',
    scenarioIds: ['conditions', 'stealth_hidden', 'hazards_zones', 'summons_controlled', 'object_interaction', 'death_saves', 'action_economy']
  }
];
