/**
 * This file adds a chapter-oriented navigation layer above the existing rules corpus.
 *
 * Why it exists:
 * The owner wants the rules side of the glossary to feel more like a browsable handbook
 * chapter than a flat dictionary bucket. The actual rule entries should stay intact, but
 * the sidebar needs a curated parent -> child -> subchild structure for "Rules Glossary"
 * and "Spellcasting Mechanics" so related concepts unfold together.
 *
 * What it preserves:
 * - individual glossary entry files remain the real rule content
 * - search still works against the real leaf entries
 * - existing non-rule categories keep their current structure
 *
 * What remains intentionally best-effort:
 * - not every rule has a perfect thematic home yet
 * - unmatched rules are preserved in a fallback chapter instead of being dropped
 */
import { GlossaryEntry } from '../../types';

// ============================================================================
// Chapter-definition helpers
// ============================================================================
// These helpers keep the chapter taxonomy readable. The point of this file is
// to be understandable to the project owner, so the rules below aim for legible
// intent instead of clever compressed matching logic.
// ============================================================================

interface ChapterSectionDefinition {
  id: string;
  title: string;
  match: (entry: GlossaryEntry) => boolean;
}

interface ChapterDefinition {
  id: string;
  title: string;
  sections: ChapterSectionDefinition[];
  fallbackSectionTitle: string;
}

const RULES_GLOSSARY_CATEGORY = 'Rules Glossary';
const SPELLCASTING_MECHANICS_CATEGORY = 'Spellcasting Mechanics';

function matchesId(entry: GlossaryEntry, ids: string[]): boolean {
  return ids.includes(entry.id);
}

function titleIncludes(entry: GlossaryEntry, phrase: string): boolean {
  return entry.title.toLowerCase().includes(phrase.toLowerCase());
}

function tagIncludes(entry: GlossaryEntry, phrase: string): boolean {
  return entry.tags?.some((tag) => tag.toLowerCase().includes(phrase.toLowerCase())) ?? false;
}

