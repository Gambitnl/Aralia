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
        id: 'tests_checks_and_rolls',
        title: 'Tests, Checks, and Rolls',
        match: (entry) => matchesId(entry, [
          'd20_test',
          'ability_check',
          'ability_check_dc',
          'ability_check_modifier',
          'ability_check_proficiency',
          'ability_check_examples',
          'attack_roll',
          'attack_roll_abilities',
          'attack_roll_modifier',
          'attack_roll_proficiency',
          'saving_throw',
          'saving_throw_modifier',
          'saving_throw_proficiency',
          'saving_throw_success_failure',
          'saving_throw_timing',
          'critical_hit',
          'advantage',
          'advantage_disadvantage',
          'advantage_disadvantage_rerolls',
          'advantage_disadvantage_roll_two',
          'advantage_disadvantage_stacking',
          'proficiency_bonus',
          'armor_class',
        ]),
      },
      {
        id: 'action_economy',
        title: 'Actions and Turn Economy',
        match: (entry) => matchesId(entry, [
          'action',
          'actions',
          'attack_action',
          'bonus_action',
          'bonus_actions',
          'reaction',
          'dash_action',
          'disengage_action',
          'dodge_action',
          'help_action',
          'hide_action',
          'influence_action',
          'magic_action',
          'opportunity_attack',
          'ready_action',
          'search_action',
          'study_action',
          'utilize_action',
          'initiative',
          'surprise',
        ]),
      },
    ],
  },
  {
    id: 'space_visibility_and_movement',
    title: 'Space, Visibility, and Movement',
    fallbackSectionTitle: 'Other Space and Movement Rules',
    sections: [
      {
        id: 'light_and_obscurity',
        title: 'Light and Obscurity',
        match: (entry) => matchesId(entry, [
          'bright_light',
          'dim_light',
          'darkness',
          'obscured_areas',
          'blindsight',
          'darkvision',
          'tremorsense',
          'truesight',
        ]),
      },
      {
        id: 'movement_and_positioning',
        title: 'Movement and Positioning',
        match: (entry) => matchesId(entry, [
          'speed',
          'climbing',
          'crawling',
          'flying',
          'swimming',
          'swim_speed',
          'teleportation',
          'unoccupied_space',
        ]) || titleIncludes(entry, 'movement'),
      },
    ],
  },
  {
    id: 'conditions_and_states',
    title: 'Conditions and States',
    fallbackSectionTitle: 'Other Conditions and States',
    sections: [
      {
        id: 'condition_entries',
        title: 'Conditions',
        match: (entry) => entry.id.includes('_condition') || titleIncludes(entry, '[condition]'),
      },
      {
        id: 'special_states',
        title: 'Special States',
        match: (entry) => matchesId(entry, [
          'exhaustion',
          'temporary_hit_points',
          'hit_points',
          'death_saving_throws',
          'unarmed_strike',
        ]),
      },
    ],
  },
  {
    id: 'interaction_and_worldplay',
    title: 'Interaction and Worldplay',
    fallbackSectionTitle: 'Other Worldplay Rules',
    sections: [
      {
        id: 'creatures_objects_and_targets',
        title: 'Creatures, Objects, and Targets',
        match: (entry) => matchesId(entry, [
          'object',
          'weapon',
          'weapon_attack',
          'telepathy',
          'target',
        ]),
      },
      {
        id: 'social_and_environmental',
        title: 'Social and Environmental Concepts',
        match: (entry) => matchesId(entry, [
          'friendly_attitude',
          'hostile_attitude',
          'indifferent_attitude',
        ]) || tagIncludes(entry, 'hazard') || titleIncludes(entry, 'hazard'),
      },
    ],
  },
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
