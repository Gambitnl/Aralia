import React from 'react';
import { assetUrl } from '../config/env';

/**
 * This file provides the canonical ability score icon mapping and rendering for D&D 5e ability scores.
 *
 * It connects the Character Creator ability point-buy, the stat block preview, racial spell
 * ability pickers, and the character sheet overview to vector SVGs from the TW-D&D vendor collection.
 *
 * Icons are rendered via the <AbilityScoreIcon /> component, which uses CSS masking so that
 * any text color (e.g. text-amber-400, text-sky-400, text-purple-300) automatically tints
 * the vector silhouette.
 *
 * Called by: AbilityScoreAllocation.tsx, CharacterStatBlock.tsx, RacialSpellAbilitySelection.tsx, CharacterOverview.tsx
 * Depends on: public/assets/icons/tw-dnd/ability/*.svg
 */

// ============================================================================
// TW-D&D Ability Score Icon Paths
// ============================================================================
// Canonical mapping from ability names and 3-letter abbreviations to SVG paths.
// Keys are lowercased for case-insensitive lookup.
// ============================================================================

export const ABILITY_TW_DND_ICON_MAP: Record<string, string> = {
  strength:     'assets/icons/tw-dnd/ability/strength.svg',
  str:          'assets/icons/tw-dnd/ability/strength.svg',
  dexterity:    'assets/icons/tw-dnd/ability/dexterity.svg',
  dex:          'assets/icons/tw-dnd/ability/dexterity.svg',
  constitution: 'assets/icons/tw-dnd/ability/constitution.svg',
  con:          'assets/icons/tw-dnd/ability/constitution.svg',
  intelligence: 'assets/icons/tw-dnd/ability/intelligence.svg',
  int:          'assets/icons/tw-dnd/ability/intelligence.svg',
  wisdom:       'assets/icons/tw-dnd/ability/wisdom.svg',
  wis:          'assets/icons/tw-dnd/ability/wisdom.svg',
  charisma:     'assets/icons/tw-dnd/ability/charisma.svg',
  cha:          'assets/icons/tw-dnd/ability/charisma.svg',
};

// ============================================================================
// Path Lookup Utilities
// ============================================================================

/**
 * Returns the relative public asset path for an ability score icon,
 * or undefined if not mapped.
 */
export function getAbilityScoreIconSrc(abilityNameOrAbbr?: string): string | undefined {
  if (!abilityNameOrAbbr) return undefined;
  const key = abilityNameOrAbbr.trim().toLowerCase();
  return ABILITY_TW_DND_ICON_MAP[key];
}

// ============================================================================
// AbilityScoreIcon Component
// ============================================================================
// Renders a vector TW-D&D ability score icon with dynamic color tinting using CSS masks.
// ============================================================================

export interface AbilityScoreIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The ability score name or abbreviation (e.g. 'Strength', 'STR', 'Wisdom', 'wis') */
  name?: string;
  /** Sizing and color classes (defaults to 'w-4 h-4') */
  className?: string;
  /** Accessible title and label */
  title?: string;
}

/**
 * Renders a crisp vector ability score icon from the TW-D&D collection.
 * Uses CSS mask so any Tailwind text color class (e.g. text-amber-400) fills the silhouette.
 */
export const AbilityScoreIcon: React.FC<AbilityScoreIconProps> = ({
  name,
  className = 'w-4 h-4',
  title,
  style,
  ...rest
}) => {
  if (!name) return null;
  const src = getAbilityScoreIconSrc(name);
  if (!src) return null;

  return (
    <span
      role="img"
      aria-label={title || `${name} ability icon`}
      title={title || name}
      className={`inline-block shrink-0 ${className}`}
      style={{
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url("${assetUrl(src)}")`,
        maskImage: `url("${assetUrl(src)}")`,
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        ...style,
      }}
      {...rest}
    />
  );
};