const RULES_GLOSSARY_CHAPTERS: ChapterDefinition[] = [
  {
    id: 'core_resolution',
    title: 'Core Resolution',
    fallbackSectionTitle: 'Other Core Resolution Rules',
    sections: [
      {
        id: 'tests_and_checks',
        title: 'Tests, Checks, and Rolls',
        match: (entry) => matchesId(entry, [
          'd20_test', 'ability_check', 'ability_check_dc', 'ability_check_examples',
          'ability_check_modifier', 'ability_check_proficiency', 'ability_score_and_modifier',
          'advantage', 'advantage_disadvantage', 'advantage_disadvantage_rerolls',
          'advantage_disadvantage_roll_two', 'advantage_disadvantage_stacking',
          'critical_hit', 'difficulty_class', 'disadvantage', 'heroic_inspiration',
          'proficiency', 'proficiency_bonus', 'rolling_20_or_1', 'round_down',
          'save', 'saving_throw', 'saving_throw_dc', 'saving_throw_examples',
          'saving_throw_modifier', 'saving_throw_proficiencies', 'saving_throw_proficiency',
          'skill', 'skill_proficiencies', 'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'
        ]),
      },
    ]
  },
  {
    id: 'combat_and_actions',
    title: 'Combat & Actions',
    fallbackSectionTitle: 'Other Combat & Actions',
    sections: [
      {
        id: 'action_economy',
        title: 'Actions and Turn Economy',
        match: (entry) => matchesId(entry, [
          'action', 'actions', 'bonus_action', 'bonus_actions', 'reaction', 'reactions',
          'attack', 'attack_action', 'dash', 'dash_action', 'disengage', 'disengage_action',
          'dodge', 'dodge_action', 'help', 'help_action', 'hide', 'hide_action', 'hiding',
          'influence', 'influence_action', 'magic', 'magic_action', 'ready', 'ready_action',
          'search', 'search_action', 'study', 'study_action', 'utilize', 'utilize_action',
          'improvising_an_action', 'one_thing_at_a_time'
        ]),
      },
      {
        id: 'combat_mechanics',
        title: 'Combat Mechanics',
        match: (entry) => matchesId(entry, [
          'attack_roll', 'attack_roll_abilities', 'attack_roll_modifier', 'attack_roll_proficiency',
          'damage', 'damage_roll', 'damage_types', 'healing', 'immunity', 'resistance', 'vulnerability',
          'initiative', 'surprise', 'encounter', 'opportunity_attack', 'two_weapon_fighting',
          'grappled', 'grappling', 'escape_a_grapple', 'unarmed_strike', 'weapon_attack', 'spell_attack',
          'cover', 'half_cover', 'three_quarters_cover', 'total_cover'
        ]),
      }
    ]
  },
  {
    id: 'movement_and_environment',
    title: 'Movement & Environment',
    fallbackSectionTitle: 'Other Movement & Environment',
    sections: [
      {
        id: 'movement_positioning',
        title: 'Movement and Positioning',
        match: (entry) => matchesId(entry, [
          'speed', 'changes_to_your_speeds', 'special_speeds',
          'burrow_speed', 'climb_speed', 'fly_speed', 'swim_speed',
          'climbing', 'crawling', 'flying', 'jumping', 'swimming',
          'high_jump', 'long_jump', 'hover', 'falling', 'teleportation',
          'occupied_space', 'unoccupied_space', 'size', 'reach'
        ]) || titleIncludes(entry, 'movement'),
      },
      {
        id: 'light_obscurity',
        title: 'Light and Obscurity',
        match: (entry) => matchesId(entry, [
          'light', 'bright_light', 'dim_light', 'darkness', 'obscured_areas',
          'lightly_obscured', 'heavily_obscured', 'vision', 'vision_and_light',
          'blindsight', 'darkvision', 'tremorsense', 'truesight', 'special_senses'
        ]),
      }
    ]
  },
  {
    id: 'conditions_and_states',
    title: 'Conditions and States',
    fallbackSectionTitle: 'Other Conditions and States',
    sections: [
      {
        id: 'conditions',
        title: 'Conditions',
        match: (entry) => matchesId(entry, [
          'condition', 'conditions', 'conditions_dont_stack', 'duration_condition',
          'blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled',
          'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone',
          'restrained', 'stunned', 'unconscious'
        ]),
      },
      {
        id: 'health_states',
        title: 'Health and States',
        match: (entry) => matchesId(entry, [
          'bloodied', 'dead', 'death_saving_throw', 'hit_points', 'hit_point_dice',
          'temporary_hit_points', 'temporary_hp', 'stable', 'knocking_out_a_creature',
          'dehydration', 'malnutrition', 'suffocation', 'disease', 'diseases',
          'curse', 'curses', 'possessed', 'possession', 'shape_shift', 'shape_shifting'
        ]),
      }
    ]
  },
  {
    id: 'equipment_and_crafting',
    title: 'Equipment & Crafting',
    fallbackSectionTitle: 'Other Equipment & Crafting',
    sections: [
      {
        id: 'equipment',
        title: 'Equipment and Items',
        match: (entry) => matchesId(entry, [
          'adventuring_equipment', 'armor_class', 'armor_training', 'don_or_doff_a_shield',
          'weapon', 'improvised_weapons', 'damage_threshold', 'breaking_objects',
          'carrying_capacity', 'carrying_objects', 'equipment_proficiencies', 'attunement',
          'interacting_with_objects', 'time_limited_object_interactions', 'finding_hidden_objects',
          'lockpicking', 'what_is_an_object', 'vehicles', 'object'
        ]),
      }
    ]
  },
  {
    id: 'magic_and_spellcasting',
    title: 'Magic & Spellcasting',
    fallbackSectionTitle: 'Other Magic Rules',
    sections: [
      {
        id: 'magic_basics',
        title: 'Spellcasting Basics',
        match: (entry) => matchesId(entry, [
          'spell', 'spells_chapter', 'cantrip', 'spell_slot', 'spellcasting_focus',
          'concentration', 'end_concentration', 'ritual', 'magical_effect', 'simultaneous_effects', 'illusions'
        ]),
      },
      {
        id: 'areas_of_effect',
        title: 'Areas of Effect',
        match: (entry) => matchesId(entry, [
          'area_of_effect', 'cone_area', 'cone_area_of_effect', 'cube_area', 'cube_area_of_effect',
          'cylinder_area', 'cylinder_area_of_effect', 'emanation_area', 'emanation_area_of_effect',
          'line_area', 'line_area_of_effect', 'sphere_area_of_effect'
        ]),
      }
    ]
  },
  {
    id: 'adventuring_worldplay',
    title: 'Adventuring & Worldplay',
    fallbackSectionTitle: 'Other Adventuring Rules',
    sections: [
      {
        id: 'creatures_environment',
        title: 'Creatures and Environment',
        match: (entry) => matchesId(entry, [
          'creature', 'creature_type', 'monster', 'ally', 'enemy', 'target',
          'nonplayer_character', 'player_character', 'stat_block', 'alignment',
          'attitude', 'friendly_attitude', 'hostile_attitude', 'indifferent_attitude',
          'telepathy', 'hazard', 'hazards', 'traps', 'difficult_terrain'
        ]),
      },
      {
        id: 'exploration_progression',
        title: 'Exploration and Progression',
        match: (entry) => matchesId(entry, [
          'adventure', 'campaign', 'exploration', 'travel', 'travel_pace',
          'short_rest', 'long_rest', 'experience_points', 'glossary_conventions'
        ]),
      }
    ]
  }
];

