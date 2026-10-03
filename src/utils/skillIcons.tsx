// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 25/08/2026, 02:05:41
 * Dependents: components/CharacterCreator/Race/CentaurNaturalAffinitySkillSelection.tsx, components/CharacterCreator/Race/HumanSkillSelection.tsx, components/CharacterCreator/SkillSelection.tsx, components/CharacterSheet/Skills/SkillsTab.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import { assetUrl } from '../config/env';

/**
 * This file provides the canonical skill icon mapping and rendering for D&D 5e skills.
 *
 * It connects the Character Creator skill selection, racial skill pickers, and character
 * sheet skill tables to crisp vector SVGs from the TW-D&D vendor collection (intrinsical/tw-dnd).
 *
 * Icons are rendered via the <SkillIcon /> component, which uses CSS masking so that
 * any text color (e.g. text-sky-400, text-amber-400, text-emerald-400) automatically tints
 * the vector silhouette.
 *
 * Called by: SkillSelection.tsx, HumanSkillSelection.tsx, CentaurNaturalAffinitySkillSelection.tsx, SkillsTab.tsx
 * Depends on: public/assets/icons/tw-dnd/skill/*.svg
 */

// ============================================================================
// TW-D&D Skill Icon Paths
// ============================================================================
// Canonical mapping from skill identifiers to public TW-D&D SVG asset paths.
// Keys are normalized (lowercase, underscores and hyphens unified) for reliable lookup.
// ============================================================================

export const SKILL_TW_DND_ICON_MAP: Record<string, string> = {
  acrobatics:        'assets/icons/tw-dnd/skill/acrobatics.svg',
  animal_handling:   'assets/icons/tw-dnd/skill/animal-handling.svg',
  'animal-handling': 'assets/icons/tw-dnd/skill/animal-handling.svg',
  'animal handling': 'assets/icons/tw-dnd/skill/animal-handling.svg',
  arcana:            'assets/icons/tw-dnd/skill/arcana.svg',
  athletics:         'assets/icons/tw-dnd/skill/athletics.svg',
  deception:         'assets/icons/tw-dnd/skill/deception.svg',
  history:           'assets/icons/tw-dnd/skill/history.svg',
  insight:           'assets/icons/tw-dnd/skill/insight.svg',
  intimidation:      'assets/icons/tw-dnd/skill/intimidation.svg',
  investigation:     'assets/icons/tw-dnd/skill/investigation.svg',
  medicine:          'assets/icons/tw-dnd/skill/medicine.svg',
  nature:            'assets/icons/tw-dnd/skill/nature.svg',
  perception:        'assets/icons/tw-dnd/skill/perception.svg',
  performance:       'assets/icons/tw-dnd/skill/performance.svg',
  persuasion:        'assets/icons/tw-dnd/skill/persuasion.svg',
  religion:          'assets/icons/tw-dnd/skill/religion.svg',
  sleight_of_hand:   'assets/icons/tw-dnd/skill/sleight-of-hand.svg',
  'sleight-of-hand': 'assets/icons/tw-dnd/skill/sleight-of-hand.svg',
  'sleight of hand': 'assets/icons/tw-dnd/skill/sleight-of-hand.svg',
  stealth:           'assets/icons/tw-dnd/skill/stealth.svg',
  survival:          'assets/icons/tw-dnd/skill/survival.svg',
};

// ============================================================================
// Path Lookup Utilities
// ============================================================================

/**
 * Normalizes a skill name or ID into a clean dictionary key.
 */
function normalizeSkillKey(skillNameOrId: string): string {
  return skillNameOrId.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
}

/**
 * Returns the relative public asset path for a skill icon (e.g. 'assets/icons/tw-dnd/skill/stealth.svg'),
 * or undefined if the skill is not mapped.
 */
export function getSkillIconSrc(skillNameOrId?: string): string | undefined {
  if (!skillNameOrId) return undefined;
  const key = normalizeSkillKey(skillNameOrId);
  return SKILL_TW_DND_ICON_MAP[key] || SKILL_TW_DND_ICON_MAP[skillNameOrId.trim().toLowerCase()];
}

// ============================================================================
// SkillIcon Component
// ============================================================================
// Renders a vector TW-D&D skill icon with dynamic color tinting using CSS masks.
// ============================================================================

export interface SkillIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The skill name or ID to render (e.g. 'Stealth', 'animal_handling', 'Animal Handling') */
  name?: string;
  /** Sizing and color classes (defaults to 'w-4 h-4') */
  className?: string;
  /** Accessible title and label */
  title?: string;
}

/**
 * Renders a crisp vector skill icon from the TW-D&D collection.
 * Uses CSS mask so any Tailwind text color class (e.g. text-sky-400) fills the silhouette.
 */
export const SkillIcon: React.FC<SkillIconProps> = ({
  name,
  className = 'w-4 h-4',
  title,
  style,
  ...rest
}) => {
  if (!name) return null;
  const src = getSkillIconSrc(name);
  if (!src) return null;

  // Masking technique: The SVG supplies the shape silhouette, while the CSS
  // backgroundColor: 'currentColor' fills that shape with the active text color.
  return (
    <span
      role="img"
      aria-label={title || `${name} skill icon`}
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
