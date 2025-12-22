/**
 * @file src/utils/visuals/spellVisuals.ts
 * Utilities for resolving spell visuals, handling fallbacks, and standardizing school colors.
 */

import { Spell, SpellSchool } from '../../types/spells';
import { SpellIconSpec, VisualAsset } from '../../types/visuals';

/**
 * Standard color mappings for D&D 5e Spell Schools.
 * Colors chosen to be distinct and thematic.
 */
export const SCHOOL_COLORS: Record<SpellSchool, string> = {
  Abjuration: '#3b82f6',   // Blue (Protection)
  Conjuration: '#f59e0b',  // Amber (Summoning/Creation)
  Divination: '#8b5cf6',   // Violet (Knowledge/Insight)
  Enchantment: '#ec4899',  // Pink (Mind/Charm)
  Evocation: '#ef4444',    // Red (Destruction/Energy)
  Illusion: '#a855f7',     // Purple (Deceit/Phantom)
  Necromancy: '#10b981',   // Green/Black (Life/Death - using Green for toxicity/fel)
  Transmutation: '#22c55e', // Green (Change/Alteration)
};

/**
 * Fallback emojis for spell schools when no specific icon is present.
 */
export const SCHOOL_ICONS: Record<SpellSchool, string> = {
  Abjuration: '🛡️',
  Conjuration: '🌀',
  Divination: '👁️',
  Enchantment: '😵',
  Evocation: '🔥',
  Illusion: '🎭',
  Necromancy: '💀',
  Transmutation: '⚗️',
};

/**
 * Generates a full visual specification for a spell, handling all fallback logic.
 *
 * @param spell - The spell to resolve visuals for.
 * @returns A VisualAsset object ready for UI rendering.
 */
export function getSpellVisual(spell: Spell): VisualAsset {
  // TODO(Materializer): Implement AI asset generation pipeline here.
  // When a spell lacks a specific iconPath, we could query a generated asset index.

  const schoolColor = SCHOOL_COLORS[spell.school] || '#9ca3af'; // Default gray
  const schoolIcon = SCHOOL_ICONS[spell.school] || '✨';

  // Determine fallback content (could be damage type based in future)
  const fallback = schoolIcon;
  if (spell.damageType) {
    // Override fallback icon for specific damage types if desired
    // For now, sticking to school identity for consistency
  }

  return {
    src: undefined, // No static assets yet
    fallbackContent: fallback,
    primaryColor: schoolColor,
    secondaryColor: '#ffffff',
    label: `${spell.name} (${spell.school})`,
  };
}

/**
 * Creates a lighter/darker variant of a hex color for gradients.
 * (Simple implementation for now)
 */
export function getSchoolColor(school: SpellSchool): string {
  return SCHOOL_COLORS[school] || '#9ca3af';
}