const SPELLCASTING_MECHANICS_CHAPTERS: ChapterDefinition[] = [
  {
    id: 'casting_fundamentals',
    title: 'Casting Fundamentals',
    fallbackSectionTitle: 'Other Casting Fundamentals',
    sections: [
      {
        id: 'casting_basics',
        title: 'Casting Basics',
        match: (entry) => matchesId(entry, [
          'spells_chapter',
          'casting_time_rules',
          'spell_components_rules',
          'spell_duration_rules',
          'spell_range_rules',
          'concentration',
          'spell_slots',
          'spell_slot',
          'ritual',
        ]),
      },
      {
        id: 'effects_and_targeting',
        title: 'Spell Effects and Targeting',
        match: (entry) => matchesId(entry, [
          'spell_effects_rules',
        ]),
      },
    ],
  },
  {
    id: 'areas_and_geometry',
    title: 'Areas and Geometry',
    fallbackSectionTitle: 'Other Area Rules',
    sections: [
      {
        id: 'area_shapes',
        title: 'Area Shapes',
        match: (entry) => matchesId(entry, [
          'cone_area',
          'cube_area',
          'cylinder_area',
          'emanation_area',
          'line_area',
          'sphere_area',
        ]),
      },
      {
        id: 'battlefield_constraints',
        title: 'Cover, Visibility, and Terrain',
        match: (entry) => matchesId(entry, [
          'half_cover',
          'three_quarters_cover',
          'total_cover',
          'bright_light',
          'dim_light',
          'darkness',
          'heavily_obscured',
          'lightly_obscured',
          'difficult_terrain',
        ]),
      },
    ],
  },
  {
    id: 'referenced_spell_concepts',
    title: 'Referenced Spell Concepts',
    fallbackSectionTitle: 'Other Referenced Concepts',
    sections: [
      {
        id: 'attitudes_and_states',
        title: 'Attitudes and States',
        match: (entry) => matchesId(entry, [
          'friendly_attitude',
          'hostile_attitude',
          'indifferent_attitude',
          'stable',
          'possessed',
          'shape_shift',
          'curse',
        ]),
      },
      {
        id: 'perception_and_resources',
        title: 'Perception and Resources',
        match: (entry) => matchesId(entry, [
          'passive_perception',
          'temporary_hp',
          'attunement',
          'd20_test',
          'attack_roll',
        ]),
      },
    ],
  },
];

// ============================================================================
// Tree-building helpers
// ============================================================================
// The existing glossary already knows how to render nested subEntries. These
// helpers simply reshape flat rule entries into chapter wrappers without
// mutating the actual leaf entries or their source files.
// ============================================================================

function buildWrapperEntry(
  id: string,
  title: string,
  category: string,
  subEntries: GlossaryEntry[],
): GlossaryEntry {
  return {
    id,
    title,
    category,
    filePath: null,
    subEntries,
  };
}

