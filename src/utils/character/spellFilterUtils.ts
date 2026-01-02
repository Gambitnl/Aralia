/**
 * @file src/utils/spellFilterUtils.ts
 * Artisanal utilities for filtering and displaying spells in feat selection.
 * Provides school-aware filtering, attack spell detection, and visual helpers.
 */
import { Spell, SpellSchool, FeatSpellRequirement } from '../../types';
import { SpellDataRecord } from '../../context/SpellContext';
import { CLASSES_DATA } from '../../constants';

// ============================================================================
// SPELL FILTERING
// ============================================================================

/**
 * Checks if a spell requires an attack roll.
 * Attack spells have a DAMAGE effect with condition.type === "hit".
 */
export function isAttackSpell(spell: Spell): boolean {
  if (!spell.effects || !Array.isArray(spell.effects)) return false;

  return spell.effects.some((effect) => {
    if (effect.type !== 'DAMAGE') return false;
    // Cast to unknown first to avoid "Property 'condition' does not exist" error,
    // then to a shape that has the optional condition property.
    // This is necessary because the global SpellEffect type is incomplete.
    const damageEffect = effect as unknown as { condition?: { type: string } };
    return damageEffect.condition?.type === 'hit';
  });
}

/**
 * Gets the spell ID list for a given class.
 */
export function getClassSpellList(classId: string): string[] {
  const classData = CLASSES_DATA[classId];
  return classData?.spellcasting?.spellList || [];
}

/**
 * Filters spells based on a FeatSpellRequirement configuration.
 * Returns spells sorted alphabetically by name.
 *
 * @param allSpells - Record of all available spells
 * @param requirement - The filtering requirements from the feat
 * @param selectedSpellSource - Optional class ID for Magic Initiate-style filtering
 */
export function filterSpellsForRequirement(
  allSpells: SpellDataRecord,
  requirement: FeatSpellRequirement,
  selectedSpellSource?: string
): Spell[] {
  // SpellContext stores values as unknown, so cast to Spell for filtering while keeping the shape intact.
  // TODO: Firm up SpellDataRecord typing so this cast is no longer necessary.
  const spellsArray = Object.values(allSpells) as Spell[];

  return spellsArray
    .filter((spell) => {
      // Filter by level (0 = cantrip, 1 = first level, etc.)
      if (spell.level !== requirement.level) return false;

      // Filter by school(s) if specified
      if (requirement.schools && requirement.schools.length > 0) {
        if (!spell.school || !requirement.schools.includes(spell.school as SpellSchool)) {
          return false;
        }
      }

      // Filter by selected spell source class (for Magic Initiate)
      if (selectedSpellSource) {
        const sourceSpellList = getClassSpellList(selectedSpellSource);
        if (!sourceSpellList.includes(spell.id)) return false;
      }

      // Filter for attack spells if required
      if (requirement.requiresAttack && !isAttackSpell(spell)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================================================
// VISUAL HELPERS
// ============================================================================

/**
 * Maps spell schools to thematic emoji icons.
 */
const SCHOOL_ICONS: Record<SpellSchool, string> = {
  [SpellSchool.Abjuration]: '\u{1F6E1}\u{FE0F}',   // Shield
  [SpellSchool.Conjuration]: '\u{2728}',            // Sparkles
  [SpellSchool.Divination]: '\u{1F441}\u{FE0F}',   // Eye
  [SpellSchool.Enchantment]: '\u{1F4AB}',           // Dizzy
  [SpellSchool.Evocation]: '\u{1F525}',             // Fire
  [SpellSchool.Illusion]: '\u{1F3AD}',              // Masks
  [SpellSchool.Necromancy]: '\u{1F480}',            // Skull
  [SpellSchool.Transmutation]: '\u{1F504}',         // Cycle
};

/**
 * Returns an emoji icon for a spell school.
 */
export function getSchoolIcon(school: SpellSchool | string): string {
  return SCHOOL_ICONS[school as SpellSchool] || '\u{1F4DC}'; // Scroll fallback
}

/**
 * Maps spell schools to Tailwind text color classes.
 */
const SCHOOL_TEXT_COLORS: Record<SpellSchool, string> = {
  [SpellSchool.Abjuration]: 'text-blue-400',
  [SpellSchool.Conjuration]: 'text-yellow-400',
  [SpellSchool.Divination]: 'text-purple-400',
  [SpellSchool.Enchantment]: 'text-pink-400',
  [SpellSchool.Evocation]: 'text-orange-400',
  [SpellSchool.Illusion]: 'text-indigo-400',
  [SpellSchool.Necromancy]: 'text-emerald-400',
  [SpellSchool.Transmutation]: 'text-teal-400',
};

/**
 * Returns a Tailwind text color class for a spell school.
 */
export function getSchoolColorClass(school: SpellSchool | string): string {
  return SCHOOL_TEXT_COLORS[school as SpellSchool] || 'text-gray-400';
}

/**
 * Maps spell schools to Tailwind background + border classes for badges.
 */
const SCHOOL_BG_CLASSES: Record<SpellSchool, string> = {
  [SpellSchool.Abjuration]: 'bg-blue-900/50 border-blue-700',
  [SpellSchool.Conjuration]: 'bg-yellow-900/50 border-yellow-700',
  [SpellSchool.Divination]: 'bg-purple-900/50 border-purple-700',
  [SpellSchool.Enchantment]: 'bg-pink-900/50 border-pink-700',
  [SpellSchool.Evocation]: 'bg-orange-900/50 border-orange-700',
  [SpellSchool.Illusion]: 'bg-indigo-900/50 border-indigo-700',
  [SpellSchool.Necromancy]: 'bg-emerald-900/50 border-emerald-700',
  [SpellSchool.Transmutation]: 'bg-teal-900/50 border-teal-700',
};

/**
 * Returns Tailwind background + border classes for a spell school badge.
 */
export function getSchoolBgClass(school: SpellSchool | string): string {
  return SCHOOL_BG_CLASSES[school as SpellSchool] || 'bg-gray-800/50 border-gray-700';
}

/**
 * Returns a human-readable label for a spell level.
 */
export function getSpellLevelLabel(level: number): string {
  if (level === 0) return 'Cantrip';
  const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
  return `${ordinals[level]} Level`;
}

/**
 * Formats casting time for display.
 */
export function formatCastingTime(castingTime: Spell['castingTime']): string {
  if (!castingTime) return '';

  const unitLabels: Record<string, string> = {
    action: 'Action',
    bonus_action: 'Bonus Action',
    reaction: 'Reaction',
    minute: 'Minute',
    hour: 'Hour',
    special: 'Special',
  };

  const isString = typeof castingTime === 'string';
  const unit = isString ? castingTime : castingTime.unit;
  const value = isString ? 1 : castingTime.value;

  const label = unitLabels[unit] || unit;

  if (value === 1) {
    return label;
  }
  return `${value} ${label}${value > 1 ? 's' : ''}`;
}