function sortEntriesByTitle(entries: GlossaryEntry[]): GlossaryEntry[] {
  return entries.slice().sort((a, b) => a.title.localeCompare(b.title));
}

function buildChapterTree(category: string, entries: GlossaryEntry[], chapters: ChapterDefinition[]): GlossaryEntry[] {
  const remainingEntries = new Map(entries.map((entry) => [entry.id, entry]));
  const chapterNodes: GlossaryEntry[] = [];

  for (const chapter of chapters) {
    const sectionNodes: GlossaryEntry[] = [];

    for (const section of chapter.sections) {
      const matchedEntries = sortEntriesByTitle(
        [...remainingEntries.values()].filter((entry) => section.match(entry)),
      );

      matchedEntries.forEach((entry) => remainingEntries.delete(entry.id));

      if (matchedEntries.length > 0) {
        sectionNodes.push(
          buildWrapperEntry(
            `${category.toLowerCase().replace(/\s+/g, '_')}_${chapter.id}_${section.id}`,
            section.title,
            category,
            matchedEntries,
          ),
        );
      }
    }

    if (sectionNodes.length > 0) {
      chapterNodes.push(
        buildWrapperEntry(
          `${category.toLowerCase().replace(/\s+/g, '_')}_${chapter.id}`,
          chapter.title,
          category,
          sectionNodes,
        ),
      );
    }
  }

  const unmatchedEntries = sortEntriesByTitle([...remainingEntries.values()]);
  if (unmatchedEntries.length > 0) {
    chapterNodes.push(
      buildWrapperEntry(
        `${category.toLowerCase().replace(/\s+/g, '_')}_other_rules`,
        'Other Topics',
        category,
        [
          buildWrapperEntry(
            `${category.toLowerCase().replace(/\s+/g, '_')}_other_rules_section`,
            chapters[0]?.fallbackSectionTitle || 'Other Rules',
            category,
            unmatchedEntries,
          ),
        ],
      ),
    );
  }

  return chapterNodes;
}

// ============================================================================
// Public transform
// ============================================================================
// This is the one function the glossary UI calls. It lifts only the targeted
// rule categories into chapter trees and leaves every other category untouched.
// ============================================================================

export function buildGlossaryDisplayIndex(glossaryEntries: GlossaryEntry[] | null): GlossaryEntry[] {
  if (!glossaryEntries) return [];

  const byCategory = new Map<string, GlossaryEntry[]>();
  for (const entry of glossaryEntries) {
    if (!byCategory.has(entry.category)) {
      byCategory.set(entry.category, []);
    }

    byCategory.get(entry.category)!.push(entry);
  }

  const transformedEntries: GlossaryEntry[] = [];

  for (const [category, entries] of byCategory.entries()) {
    if (category === RULES_GLOSSARY_CATEGORY) {
      transformedEntries.push(...buildChapterTree(category, entries, RULES_GLOSSARY_CHAPTERS));
      continue;
    }

    if (category === SPELLCASTING_MECHANICS_CATEGORY) {
      transformedEntries.push(...buildChapterTree(category, entries, SPELLCASTING_MECHANICS_CHAPTERS));
      continue;
    }

    transformedEntries.push(...entries);
  }

  return transformedEntries;
}

/**
 * Find the first actual leaf entry that can display content.
 *
 * Why it exists:
 * Chapter wrappers intentionally do not have file content of their own. The
 * glossary therefore needs a way to skip those wrappers when it chooses a
 * default selection on first open or after a search.
 */
export function findFirstSelectableGlossaryEntry(entries: GlossaryEntry[]): GlossaryEntry | null {
  for (const entry of entries) {
    const isParent = Boolean(entry.subEntries?.length);
    const hasContentToDisplay = Boolean(entry.filePath) || (entry.category === 'Spells' && !isParent);

    if (hasContentToDisplay) {
      return entry;
    }

    if (isParent) {
      const childResult = findFirstSelectableGlossaryEntry(entry.subEntries!);
      if (childResult) return childResult;
    }
  }

  return null;
}
